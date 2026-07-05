import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { requirePlatformOwner } from "../auth/requirePlatformOwner.js";
import { recordAudit } from "../security/audit.js";
import { deleteAllUserRefresh } from "../auth/refresh.js";
import { disconnectUser } from "../realtime.js";
import { listAiProviderDiagnostics } from "../ai/provider.js";

/**
 * v1.2.6 Platform Admin (trek P1) — глобальная super-admin панель для
 * владельца платформы Eclipse Chat. Все эндпоинты за двумя preHandler'ами:
 * requireJwt + requirePlatformOwner (User.isPlatformOwner = true И не
 * забанен).
 *
 * P1 scope (users-only):
 *   GET  /api/platform/users                        — список с пагинацией
 *   POST /api/platform/users/:id/ban                — забанить
 *   POST /api/platform/users/:id/unban              — разбанить
 *   POST /api/platform/users/:id/reset-password     — сбросить пароль
 *
 * Servers/suspend + audit-view-tab — P2 отдельным слайсом.
 *
 * Безопасность:
 *   - Cannot self-ban / self-reset (защита от случайного блока себя).
 *   - Cannot ban / reset другого platform-owner'а (same-level immunity).
 *   - Ban: bannedAt + reason + bannedByUserId; revoke refresh tokens +
 *     disconnect WS-сокеты сразу.
 *   - Reset: crypto-random 16-char temp pw; bcrypt-hash; revoke refresh.
 *     Plaintext возвращается ОДИН РАЗ в response; никогда не пишется в
 *     audit metadata.
 */

// URL-safe alphabet без визуально-неоднозначных символов (0/O, 1/l/I).
const TEMP_PW_ALPHABET =
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEMP_PW_LENGTH = 16;

function generateTempPassword(): string {
  const bytes = randomBytes(TEMP_PW_LENGTH);
  let out = "";
  for (let i = 0; i < TEMP_PW_LENGTH; i += 1) {
    out += TEMP_PW_ALPHABET[bytes[i] % TEMP_PW_ALPHABET.length];
  }
  return out;
}

const PLATFORM_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  avatar: true,
  createdAt: true,
  isPlatformOwner: true,
  bannedAt: true,
  bannedReason: true,
  bannedByUserId: true,
  bannedBy: {
    select: { id: true, email: true, displayName: true },
  },
  deletedAt: true,
  deletedReason: true,
  deletedByUserId: true,
  deletedBy: {
    select: { id: true, email: true, displayName: true },
  },
} as const;

type DbPlatformUser = Prisma.UserGetPayload<{
  select: typeof PLATFORM_USER_SELECT;
}>;

type PlatformUserView = {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  createdAt: string;
  isPlatformOwner: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  bannedBy: { id: string; email: string; displayName: string } | null;
  deletedAt: string | null;
  deletedReason: string | null;
  deletedBy: { id: string; email: string; displayName: string } | null;
};

function toView(u: DbPlatformUser): PlatformUserView {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatar: u.avatar,
    createdAt: u.createdAt.toISOString(),
    isPlatformOwner: u.isPlatformOwner,
    bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
    bannedReason: u.bannedReason,
    bannedBy: u.bannedBy
      ? {
          id: u.bannedBy.id,
          email: u.bannedBy.email,
          displayName: u.bannedBy.displayName,
        }
      : null,
    deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
    deletedReason: u.deletedReason,
    deletedBy: u.deletedBy
      ? {
          id: u.deletedBy.id,
          email: u.deletedBy.email,
          displayName: u.deletedBy.displayName,
        }
      : null,
  };
}

// v1.2.7 trek P2 — status filter заменил отдельный banned-toggle: теперь
// единый enum (all/active/banned/deleted). Active = bannedAt=NULL И
// deletedAt=NULL. Backward-совместимое чтение старого `banned=true/false`
// дополнительно поддержано в users-list для плавного перехода клиента.
const userStatusFilter = z.enum(["all", "active", "banned", "deleted"]);

const listUsersQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: userStatusFilter.optional(),
  banned: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const reasonBody = z.object({
  reason: z.string().trim().min(1).max(280),
});

const idParam = z.object({ id: z.string().min(1).max(60) });

// v1.2.7 trek P2 — Server views.
const PLATFORM_SERVER_SELECT = {
  id: true,
  name: true,
  icon: true,
  brandColor: true,
  mode: true,
  ownerId: true,
  createdAt: true,
  suspendedAt: true,
  suspendedReason: true,
  suspendedByUserId: true,
  owner: { select: { id: true, email: true, displayName: true, deletedAt: true } },
  suspendedBy: { select: { id: true, email: true, displayName: true } },
  _count: { select: { members: true, channels: true } },
} as const;

type DbPlatformServer = Prisma.ServerGetPayload<{
  select: typeof PLATFORM_SERVER_SELECT;
}>;

type PlatformServerView = {
  id: string;
  name: string;
  icon: string | null;
  brandColor: string | null;
  mode: "ENGINEERING" | "CLIENT";
  createdAt: string;
  owner: {
    id: string;
    email: string;
    displayName: string;
    deletedAt: string | null;
  };
  memberCount: number;
  channelCount: number;
  suspendedAt: string | null;
  suspendedReason: string | null;
  suspendedBy: { id: string; email: string; displayName: string } | null;
};

function toServerView(s: DbPlatformServer): PlatformServerView {
  return {
    id: s.id,
    name: s.name,
    icon: s.icon,
    brandColor: s.brandColor,
    mode: s.mode,
    createdAt: s.createdAt.toISOString(),
    owner: {
      id: s.owner.id,
      email: s.owner.email,
      displayName: s.owner.displayName,
      deletedAt: s.owner.deletedAt ? s.owner.deletedAt.toISOString() : null,
    },
    memberCount: s._count.members,
    channelCount: s._count.channels,
    suspendedAt: s.suspendedAt ? s.suspendedAt.toISOString() : null,
    suspendedReason: s.suspendedReason,
    suspendedBy: s.suspendedBy
      ? {
          id: s.suspendedBy.id,
          email: s.suspendedBy.email,
          displayName: s.suspendedBy.displayName,
        }
      : null,
  };
}

const serverStatusFilter = z.enum(["all", "active", "suspended"]);

const listServersQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: serverStatusFilter.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const auditQuery = z.object({
  type: z.string().trim().max(60).optional(),
  userId: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function registerPlatformRoutes(app: FastifyInstance) {
  // Все routes — за двумя preHandler'ами.
  const guard = { preHandler: [requireJwt, requirePlatformOwner] };

  // GET /api/platform/users — список с пагинацией и фильтрами.
  // v1.2.7 trek P2: status=all/active/banned/deleted. Legacy banned=true/false
  // принимается тоже (для backward-совместимости) — мапится в status.
  app.get("/api/platform/users", guard, async (req, reply) => {
    const parsed = listUsersQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query" });
    }
    const { q, limit, offset } = parsed.data;
    const status =
      parsed.data.status ??
      (parsed.data.banned === "true"
        ? "banned"
        : parsed.data.banned === "false"
          ? "active"
          : "all");

    const where: Prisma.UserWhereInput = {};
    if (q) {
      // PG case-insensitive contains через mode: "insensitive".
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }
    if (status === "active") {
      where.bannedAt = null;
      where.deletedAt = null;
    } else if (status === "banned") {
      where.bannedAt = { not: null };
      where.deletedAt = null;
    } else if (status === "deleted") {
      where.deletedAt = { not: null };
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: PLATFORM_USER_SELECT,
        orderBy: [
          { deletedAt: { sort: "desc", nulls: "last" } },
          { bannedAt: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      db.user.count({ where }),
    ]);

    return reply.send({
      users: users.map(toView),
      total,
      limit,
      offset,
    });
  });

  // GET /api/platform/ai/providers — sanitized AI provider diagnostics.
  // No keys, prompts, request bodies or user content. Platform-owner only.
  app.get("/api/platform/ai/providers", guard, async () => {
    const providers = listAiProviderDiagnostics();
    return {
      providers,
      total: providers.length,
      configured: providers.length > 0,
    };
  });

  // POST /api/platform/users/:id/ban — забанить пользователя.
  app.post("/api/platform/users/:id/ban", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });
    const body = reasonBody.safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Укажите причину бана (1..280 символов)." });
    }

    const adminId = getUserId(req);
    if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
    const { id: targetId } = params.data;

    if (targetId === adminId) {
      return reply
        .status(400)
        .send({ error: "Нельзя забанить себя." });
    }

    const target = await db.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        isPlatformOwner: true,
        bannedAt: true,
        deletedAt: true,
      },
    });
    if (!target) return reply.status(404).send({ error: "Пользователь не найден." });
    if (target.isPlatformOwner) {
      return reply
        .status(403)
        .send({ error: "Нельзя забанить другого platform-owner'а." });
    }
    if (target.deletedAt !== null) {
      return reply
        .status(409)
        .send({ error: "Пользователь удалён — бан не нужен." });
    }
    if (target.bannedAt !== null) {
      return reply.status(409).send({ error: "Пользователь уже забанен." });
    }

    const updated = await db.user.update({
      where: { id: targetId },
      data: {
        bannedAt: new Date(),
        bannedReason: body.data.reason,
        bannedByUserId: adminId,
      },
      select: PLATFORM_USER_SELECT,
    });

    // Forced sign-out: refresh tokens мертвы + WS-сокеты дисконнект.
    await deleteAllUserRefresh(targetId);
    const dropped = disconnectUser(targetId);

    recordAudit("PLATFORM_USER_BANNED", {
      userId: adminId,
      req,
      metadata: {
        targetUserId: targetId,
        reason: body.data.reason,
        socketsDropped: dropped,
      },
    });

    return reply.send({ user: toView(updated) });
  });

  // POST /api/platform/users/:id/unban — снять бан.
  app.post("/api/platform/users/:id/unban", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });

    const adminId = getUserId(req);
    if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
    const { id: targetId } = params.data;

    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, bannedAt: true },
    });
    if (!target) return reply.status(404).send({ error: "Пользователь не найден." });
    if (target.bannedAt === null) {
      return reply.status(409).send({ error: "Пользователь не забанен." });
    }

    const updated = await db.user.update({
      where: { id: targetId },
      data: {
        bannedAt: null,
        bannedReason: null,
        bannedByUserId: null,
      },
      select: PLATFORM_USER_SELECT,
    });

    recordAudit("PLATFORM_USER_UNBANNED", {
      userId: adminId,
      req,
      metadata: { targetUserId: targetId },
    });

    return reply.send({ user: toView(updated) });
  });

  // POST /api/platform/users/:id/reset-password — сбросить пароль.
  // Возвращает crypto-random temp pw ОДИН РАЗ. UI показывает в модалке,
  // Pavel передаёт юзеру out-of-band.
  app.post(
    "/api/platform/users/:id/reset-password",
    guard,
    async (req, reply) => {
      const params = idParam.safeParse(req.params);
      if (!params.success) return reply.status(400).send({ error: "Invalid id" });

      const adminId = getUserId(req);
      if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: targetId } = params.data;

      if (targetId === adminId) {
        return reply.status(400).send({
          error:
            "Нельзя сбросить собственный пароль через эту панель — используй обычный flow смены пароля.",
        });
      }

      const target = await db.user.findUnique({
        where: { id: targetId },
        select: { id: true, isPlatformOwner: true, deletedAt: true },
      });
      if (!target) return reply.status(404).send({ error: "Пользователь не найден." });
      if (target.isPlatformOwner) {
        return reply
          .status(403)
          .send({ error: "Нельзя сбросить пароль другого platform-owner'а." });
      }
      if (target.deletedAt !== null) {
        return reply
          .status(409)
          .send({ error: "Пользователь удалён — сбросить пароль нельзя." });
      }

      const tempPassword = generateTempPassword();
      const hash = await bcrypt.hash(tempPassword, 10);

      const updated = await db.user.update({
        where: { id: targetId },
        data: { passwordHash: hash, failedLoginAttempts: 0, lockoutUntil: null },
        select: PLATFORM_USER_SELECT,
      });

      // Все рефреш-токены — выкинуть; пусть user логинится временным паролем.
      await deleteAllUserRefresh(targetId);

      recordAudit("PLATFORM_USER_PASSWORD_RESET", {
        userId: adminId,
        req,
        metadata: {
          targetUserId: targetId,
          // ⚠️ Никогда не логируем сам пароль.
        },
      });

      return reply.send({
        user: toView(updated),
        tempPassword,
      });
    },
  );

  // v1.2.7 trek P2 — POST /api/platform/users/:id/delete — soft-delete.
  // НЕ удаляет данные из БД: ставит deletedAt + revoke refresh + WS-drop.
  // Login и WS-connect отбиваются «навсегда» (как ban, но с другой
  // причиной и без unban-flow в этом MVP). Обратимо вручную через SQL:
  //   UPDATE "User" SET "deletedAt"=NULL, "deletedReason"=NULL,
  //   "deletedByUserId"=NULL WHERE id='...';
  app.post("/api/platform/users/:id/delete", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });
    const body = reasonBody.safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Укажите причину удаления (1..280 символов)." });
    }

    const adminId = getUserId(req);
    if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
    const { id: targetId } = params.data;

    if (targetId === adminId) {
      return reply.status(400).send({ error: "Нельзя удалить себя." });
    }

    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, isPlatformOwner: true, deletedAt: true },
    });
    if (!target) return reply.status(404).send({ error: "Пользователь не найден." });
    if (target.isPlatformOwner) {
      return reply
        .status(403)
        .send({ error: "Нельзя удалить другого platform-owner'а." });
    }
    if (target.deletedAt !== null) {
      return reply.status(409).send({ error: "Пользователь уже удалён." });
    }

    const updated = await db.user.update({
      where: { id: targetId },
      data: {
        deletedAt: new Date(),
        deletedReason: body.data.reason,
        deletedByUserId: adminId,
      },
      select: PLATFORM_USER_SELECT,
    });

    await deleteAllUserRefresh(targetId);
    const dropped = disconnectUser(targetId);

    recordAudit("PLATFORM_USER_DELETED", {
      userId: adminId,
      req,
      metadata: {
        targetUserId: targetId,
        reason: body.data.reason,
        socketsDropped: dropped,
      },
    });

    return reply.send({ user: toView(updated) });
  });

  // v1.2.7 trek P2 — GET /api/platform/servers — список всех серверов
  // платформы с поиском по name / owner.email и фильтром active/suspended.
  app.get("/api/platform/servers", guard, async (req, reply) => {
    const parsed = listServersQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query" });
    }
    const { q, limit, offset } = parsed.data;
    const status = parsed.data.status ?? "all";

    const where: Prisma.ServerWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { owner: { email: { contains: q, mode: "insensitive" } } },
        { owner: { displayName: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (status === "active") where.suspendedAt = null;
    if (status === "suspended") where.suspendedAt = { not: null };

    const [servers, total] = await Promise.all([
      db.server.findMany({
        where,
        select: PLATFORM_SERVER_SELECT,
        orderBy: [
          { suspendedAt: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      db.server.count({ where }),
    ]);

    return reply.send({
      servers: servers.map(toServerView),
      total,
      limit,
      offset,
    });
  });

  // v1.2.7 trek P2 — POST /api/platform/servers/:id/suspend — заморозить.
  // Write-операции (постинг, создание каналов, settings) блокируются
  // на уровне роутов через assertServerActive (см. lib/serverGating).
  app.post("/api/platform/servers/:id/suspend", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });
    const body = reasonBody.safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Укажите причину заморозки (1..280 символов)." });
    }
    const adminId = getUserId(req);
    if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
    const { id: serverId } = params.data;

    const target = await db.server.findUnique({
      where: { id: serverId },
      select: { id: true, suspendedAt: true },
    });
    if (!target) return reply.status(404).send({ error: "Сервер не найден." });
    if (target.suspendedAt !== null) {
      return reply.status(409).send({ error: "Сервер уже заморожен." });
    }

    const updated = await db.server.update({
      where: { id: serverId },
      data: {
        suspendedAt: new Date(),
        suspendedReason: body.data.reason,
        suspendedByUserId: adminId,
      },
      select: PLATFORM_SERVER_SELECT,
    });

    recordAudit("PLATFORM_SERVER_SUSPENDED", {
      userId: adminId,
      req,
      metadata: { targetServerId: serverId, reason: body.data.reason },
    });

    return reply.send({ server: toServerView(updated) });
  });

  // v1.2.7 trek P2 — POST /api/platform/servers/:id/unsuspend.
  app.post("/api/platform/servers/:id/unsuspend", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });
    const adminId = getUserId(req);
    if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
    const { id: serverId } = params.data;

    const target = await db.server.findUnique({
      where: { id: serverId },
      select: { id: true, suspendedAt: true },
    });
    if (!target) return reply.status(404).send({ error: "Сервер не найден." });
    if (target.suspendedAt === null) {
      return reply.status(409).send({ error: "Сервер не заморожен." });
    }

    const updated = await db.server.update({
      where: { id: serverId },
      data: {
        suspendedAt: null,
        suspendedReason: null,
        suspendedByUserId: null,
      },
      select: PLATFORM_SERVER_SELECT,
    });

    recordAudit("PLATFORM_SERVER_UNSUSPENDED", {
      userId: adminId,
      req,
      metadata: { targetServerId: serverId },
    });

    return reply.send({ server: toServerView(updated) });
  });

  // v1.2.8 trek P3 — GET /api/platform/users/:id/details — расширенный
  // профиль: базовая инфа + owned servers + кол-во memberships +
  // audit-trail (entries где user был actor ИЛИ target в metadata).
  app.get("/api/platform/users/:id/details", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });
    const { id: targetId } = params.data;

    const user = await db.user.findUnique({
      where: { id: targetId },
      select: PLATFORM_USER_SELECT,
    });
    if (!user) return reply.status(404).send({ error: "Пользователь не найден." });

    const [ownedServers, memberCount, auditEntries] = await Promise.all([
      db.server.findMany({
        where: { ownerId: targetId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          suspendedAt: true,
          _count: { select: { members: true, channels: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.member.count({ where: { userId: targetId } }),
      db.auditLog.findMany({
        where: {
          OR: [
            { userId: targetId },
            { metadata: { contains: `"targetUserId":"${targetId}"` } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
      }),
    ]);

    return reply.send({
      user: toView(user),
      ownedServers: ownedServers.map((s) => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt.toISOString(),
        suspendedAt: s.suspendedAt ? s.suspendedAt.toISOString() : null,
        memberCount: s._count.members,
        channelCount: s._count.channels,
      })),
      memberCount,
      auditTrail: auditEntries.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt.toISOString(),
        ipAddress: e.ipAddress,
        metadata: e.metadata,
        user: e.user
          ? {
              id: e.user.id,
              email: e.user.email,
              displayName: e.user.displayName,
            }
          : null,
      })),
    });
  });

  // v1.2.8 trek P3 — GET /api/platform/servers/:id/details — расширенный
  // профиль сервера: базовая инфа + members role-breakdown + channelCount +
  // audit-trail (entries где server упомянут в metadata).
  app.get("/api/platform/servers/:id/details", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });
    const { id: serverId } = params.data;

    const server = await db.server.findUnique({
      where: { id: serverId },
      select: PLATFORM_SERVER_SELECT,
    });
    if (!server) return reply.status(404).send({ error: "Сервер не найден." });

    const [roleBreakdownRaw, auditEntries] = await Promise.all([
      db.member.groupBy({
        by: ["role"],
        where: { serverId },
        _count: { _all: true },
      }),
      db.auditLog.findMany({
        where: {
          OR: [
            { metadata: { contains: `"targetServerId":"${serverId}"` } },
            { metadata: { contains: `"serverId":"${serverId}"` } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
      }),
    ]);

    const roleBreakdown: Record<string, number> = {};
    for (const r of roleBreakdownRaw) {
      roleBreakdown[r.role] = r._count._all;
    }

    return reply.send({
      server: toServerView(server),
      roleBreakdown,
      auditTrail: auditEntries.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt.toISOString(),
        ipAddress: e.ipAddress,
        metadata: e.metadata,
        user: e.user
          ? {
              id: e.user.id,
              email: e.user.email,
              displayName: e.user.displayName,
            }
          : null,
      })),
    });
  });

  // v1.2.7 trek P2 — GET /api/platform/audit-log — read-only audit feed
  // (filter type / userId, пагинация). UI в Platform Admin → Audit tab.
  app.get("/api/platform/audit-log", guard, async (req, reply) => {
    const parsed = auditQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query" });
    }
    const { type, userId, limit, offset } = parsed.data;

    const where: Prisma.AuditLogWhereInput = {};
    if (type) where.type = type as Prisma.AuditLogWhereInput["type"];
    if (userId) where.userId = userId;

    const [entries, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return reply.send({
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt.toISOString(),
        ipAddress: e.ipAddress,
        metadata: e.metadata,
        user: e.user
          ? {
              id: e.user.id,
              email: e.user.email,
              displayName: e.user.displayName,
            }
          : null,
      })),
      total,
      limit,
      offset,
    });
  });
}
