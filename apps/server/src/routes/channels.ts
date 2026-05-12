import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { emitMessageOnChannel } from "../realtime.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";

const createChannelBody = z.object({
  name: z.string().min(1).max(80),
});

const createMessageBody = z.object({
  content: z.string().min(1).max(8000),
});

function slugifyBase(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "channel"
  );
}

async function uniqueSlug(base: string) {
  let slug = base;
  for (let n = 0; n < 20; n++) {
    const exists = await db.channel.findUnique({ where: { slug } });
    if (!exists) {
      return slug;
    }
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Возвращает id самого старого Server'а — обычно это Default Server,
 * созданный seed-миграцией. Используется в legacy `GET/POST /api/channels`
 * для backward compat: каналы создаются и читаются в Default Server.
 *
 * После Step 2 (frontend split) клиент перейдёт на
 * `GET/POST /api/servers/:id/channels` и эти legacy endpoints можно
 * будет deprecate.
 */
async function getDefaultServerId(): Promise<string | null> {
  const s = await db.server.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return s?.id ?? null;
}

export async function registerChannelRoutes(app: FastifyInstance) {
  /**
   * GET /api/channels — legacy: каналы Default Server.
   * Frontend MVP (single-file App.tsx) использует этот endpoint до Step 2 split.
   */
  app.get("/api/channels", async () => {
    const defaultServerId = await getDefaultServerId();
    const list = await db.channel.findMany({
      where: defaultServerId ? { serverId: defaultServerId } : {},
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });
    return { channels: list };
  });

  /**
   * POST /api/channels — legacy: создание канала в Default Server.
   * Требует JWT (как и раньше). Любой авторизованный user может создать
   * канал в Default Server (он member по seed-миграции).
   */
  app.post("/api/channels", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const parsed = createChannelBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body" });
    }
    const defaultServerId = await getDefaultServerId();
    if (!defaultServerId) {
      return reply.status(500).send({ error: "Default Server missing; run npm run db:seed" });
    }
    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId: defaultServerId } },
      select: { id: true },
    });
    if (!member) {
      await db.member.create({
        data: { userId, serverId: defaultServerId, role: "MEMBER" },
      });
    }
    const base = slugifyBase(parsed.data.name);
    const slug = await uniqueSlug(base);
    const ch = await db.channel.create({
      data: { name: parsed.data.name, slug, serverId: defaultServerId },
    });
    return {
      channel: {
        id: ch.id,
        name: ch.name,
        slug: ch.slug,
        createdAt: ch.createdAt,
      },
    };
  });

  /**
   * GET /api/channels/:id/messages — историчная пагинация take=N, max 100.
   * Открытый endpoint (без auth) — соответствует поведению Step 0.
   * Membership check добавится после Step 2 когда фронт перейдёт на server-scoped routes.
   */
  app.get("/api/channels/:id/messages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ch = await db.channel.findUnique({ where: { id } });
    if (!ch) {
      return reply.status(404).send({ error: "Channel not found" });
    }
    const take = Math.min(100, Math.max(1, Number((req.query as { take?: string }).take) || 50));
    const messages = await db.message.findMany({
      where: { channelId: id },
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, displayName: true, avatar: true } } },
    });
    return {
      channel: { id: ch.id, name: ch.name, slug: ch.slug },
      messages: messages
        .reverse()
        .map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          user: { id: m.user.id, displayName: m.user.displayName, avatar: m.user.avatar },
        })),
    };
  });

  /**
   * POST /api/channels/:id/messages — отправка сообщения с проверкой
   * membership на server канала. Это первый эндпоинт с serverguard.
   */
  app.post(
    "/api/channels/:id/messages",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: channelId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Invalid token" });
      }
      const parsed = createMessageBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const ch = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true },
      });
      if (!ch) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      if (ch.serverId) {
        const member = await db.member.findUnique({
          where: { userId_serverId: { userId, serverId: ch.serverId } },
          select: { id: true },
        });
        if (!member) {
          return reply.status(403).send({ error: "Not a member of this server" });
        }
      }
      const u = await db.user.findUnique({ where: { id: userId } });
      if (!u) {
        return reply.status(401).send({ error: "User not found" });
      }
      const m = await db.message.create({
        data: { content: parsed.data.content, userId, channelId },
        include: { user: { select: { id: true, displayName: true, avatar: true } } },
      });
      const payload = {
        messageId: m.id,
        content: m.content,
        channelId: m.channelId,
        userId: m.userId,
        displayName: m.user.displayName,
        avatar: m.user.avatar,
        createdAt: m.createdAt.toISOString(),
      };
      emitMessageOnChannel(m.channelId, payload);
      return { message: payload };
    },
  );
}
