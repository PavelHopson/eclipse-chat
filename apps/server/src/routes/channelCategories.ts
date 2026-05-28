import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { ensureServerActive } from "../lib/serverGating.js";
import {
  emitCategoryCreated,
  emitCategoryDeleted,
  emitCategoryUpdated,
  emitChannelUpdated,
} from "../realtime.js";

/**
 * v1.5.46 Discord-parity C1 — Channel categories.
 *
 * REST endpoints:
 *   POST   /api/servers/:serverId/categories             — create (OWNER/ADMIN)
 *   PATCH  /api/categories/:id                           — rename (OWNER/ADMIN)
 *   DELETE /api/categories/:id                           — delete; channels → uncategorized (OWNER/ADMIN)
 *   POST   /api/servers/:serverId/categories/reorder     — batch reorder categories (OWNER/ADMIN)
 *   PUT    /api/channels/:channelId/category             — assign/unassign + position (OWNER/ADMIN/MODERATOR)
 *
 * Socket events (room `server:${serverId}`):
 *   category:created   — new category appeared
 *   category:updated   — rename ИЛИ position change
 *   category:deleted   — removed; clients перенесут channels в uncategorized
 *   channel:updated    — categoryId / position change на channel (existing event extended)
 */

const createCategoryBody = z.object({
  name: z.string().min(1).max(80),
});

const renameCategoryBody = z.object({
  name: z.string().min(1).max(80),
});

const reorderCategoriesBody = z.object({
  /** Массив { id, position } — full list или partial; backend применяет
   *  атомарно. Position 0..N-1 — frontend сам нумерует. Backend верифит
   *  что все id принадлежат server'у. */
  orders: z
    .array(z.object({ id: z.string().min(1), position: z.number().int().min(0) }))
    .min(1)
    .max(200),
});

const assignChannelBody = z.object({
  /** null = move в uncategorized; string = move в категорию. */
  categoryId: z.string().min(1).nullable(),
  /** Новая position внутри target category (или uncategorized group).
   *  undefined = append в конец. */
  position: z.number().int().min(0).optional(),
});

/**
 * Inline permission check: OWNER ИЛИ ADMIN. Использует loadMember-like flow.
 * Возвращает { ok: false } и пишет в reply при mismatch. ok: true означает
 * permission granted.
 */
async function requireOwnerOrAdmin(
  serverId: string,
  userId: string,
): Promise<{ ok: true; role: string } | { ok: false; status: number; error: string }> {
  const server = await db.server.findUnique({
    where: { id: serverId },
    select: { id: true },
  });
  if (!server) return { ok: false, status: 404, error: "Server not found" };
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
  if (!member) return { ok: false, status: 403, error: "Not a member" };
  if (member.role !== "OWNER" && member.role !== "ADMIN") {
    return { ok: false, status: 403, error: "OWNER or ADMIN only" };
  }
  return { ok: true, role: member.role };
}

/** Аналогично, но допускает MODERATOR — для channel-reassign. */
async function requireMod(
  serverId: string,
  userId: string,
): Promise<{ ok: true; role: string } | { ok: false; status: number; error: string }> {
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
  if (!member) return { ok: false, status: 403, error: "Not a member" };
  if (
    member.role !== "OWNER" &&
    member.role !== "ADMIN" &&
    member.role !== "MODERATOR"
  ) {
    return { ok: false, status: 403, error: "OWNER, ADMIN, or MODERATOR only" };
  }
  return { ok: true, role: member.role };
}

type CategoryDto = {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): CategoryDto {
  return {
    id: row.id,
    serverId: row.serverId,
    name: row.name,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function registerChannelCategoryRoutes(app: FastifyInstance) {
  /**
   * POST /api/servers/:serverId/categories — создать новую категорию.
   * Position авто-присваивается: max(position) + 1 среди категорий сервера.
   */
  app.post(
    "/api/servers/:serverId/categories",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { serverId } = req.params as { serverId: string };

      const perm = await requireOwnerOrAdmin(serverId, userId);
      if (!perm.ok) return reply.status(perm.status).send({ error: perm.error });

      const active = await ensureServerActive(serverId, reply);
      if (!active) return;

      const parsed = createCategoryBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", detail: parsed.error.format() });
      }

      // Atomic: get max position + insert. Race на 2 concurrent создания —
      // обе получат одинаковый position, отсортируются стабильно по createdAt
      // в queries. Не critical для correctness.
      const maxRow = await db.channelCategory.findFirst({
        where: { serverId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const nextPosition = (maxRow?.position ?? -1) + 1;

      const created = await db.channelCategory.create({
        data: {
          serverId,
          name: parsed.data.name.trim(),
          position: nextPosition,
        },
      });
      const dto = toDto(created);
      emitCategoryCreated(serverId, dto);
      return reply.status(201).send({ category: dto });
    },
  );

  /**
   * PATCH /api/categories/:id — переименовать категорию.
   * Position через separate reorder endpoint (батчем).
   */
  app.patch(
    "/api/categories/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id } = req.params as { id: string };

      const existing = await db.channelCategory.findUnique({
        where: { id },
        select: { id: true, serverId: true },
      });
      if (!existing) return reply.status(404).send({ error: "Category not found" });

      const perm = await requireOwnerOrAdmin(existing.serverId, userId);
      if (!perm.ok) return reply.status(perm.status).send({ error: perm.error });

      const active = await ensureServerActive(existing.serverId, reply);
      if (!active) return;

      const parsed = renameCategoryBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", detail: parsed.error.format() });
      }

      const updated = await db.channelCategory.update({
        where: { id },
        data: { name: parsed.data.name.trim() },
      });
      const dto = toDto(updated);
      emitCategoryUpdated(existing.serverId, dto);
      return { category: dto };
    },
  );

  /**
   * DELETE /api/categories/:id — удалить категорию.
   * Channels переходят в uncategorized (SetNull через FK constraint).
   * Frontend получает category:deleted + следом N channel:updated с
   * новым categoryId=null. На clients ChannelList re-render'ит обе группы.
   */
  app.delete(
    "/api/categories/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id } = req.params as { id: string };

      const existing = await db.channelCategory.findUnique({
        where: { id },
        select: { id: true, serverId: true },
      });
      if (!existing) return reply.status(404).send({ error: "Category not found" });

      const perm = await requireOwnerOrAdmin(existing.serverId, userId);
      if (!perm.ok) return reply.status(perm.status).send({ error: perm.error });

      const active = await ensureServerActive(existing.serverId, reply);
      if (!active) return;

      // Собираем affected channel-ids ДО удаления — FK SetNull сработает
      // на delete, нам нужно знать список для emit'ов.
      const affectedChannels = await db.channel.findMany({
        where: { categoryId: id },
        select: {
          id: true,
          serverId: true,
          name: true,
          slug: true,
          type: true,
          position: true,
          description: true,
          emoji: true,
          expiresAt: true,
        },
      });

      await db.channelCategory.delete({ where: { id } });

      emitCategoryDeleted(existing.serverId, { categoryId: id, serverId: existing.serverId });

      // Каждый channel был переведён в uncategorized — emit channel:updated
      // для синхронизации clients. Position у channel'ов остаётся (per-category
      // index, теперь они все в uncategorized с своими position'ами; UI может
      // отсортировать стабильно по createdAt при collision).
      for (const ch of affectedChannels) {
        emitChannelUpdated(existing.serverId, {
          channelId: ch.id,
          serverId: ch.serverId,
          name: ch.name,
          slug: ch.slug,
          type: ch.type,
          position: ch.position,
          description: ch.description,
          emoji: ch.emoji,
          expiresAt: ch.expiresAt?.toISOString() ?? null,
          categoryId: null,
        });
      }

      return reply.status(204).send();
    },
  );

  /**
   * POST /api/servers/:serverId/categories/reorder — batch reorder.
   *
   * Body: { orders: [{ id, position }, ...] }. Backend применяет в
   * transaction'е. Все id должны принадлежать this server'у; иначе 400.
   */
  app.post(
    "/api/servers/:serverId/categories/reorder",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { serverId } = req.params as { serverId: string };

      const perm = await requireOwnerOrAdmin(serverId, userId);
      if (!perm.ok) return reply.status(perm.status).send({ error: perm.error });

      const active = await ensureServerActive(serverId, reply);
      if (!active) return;

      const parsed = reorderCategoriesBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", detail: parsed.error.format() });
      }

      // Верифицировать, что все id принадлежат серверу — защита от
      // cross-server мутации.
      const ids = parsed.data.orders.map((o) => o.id);
      const existing = await db.channelCategory.findMany({
        where: { id: { in: ids }, serverId },
        select: { id: true },
      });
      if (existing.length !== ids.length) {
        return reply.status(400).send({ error: "Some categories not in this server" });
      }

      // Применить позиции в transaction'е.
      await db.$transaction(
        parsed.data.orders.map((o) =>
          db.channelCategory.update({
            where: { id: o.id },
            data: { position: o.position },
          }),
        ),
      );

      // Emit обновлений для всех затронутых. Frontend пересортирует список.
      const updated = await db.channelCategory.findMany({
        where: { serverId },
        orderBy: { position: "asc" },
      });
      for (const c of updated) {
        emitCategoryUpdated(serverId, toDto(c));
      }
      return { categories: updated.map(toDto) };
    },
  );

  /**
   * PUT /api/channels/:channelId/category — переместить channel в категорию
   * (или uncategorized, если categoryId=null). Опционально задать новую
   * position внутри target group.
   *
   * Permissions: OWNER / ADMIN / MODERATOR (как PATCH /api/channels/:id).
   */
  app.put(
    "/api/channels/:channelId/category",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { channelId } = req.params as { channelId: string };

      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true, categoryId: true, position: true },
      });
      if (!channel) return reply.status(404).send({ error: "Channel not found" });

      const perm = await requireMod(channel.serverId, userId);
      if (!perm.ok) return reply.status(perm.status).send({ error: perm.error });

      const active = await ensureServerActive(channel.serverId, reply);
      if (!active) return;

      const parsed = assignChannelBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", detail: parsed.error.format() });
      }

      // Если categoryId задан — проверить что категория принадлежит этому
      // серверу (cross-server move не разрешён даже OWNER'у).
      if (parsed.data.categoryId !== null) {
        const cat = await db.channelCategory.findUnique({
          where: { id: parsed.data.categoryId },
          select: { serverId: true },
        });
        if (!cat || cat.serverId !== channel.serverId) {
          return reply.status(400).send({ error: "Category not in this server" });
        }
      }

      // Position: если undefined — append в конец target group.
      let nextPosition = parsed.data.position;
      if (nextPosition === undefined) {
        const maxRow = await db.channel.findFirst({
          where: { serverId: channel.serverId, categoryId: parsed.data.categoryId },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        nextPosition = (maxRow?.position ?? -1) + 1;
      }

      const updated = await db.channel.update({
        where: { id: channelId },
        data: {
          categoryId: parsed.data.categoryId,
          position: nextPosition,
        },
        select: {
          id: true,
          serverId: true,
          name: true,
          slug: true,
          type: true,
          position: true,
          description: true,
          emoji: true,
          expiresAt: true,
          categoryId: true,
        },
      });

      emitChannelUpdated(channel.serverId, {
        channelId: updated.id,
        serverId: updated.serverId,
        name: updated.name,
        slug: updated.slug,
        type: updated.type,
        position: updated.position,
        description: updated.description,
        emoji: updated.emoji,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        categoryId: updated.categoryId,
      });

      return {
        channel: {
          ...updated,
          expiresAt: updated.expiresAt?.toISOString() ?? null,
        },
      };
    },
  );
}
