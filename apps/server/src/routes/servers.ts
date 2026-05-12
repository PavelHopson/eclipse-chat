import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import sharp from "sharp";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  emitChannelCreated,
  emitChannelDeleted,
  emitMemberJoined,
  emitMemberLeft,
  emitMemberUpdated,
} from "../realtime.js";
import { addServerRoom, onlineUserIds, removeServerRoom } from "../presence.js";

const ICON_BODY_LIMIT = 7 * 1024 * 1024;
const ICON_MAX_BINARY = 5 * 1024 * 1024;
const ICON_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const uploadIconBody = z.object({
  contentType: z.string().min(3).max(40),
  dataBase64: z.string().min(1),
});

function serverIconsDir(): string {
  const base = process.env.UPLOADS_DIR ?? "./uploads";
  return path.join(base, "server-icons");
}

function serverIconUrl(filename: string): string {
  return `/uploads/server-icons/${filename}`;
}

const createServerBody = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().url().max(500).optional().nullable(),
});

const channelTypeSchema = z.enum(["TEXT", "VOICE"]);

const createServerChannelBody = z.object({
  name: z.string().min(1).max(80),
  type: channelTypeSchema.optional(),
});

/** Все допустимые роли. SQLite-friendly — храним как String, валидируем здесь. */
const MEMBER_ROLES = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

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
 * Проверка членства. Возвращает member-row если current user is member,
 * иначе отправляет 403/404 и возвращает null.
 */
async function loadMember(
  req: FastifyRequest,
  reply: FastifyReply,
  serverId: string,
): Promise<{ id: string; userId: string; serverId: string; role: string } | null> {
  const userId = getUserId(req);
  if (!userId) {
    void reply.status(401).send({ error: "Unauthorized" });
    return null;
  }
  const serverExists = await db.server.findUnique({ where: { id: serverId }, select: { id: true } });
  if (!serverExists) {
    void reply.status(404).send({ error: "Server not found" });
    return null;
  }
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { id: true, userId: true, serverId: true, role: true },
  });
  if (!member) {
    void reply.status(403).send({ error: "Not a member of this server" });
    return null;
  }
  return member;
}

export async function registerServerRoutes(app: FastifyInstance) {
  /** GET /api/servers — мои серверы (где я Member). */
  app.get("/api/servers", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const memberships = await db.member.findMany({
      where: { userId },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            icon: true,
            inviteCode: true,
            ownerId: true,
            createdAt: true,
            _count: { select: { members: true, channels: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return {
      servers: memberships.map((m) => ({
        id: m.server.id,
        name: m.server.name,
        icon: m.server.icon,
        inviteCode: m.server.inviteCode,
        ownerId: m.server.ownerId,
        createdAt: m.server.createdAt.toISOString(),
        memberCount: m.server._count.members,
        channelCount: m.server._count.channels,
        role: m.role,
      })),
    };
  });

  /** POST /api/servers — создать сервер, текущий user становится OWNER. */
  app.post("/api/servers", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const parsed = createServerBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body" });
    }
    const created = await db.$transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          name: parsed.data.name,
          icon: parsed.data.icon ?? null,
          ownerId: userId,
        },
      });
      await tx.member.create({
        data: { userId, serverId: server.id, role: "OWNER" },
      });
      return server;
    });
    return {
      server: {
        id: created.id,
        name: created.name,
        icon: created.icon,
        inviteCode: created.inviteCode,
        ownerId: created.ownerId,
        createdAt: created.createdAt.toISOString(),
        role: "OWNER" as MemberRole,
      },
    };
  });

  /** GET /api/servers/:id — инфо о сервере (только для members). */
  app.get("/api/servers/:id", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await loadMember(req, reply, id);
    if (!member) {
      return reply;
    }
    const server = await db.server.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        icon: true,
        inviteCode: true,
        ownerId: true,
        createdAt: true,
        _count: { select: { members: true, channels: true } },
      },
    });
    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }
    return {
      server: {
        id: server.id,
        name: server.name,
        icon: server.icon,
        inviteCode: server.inviteCode,
        ownerId: server.ownerId,
        createdAt: server.createdAt.toISOString(),
        memberCount: server._count.members,
        channelCount: server._count.channels,
        role: member.role,
      },
    };
  });

  /** DELETE /api/servers/:id — только OWNER. Cascade удалит каналы/сообщения/members. */
  app.delete("/api/servers/:id", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await loadMember(req, reply, id);
    if (!member) {
      return reply;
    }
    if (member.role !== "OWNER") {
      return reply.status(403).send({ error: "Only owner can delete server" });
    }
    await db.server.delete({ where: { id } });
    return { ok: true };
  });

  /** POST /api/servers/join/:code — вступить по inviteCode. Idempotent. */
  app.post("/api/servers/join/:code", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const { code } = req.params as { code: string };
    const server = await db.server.findUnique({ where: { inviteCode: code } });
    if (!server) {
      return reply.status(404).send({ error: "Invite not found" });
    }
    const existing = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId: server.id } },
      select: { id: true, role: true },
    });
    if (existing) {
      return {
        server: {
          id: server.id,
          name: server.name,
          icon: server.icon,
          ownerId: server.ownerId,
        },
        member: { id: existing.id, role: existing.role },
        alreadyMember: true,
      };
    }
    const member = await db.member.create({
      data: { userId, serverId: server.id, role: "MEMBER" },
      include: { user: { select: { id: true, displayName: true, email: true, avatar: true } } },
    });
    addServerRoom(userId, server.id);
    emitMemberJoined(server.id, {
      memberId: member.id,
      userId: member.userId,
      serverId: server.id,
      role: member.role,
      displayName: member.user.displayName,
      avatar: member.user.avatar,
      joinedAt: member.joinedAt.toISOString(),
    });
    return {
      server: {
        id: server.id,
        name: server.name,
        icon: server.icon,
        ownerId: server.ownerId,
      },
      member: { id: member.id, role: member.role },
      alreadyMember: false,
    };
  });

  /** DELETE /api/servers/:id/leave — покинуть сервер. OWNER не может leave. */
  app.delete("/api/servers/:id/leave", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await loadMember(req, reply, id);
    if (!member) {
      return reply;
    }
    if (member.role === "OWNER") {
      return reply
        .status(403)
        .send({ error: "Owner cannot leave own server. Delete it or transfer ownership first." });
    }
    await db.member.delete({ where: { id: member.id } });
    removeServerRoom(member.userId, id);
    emitMemberLeft(id, { memberId: member.id, userId: member.userId, serverId: id });
    return { ok: true };
  });

  /** GET /api/servers/:id/members — список участников с current online-статусом. */
  app.get("/api/servers/:id/members", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const me = await loadMember(req, reply, id);
    if (!me) {
      return reply;
    }
    const members = await db.member.findMany({
      where: { serverId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });
    const online = onlineUserIds();
    return {
      members: members.map((m) => {
        const socketOnline = online.has(m.userId);
        // Если manual status = INVISIBLE → отображаем offline для других
        const manualInvisible = m.user.status === "INVISIBLE";
        return {
          id: m.id,
          userId: m.userId,
          role: isMemberRole(m.role) ? m.role : "MEMBER",
          joinedAt: m.joinedAt.toISOString(),
          online: socketOnline && !manualInvisible,
          /** Manual status (если ONLINE/IDLE/DND — overrides; INVISIBLE → online:false выше). */
          manualStatus: m.user.status,
          user: {
            id: m.user.id,
            displayName: m.user.displayName,
            email: m.user.email,
            avatar: m.user.avatar,
            createdAt: m.user.createdAt.toISOString(),
          },
        };
      }),
    };
  });

  /**
   * GET /api/servers/:id/search?q=&take= — full-text search по сообщениям
   * сервера. Простой `contains` без FTS-индекса — для MVP хватает (Postgres
   * умеет sequential scan на ~10k-100k messages быстро). v2.0 — tsvector
   * + GIN index или Meilisearch.
   *
   * Только TEXT channels, deleted skipped. Ограничено 50 hits.
   */
  app.get(
    "/api/servers/:id/search",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      const q = (req.query as { q?: string }).q?.trim() ?? "";
      const take = Math.min(50, Math.max(1, Number((req.query as { take?: string }).take) || 25));
      if (q.length < 2) {
        return { query: q, results: [] };
      }
      const hits = await db.message.findMany({
        where: {
          channel: { serverId, type: "TEXT" },
          deletedAt: null,
          content: { contains: q, mode: "insensitive" },
        },
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, displayName: true, avatar: true } },
          channel: { select: { id: true, name: true, slug: true } },
        },
      });
      return {
        query: q,
        // where clause гарантирует channel != null (filter по channel.serverId),
        // но TypeScript этого не видит — отфильтруем явно и пропустим orphans.
        results: hits
          .filter((m) => m.channel != null)
          .map((m) => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            editedAt: m.editedAt?.toISOString() ?? null,
            user: { id: m.user.id, displayName: m.user.displayName, avatar: m.user.avatar },
            channel: { id: m.channel!.id, name: m.channel!.name, slug: m.channel!.slug },
          })),
      };
    },
  );

  /** GET /api/servers/:id/channels — каналы сервера. */
  app.get("/api/servers/:id/channels", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const me = await loadMember(req, reply, id);
    if (!me) {
      return reply;
    }
    const channels = await db.channel.findMany({
      where: { serverId: id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        position: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });
    return { channels };
  });

  /** POST /api/servers/:id/channels — создать канал в сервере (любой member). */
  app.post("/api/servers/:id/channels", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id: serverId } = req.params as { id: string };
    const me = await loadMember(req, reply, serverId);
    if (!me) {
      return reply;
    }
    const parsed = createServerChannelBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body" });
    }
    const base = slugifyBase(parsed.data.name);
    const slug = await uniqueSlug(base);
    const ch = await db.channel.create({
      data: {
        name: parsed.data.name,
        slug,
        serverId,
        type: parsed.data.type ?? "TEXT",
      },
    });
    emitChannelCreated(serverId, {
      channelId: ch.id,
      serverId,
      name: ch.name,
      slug: ch.slug,
      type: ch.type,
      position: ch.position,
      createdAt: ch.createdAt.toISOString(),
    });
    return {
      channel: {
        id: ch.id,
        name: ch.name,
        slug: ch.slug,
        type: ch.type,
        position: ch.position,
        createdAt: ch.createdAt.toISOString(),
      },
    };
  });

  /**
   * DELETE /api/channels/:id — удаление канала. Требует OWNER/ADMIN роли
   * на server'е этого канала. Cascade удалит messages автоматически
   * (Prisma onDelete: Cascade в schema).
   *
   * Возвращает 204 + emit `channel:deleted` на server-room.
   */
  app.delete("/api/channels/:id", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id: channelId } = req.params as { id: string };
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: { id: true, serverId: true, name: true },
    });
    if (!channel) {
      return reply.status(404).send({ error: "Channel not found" });
    }
    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId: channel.serverId } },
      select: { role: true },
    });
    if (!member) {
      return reply.status(403).send({ error: "Not a member of this server" });
    }
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      return reply.status(403).send({ error: "Only OWNER or ADMIN can delete channels" });
    }
    await db.channel.delete({ where: { id: channelId } });
    emitChannelDeleted(channel.serverId, {
      channelId,
      serverId: channel.serverId,
    });
    return { ok: true };
  });

  /**
   * POST /api/servers/:id/icon — загрузить иконку сервера. Только OWNER.
   * JSON+base64 (как avatars), sharp resize 256x256 webp.
   */
  app.post(
    "/api/servers/:id/icon",
    {
      onRequest: [requireJwt],
      bodyLimit: ICON_BODY_LIMIT,
    },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      if (me.role !== "OWNER") {
        return reply.status(403).send({ error: "Only OWNER can change server icon" });
      }
      const parsed = uploadIconBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      if (!ICON_MIME.has(parsed.data.contentType)) {
        return reply.status(415).send({ error: "Only jpeg/png/webp supported" });
      }
      const buf = Buffer.from(parsed.data.dataBase64, "base64");
      if (buf.length === 0) {
        return reply.status(400).send({ error: "Empty file" });
      }
      if (buf.length > ICON_MAX_BINARY) {
        return reply.status(413).send({ error: "File too large (max 5MB)" });
      }
      const resized = await sharp(buf)
        .rotate()
        .resize(256, 256, { fit: "cover", position: "center" })
        .webp({ quality: 88 })
        .toBuffer()
        .catch(() => null);
      if (!resized) {
        return reply.status(400).send({ error: "Image processing failed" });
      }
      const dir = serverIconsDir();
      await fs.mkdir(dir, { recursive: true });
      // Cleanup старого icon best-effort
      const existing = await db.server.findUnique({
        where: { id: serverId },
        select: { icon: true },
      });
      if (existing?.icon) {
        const oldName = path.basename(existing.icon);
        if (oldName) await fs.unlink(path.join(dir, oldName)).catch(() => undefined);
      }
      const filename = `${serverId}-${Date.now()}.webp`;
      await fs.writeFile(path.join(dir, filename), resized);
      const url = serverIconUrl(filename);
      await db.server.update({ where: { id: serverId }, data: { icon: url } });
      return { ok: true, icon: url };
    },
  );

  /**
   * PATCH /api/servers/:id/members/:userId — изменить роль участника.
   * Только OWNER. Нельзя:
   *   - менять свою роль (OWNER не может разжаловать себя — сначала
   *     transfer ownership когда v1.x)
   *   - назначать OWNER (transfer — отдельный endpoint в v1.x)
   */
  app.patch(
    "/api/servers/:id/members/:userId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, userId: targetUserId } = req.params as {
        id: string;
        userId: string;
      };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      if (me.role !== "OWNER") {
        return reply.status(403).send({ error: "Only OWNER can change roles" });
      }
      if (me.userId === targetUserId) {
        return reply.status(400).send({ error: "Cannot change own role" });
      }
      const body = z
        .object({ role: z.enum(["ADMIN", "MODERATOR", "MEMBER"]) })
        .safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid role" });
      }
      const target = await db.member.findUnique({
        where: { userId_serverId: { userId: targetUserId, serverId } },
        select: { id: true, role: true },
      });
      if (!target) {
        return reply.status(404).send({ error: "Member not found" });
      }
      if (target.role === "OWNER") {
        return reply.status(400).send({ error: "Cannot demote OWNER" });
      }
      const updated = await db.member.update({
        where: { id: target.id },
        data: { role: body.data.role },
      });
      emitMemberUpdated(serverId, {
        memberId: updated.id,
        userId: updated.userId,
        serverId,
        role: updated.role,
      });
      return { ok: true, role: updated.role };
    },
  );

  /** DELETE /api/servers/:id/icon — снять иконку. Только OWNER. */
  app.delete("/api/servers/:id/icon", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id: serverId } = req.params as { id: string };
    const me = await loadMember(req, reply, serverId);
    if (!me) return reply;
    if (me.role !== "OWNER") {
      return reply.status(403).send({ error: "Only OWNER can change server icon" });
    }
    const existing = await db.server.findUnique({
      where: { id: serverId },
      select: { icon: true },
    });
    if (existing?.icon) {
      const oldName = path.basename(existing.icon);
      if (oldName) {
        await fs.unlink(path.join(serverIconsDir(), oldName)).catch(() => undefined);
      }
    }
    await db.server.update({ where: { id: serverId }, data: { icon: null } });
    return { ok: true };
  });
}
