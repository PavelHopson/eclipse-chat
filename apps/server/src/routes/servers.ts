import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import sharp from "sharp";
import { db } from "../db.js";
import { serializeUser, userDisplayName } from "../lib/userView.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { recordAudit } from "../security/audit.js";
import {
  emitChannelCreated,
  emitChannelDeleted,
  emitChannelUpdated,
  emitMemberJoined,
  emitMemberLeft,
  emitMemberUpdated,
  emitMessageOnChannel,
} from "../realtime.js";
import { addServerRoom, onlineUserIds, removeServerRoom } from "../presence.js";
import { getSystemBotUserId } from "../lib/systemBot.js";

/**
 * Server-icon лимиты: 20 MB binary / 27 MB body (для iPhone HEIC + base64
 * overhead). Mime широкий — sharp конвертит в webp на выходе.
 */
const ICON_BODY_LIMIT = 27 * 1024 * 1024;
const ICON_MAX_BINARY = 20 * 1024 * 1024;
const ICON_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
]);

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

const channelTypeSchema = z.enum(["TEXT", "VOICE", "BROADCAST", "EXECUTION"]);

const createServerChannelBody = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(1024).optional().nullable(),
  type: channelTypeSchema.optional(),
  /** v0.74 #29 phase 1: optional auto-expiry. ISO timestamp в будущем
   *  (max 30 дней вперёд, validate в route). NULL = постоянный канал. */
  expiresAt: z.string().datetime().nullable().optional(),
  /** v1.5.46 C1 — создать канал внутри категории. NULL/undefined =
   *  uncategorized (default). Backend верифит что категория принадлежит
   *  этому серверу. */
  categoryId: z.string().min(1).nullable().optional(),
});

const updateChannelBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(1024).optional().nullable(),
  emoji: z.string().max(16).optional().nullable(),
  /** v0.47 Client Mode v2: internal flag. Toggle visibility для MEMBER role
   *  когда server.mode = CLIENT. OWNER/ADMIN/MODERATOR всегда видят. */
  internal: z.boolean().optional(),
  /** v0.74 #29 phase 1: переключить expiry. NULL = снять (постоянный),
   *  ISO timestamp в будущем = установить/обновить. */
  expiresAt: z.string().datetime().nullable().optional(),
});

const reorderChannelsBody = z.object({
  /** Массив { id, position }. position — целое неотрицательное число. */
  order: z
    .array(
      z.object({
        id: z.string().min(1),
        position: z.number().int().min(0).max(10000),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * Все допустимые роли. v0.78 #17 phase 1: extended с 4 до 10.
 * Источник истины для validation в PATCH /api/servers/:id/members/:userId.
 * OWNER не валидный target — transferOwnership отдельный flow.
 */
const MEMBER_ROLES = [
  "OWNER",
  "ADMIN",
  "MODERATOR",
  "ARCHITECT",
  "DEVELOPER",
  "OPERATOR",
  "CLIENT",
  "VIEWER",
  "GUEST",
  "MEMBER",
] as const;
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

/**
 * v0.64: лимит на количество workspace'ов где user — OWNER.
 * Учитываются только серверы созданные этим юзером; участие в чужих
 * серверах не ограничено. ENV override `MAX_SERVERS_PER_USER` —
 * Pavel/admin может поднять при необходимости.
 */
const MAX_SERVERS_PER_USER = (() => {
  const raw = Number(process.env.MAX_SERVERS_PER_USER);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 2;
})();

async function countOwnedServers(userId: string): Promise<number> {
  return db.member.count({ where: { userId, role: "OWNER" } });
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
            banner: true,
            brandColor: true,
            description: true,
            welcomeMessage: true,
            mode: true,
            inviteCode: true,
            ownerId: true,
            // v1.5.54 D3 — lock state для UI badge «Сервер закрыт».
            lockedAt: true,
            lockedReason: true,
            // v1.5.58 E3 — JSON-encoded String[] feature chips.
            features: true,
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
        banner: m.server.banner,
        brandColor: m.server.brandColor,
        description: m.server.description,
        welcomeMessage: m.server.welcomeMessage,
        mode: m.server.mode,
        inviteCode: m.server.inviteCode,
        ownerId: m.server.ownerId,
        lockedAt: m.server.lockedAt?.toISOString() ?? null,
        lockedReason: m.server.lockedReason,
        features: m.server.features,
        createdAt: m.server.createdAt.toISOString(),
        memberCount: m.server._count.members,
        channelCount: m.server._count.channels,
        role: m.role,
      })),
      // v0.64: frontend использует это чтобы grey-out «+» button и
      // показать tooltip с лимитом. owned count derivable из servers[]
      // (filter role==='OWNER'), но передаём maxOwned чтобы UI не
      // хардкодил константу.
      limits: {
        maxOwnedServers: MAX_SERVERS_PER_USER,
      },
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
    // v0.64: лимит owned серверов на аккаунт. Проверка до transaction —
    // быстрый bail без открытия write-транзакции.
    const ownedCount = await countOwnedServers(userId);
    if (ownedCount >= MAX_SERVERS_PER_USER) {
      return reply.status(403).send({
        error: `Достигнут лимит ${MAX_SERVERS_PER_USER} пространств на аккаунт`,
        code: "OWNED_SERVERS_LIMIT",
        limit: MAX_SERVERS_PER_USER,
        current: ownedCount,
      });
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
    recordAudit("SERVER_CREATED", {
      userId,
      req,
      metadata: { serverId: created.id, name: created.name },
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
        banner: true,
        brandColor: true,
        description: true,
        welcomeMessage: true,
        mode: true,
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
        banner: server.banner,
        brandColor: server.brandColor,
        description: server.description,
        welcomeMessage: server.welcomeMessage,
        mode: server.mode,
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
    recordAudit("SERVER_DELETED", {
      userId: member.userId,
      req,
      metadata: { serverId: id },
    });
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

    // v1.5.54 D3 — server isolation. Если OWNER/ADMIN наложил lock
    // (emergency raid response), новые joins reject'ятся. Existing members
    // выше уже идемпотентно вернулись. Sanity: lockedAt проверяется только
    // для new-join путей.
    if (server.lockedAt !== null) {
      return reply.status(403).send({
        error: "Сервер временно закрыт для новых пользователей",
        reason: server.lockedReason ?? null,
      });
    }

    const member = await db.member.create({
      data: { userId, serverId: server.id, role: "MEMBER" },
      include: { user: { select: { id: true, displayName: true, email: true, avatar: true } } },
    });
    addServerRoom(userId, server.id);
    // member.user всегда non-null т.к. Member.userId не nullable — defensive
    // userDisplayName() для consistency со styles серверного кода.
    emitMemberJoined(server.id, {
      memberId: member.id,
      userId: member.userId,
      serverId: server.id,
      role: member.role,
      displayName: userDisplayName(member.user),
      avatar: member.user?.avatar ?? null,
      joinedAt: member.joinedAt.toISOString(),
    });

    // v1.5.48 Discord-parity C7 — auto-post welcome message в первый TEXT
    // channel сервера если `server.welcomeMessage` сконфигурирован.
    // Fire-and-forget: ошибка постинга НЕ должна блокировать join'а user'а.
    // Шаблон: `{{user}}` → @<displayName> нового member'а.
    //
    // Edge cases:
    //   - welcomeMessage null/empty → silent skip
    //   - нет TEXT channel'а → silent skip
    //   - все TEXT channels = internal (CLIENT mode) → используем первый
    //     по position (всё равно постим — внутренние члены увидят)
    //   - system bot user create fails → log и skip
    void (async () => {
      try {
        const wm = server.welcomeMessage?.trim();
        if (!wm) return;
        const firstTextChannel = await db.channel.findFirst({
          where: { serverId: server.id, type: "TEXT" },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true },
        });
        if (!firstTextChannel) return;
        const systemUserId = await getSystemBotUserId();
        const newcomerName = userDisplayName(member.user);
        const rendered = wm
          .replace(/\{\{\s*user\s*\}\}/g, `@${newcomerName}`)
          .slice(0, 4000);
        const posted = await db.message.create({
          data: {
            content: rendered,
            channelId: firstTextChannel.id,
            userId: systemUserId,
          },
          include: {
            user: { select: { id: true, displayName: true, avatar: true } },
          },
        });
        emitMessageOnChannel(firstTextChannel.id, {
          messageId: posted.id,
          content: posted.content,
          channelId: firstTextChannel.id,
          userId: posted.userId ?? "",
          displayName: posted.user?.displayName ?? "System",
          avatar: posted.user?.avatar ?? null,
          isBot: true,
          createdAt: posted.createdAt.toISOString(),
        });
      } catch (err) {
        req.log.warn({ err, serverId: server.id, memberId: member.id }, "welcome auto-post failed");
      }
    })();

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
            // v1.5.45 Discord-parity A3 — отдаём custom status для render'а
            // в MemberList (под displayName). NULL'и сериализуются в JSON
            // как null, frontend ничего не рисует.
            activityText: true,
            activityEmoji: true,
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
          /** v1.5.45 A3 — custom status поверх presence dot. NULL = не задан. */
          activityText: m.user.activityText,
          activityEmoji: m.user.activityEmoji,
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
   * v0.57: GET /api/servers/:id/operational-search?q=&take= — unified
   * operational search: messages + action items + files в одном response.
   * Каждая категория ограничена 25 hits. Используется новым SearchOverlay
   * с tabs.
   *
   * Подход v1: case-insensitive contains (Postgres ILIKE через Prisma
   * `mode: "insensitive"`) — простой, без tsvector index. Performance OK
   * до десятков тысяч rows; FTS upgrade — v2 (одна migration с tsvector +
   * GIN index на Message.content, ActionItem.title+description,
   * Attachment.filename).
   *
   * Используется существующий single-endpoint /search для backward compat
   * (frontend useSearch hook). New endpoint coexists.
   */
  app.get(
    "/api/servers/:id/operational-search",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      const query = req.query as {
        q?: string;
        take?: string;
        since?: string;
        until?: string;
        channelId?: string;
      };
      const q = query.q?.trim() ?? "";
      const take = Math.min(25, Math.max(1, Number(query.take) || 15));
      if (q.length < 2) {
        return { query: q, messages: [], actions: [], files: [] };
      }
      // v1.5.23 — фильтры since/until/channelId. ISO datetime parsed →
      // gte/lte; invalid string → ignored (тихо). channelId фильтрует
      // в message/action/attachment.message.channelId.
      const since =
        query.since && !Number.isNaN(Date.parse(query.since))
          ? new Date(query.since)
          : null;
      const until =
        query.until && !Number.isNaN(Date.parse(query.until))
          ? new Date(query.until)
          : null;
      const channelId = query.channelId?.trim() || null;
      const createdAtFilter =
        since || until
          ? {
              ...(since ? { gte: since } : {}),
              ...(until ? { lte: until } : {}),
            }
          : undefined;

      const [messages, actions, files] = await Promise.all([
        // Messages — TEXT channels, не deleted.
        db.message.findMany({
          where: {
            channel: {
              serverId,
              type: "TEXT",
              ...(channelId ? { id: channelId } : {}),
            },
            deletedAt: null,
            content: { contains: q, mode: "insensitive" },
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
          },
          take,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                email: true,
                botProfile: { select: { id: true, role: true } },
              },
            },
            channel: { select: { id: true, name: true, slug: true } },
          },
        }),
        // Action items — title OR description. v1.5.23 — фильтры channelId
        // (если задан) + createdAt range.
        db.actionItem.findMany({
          where: {
            serverId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
            ...(channelId ? { channelId } : {}),
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
          },
          take,
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          include: {
            channel: { select: { id: true, name: true, slug: true } },
            assignee: { select: { id: true, displayName: true, avatar: true } },
          },
        }),
        // Files — by filename. Через attachments → message → channel.
        // v1.5.23 — фильтр channelId (если задан) на message.channelId +
        // createdAt range на attachment.createdAt.
        db.attachment.findMany({
          where: {
            message: {
              channel: { serverId, ...(channelId ? { id: channelId } : {}) },
              deletedAt: null,
            },
            filename: { contains: q, mode: "insensitive" },
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
          },
          take,
          orderBy: { createdAt: "desc" },
          include: {
            message: {
              select: {
                id: true,
                channel: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        }),
      ]);

      return {
        query: q,
        messages: messages
          .filter((m) => m.channel != null)
          .map((m) => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            user: serializeUser(m.user),
            channel: {
              id: m.channel!.id,
              name: m.channel!.name,
              slug: m.channel!.slug,
            },
          })),
        actions: actions.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          type: a.type,
          status: a.status,
          priority: a.priority,
          dueAt: a.dueAt?.toISOString() ?? null,
          channel: {
            id: a.channel.id,
            name: a.channel.name,
            slug: a.channel.slug,
          },
          assignee: a.assignee ? serializeUser(a.assignee) : null,
        })),
        files: files
          .filter((f) => f.message.channel != null)
          .map((f) => ({
            id: f.id,
            filename: f.filename,
            mimeType: f.mimeType,
            size: f.size,
            url: f.url,
            thumbnailUrl: f.thumbnailUrl,
            messageId: f.messageId,
            createdAt: f.createdAt.toISOString(),
            channel: {
              id: f.message.channel!.id,
              name: f.message.channel!.name,
              slug: f.message.channel!.slug,
            },
          })),
      };
    },
  );

  /**
   * GET /api/servers/:id/search?q=&take= — legacy messages-only search.
   * Сохранён для backward compat — useSearch hook продолжает работать.
   * Новый operational-search возвращает union, см. выше.
   *
   * Простой `contains` без FTS-индекса — для MVP хватает (Postgres
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
          user: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              email: true,
              botProfile: { select: { id: true, role: true } },
            },
          },
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
            user: serializeUser(m.user),
            channel: { id: m.channel!.id, name: m.channel!.name, slug: m.channel!.slug },
          })),
      };
    },
  );

  /** GET /api/servers/:id/channels — каналы сервера.
   *
   * v0.47 Client Mode v2: internal=true каналы filter'ятся ИЗ ответа для
   * MEMBER role, когда server.mode = CLIENT. OWNER/ADMIN/MODERATOR видят
   * все каналы (включая internal — у них lock-icon в UI). В ENGINEERING
   * serverе flag ignored, все members видят все.
   */
  app.get("/api/servers/:id/channels", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const me = await loadMember(req, reply, id);
    if (!me) {
      return reply;
    }
    const server = await db.server.findUnique({
      where: { id },
      select: { mode: true },
    });
    const hideInternal =
      server?.mode === "CLIENT" && me.role === "MEMBER";
    const channels = await db.channel.findMany({
      where: {
        serverId: id,
        ...(hideInternal ? { internal: false } : {}),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        position: true,
        description: true,
        emoji: true,
        internal: true,
        expiresAt: true,
        createdAt: true,
        // v1.5.46 C1 — категория канала. null = uncategorized.
        categoryId: true,
        _count: { select: { messages: true } },
      },
    });
    // v1.5.46 C1 — bundle категории в тот же response чтобы избежать
    // отдельного fetch'а. Frontend ChannelList использует обе коллекции:
    // uncategorized channels (categoryId=null) сверху, потом categories
    // отсортированные по position, в каждой — её channels.
    const categories = await db.channelCategory.findMany({
      where: { serverId: id },
      orderBy: { position: "asc" },
      select: {
        id: true,
        serverId: true,
        name: true,
        position: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      channels,
      categories: categories.map((c) => ({
        id: c.id,
        serverId: c.serverId,
        name: c.name,
        position: c.position,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  });

  /**
   * v1.5.14 — GET /api/servers/:id/audio-library — список всех audio
   * attachments в каналах сервера (member-only). Возвращается с
   * привязкой к channel и автору сообщения; sorted by createdAt desc.
   * Limit hard-capped 200 (UI scroll, не миллион records). Для
   * формирования shared-playlist'а в music room.
   */
  app.get(
    "/api/servers/:id/audio-library",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      const server = await db.server.findUnique({
        where: { id: serverId },
        select: { mode: true },
      });
      const hideInternal = server?.mode === "CLIENT" && me.role === "MEMBER";
      const tracks = await db.attachment.findMany({
        where: {
          mimeType: { startsWith: "audio/" },
          message: {
            channel: {
              serverId,
              ...(hideInternal ? { internal: false } : {}),
            },
            deletedAt: null,
          },
        },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          url: true,
          thumbnailUrl: true,
          size: true,
          waveformPeaks: true,
          createdAt: true,
          message: {
            select: {
              id: true,
              channelId: true,
              channel: { select: { id: true, name: true } },
              user: {
                select: { id: true, displayName: true, avatar: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return {
        tracks: tracks.flatMap((t) => {
          const msg = t.message;
          if (msg == null || msg.channel == null) return [];
          return [
            {
              id: t.id,
              filename: t.filename,
              mimeType: t.mimeType,
              url: t.url,
              thumbnailUrl: t.thumbnailUrl,
              size: t.size,
              waveformPeaks: Array.isArray(t.waveformPeaks)
                ? (t.waveformPeaks as number[])
                : null,
              createdAt: t.createdAt.toISOString(),
              channel: {
                id: msg.channel.id,
                name: msg.channel.name,
              },
              uploader: msg.user,
            },
          ];
        }),
      };
    },
  );

  /** POST /api/servers/:id/channels — создать канал в сервере (любой member). */
  app.post("/api/servers/:id/channels", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id: serverId } = req.params as { id: string };
    const me = await loadMember(req, reply, serverId);
    if (!me) {
      return reply;
    }
    // v1.2.7 Platform Admin (trek P2) — заморожен → write-режим выключен.
    const active = await ensureServerActive(serverId, reply);
    if (!active) return;
    const parsed = createServerChannelBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body" });
    }
    // v0.74 #29: validate expiresAt — должно быть в будущем + max 30 дней.
    let expiresAtDate: Date | null = null;
    if (parsed.data.expiresAt) {
      const d = new Date(parsed.data.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return reply.status(400).send({ error: "Invalid expiresAt" });
      }
      const minDelta = 5 * 60 * 1000; // 5 мин
      const maxDelta = 30 * 24 * 60 * 60 * 1000; // 30 дней
      const delta = d.getTime() - Date.now();
      if (delta < minDelta || delta > maxDelta) {
        return reply
          .status(400)
          .send({ error: "expiresAt must be 5min..30d from now" });
      }
      expiresAtDate = d;
    }
    // v1.5.46 C1 — если задан categoryId, проверить что категория из same server.
    if (parsed.data.categoryId) {
      const cat = await db.channelCategory.findUnique({
        where: { id: parsed.data.categoryId },
        select: { serverId: true },
      });
      if (!cat || cat.serverId !== serverId) {
        return reply.status(400).send({ error: "Category not in this server" });
      }
    }

    const base = slugifyBase(parsed.data.name);
    const slug = await uniqueSlug(base);
    const ch = await db.channel.create({
      data: {
        name: parsed.data.name,
        slug,
        serverId,
        type: parsed.data.type ?? "TEXT",
        description: parsed.data.description?.trim() || null,
        expiresAt: expiresAtDate,
        categoryId: parsed.data.categoryId ?? null,
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
      categoryId: ch.categoryId,
    });
    recordAudit("CHANNEL_CREATED", {
      userId: me.userId,
      req,
      metadata: { serverId, channelId: ch.id, name: ch.name, type: ch.type },
    });
    return {
      channel: {
        id: ch.id,
        name: ch.name,
        slug: ch.slug,
        type: ch.type,
        position: ch.position,
        description: ch.description,
        expiresAt: ch.expiresAt?.toISOString() ?? null,
        createdAt: ch.createdAt.toISOString(),
        categoryId: ch.categoryId,
      },
    };
  });

  /**
   * PATCH /api/channels/:id — переименование канала + обновление description.
   * Permissions: OWNER / ADMIN / MODERATOR на server'е этого канала.
   * MEMBER нельзя — иначе пользователи переименуют #general случайно.
   *
   * Body: { name?: string, description?: string | null }.
   * При смене name — slug НЕ обновляется (slug фиксирован при create
   * для сохранения inbound ссылок). UI отображает name, slug — внутренне.
   *
   * Emits: `channel:updated` в server-room.
   */
  app.patch(
    "/api/channels/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: channelId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      // v1.2.8 trek P3 — suspend-gate расширен на rename/edit каналов.
      const chMeta = await db.channel.findUnique({
        where: { id: channelId },
        select: { serverId: true },
      });
      if (chMeta?.serverId) {
        const active = await ensureServerActive(chMeta.serverId, reply);
        if (!active) return;
      }
      const parsed = updateChannelBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      // Не разрешаем PATCH без полей — иначе zero-op + спам socket emit
      if (
        parsed.data.name === undefined &&
        parsed.data.description === undefined &&
        parsed.data.emoji === undefined &&
        parsed.data.internal === undefined &&
        parsed.data.expiresAt === undefined
      ) {
        return reply.status(400).send({ error: "Nothing to update" });
      }
      // v0.74 #29: expiresAt validate если задано (NULL = снять expiry).
      let expiresAtValue: Date | null | undefined = undefined;
      if (parsed.data.expiresAt !== undefined) {
        if (parsed.data.expiresAt === null) {
          expiresAtValue = null;
        } else {
          const d = new Date(parsed.data.expiresAt);
          if (Number.isNaN(d.getTime())) {
            return reply.status(400).send({ error: "Invalid expiresAt" });
          }
          const minDelta = 5 * 60 * 1000;
          const maxDelta = 30 * 24 * 60 * 60 * 1000;
          const delta = d.getTime() - Date.now();
          if (delta < minDelta || delta > maxDelta) {
            return reply
              .status(400)
              .send({ error: "expiresAt must be 5min..30d from now" });
          }
          expiresAtValue = d;
        }
      }
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true },
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
      if (
        member.role !== "OWNER" &&
        member.role !== "ADMIN" &&
        member.role !== "MODERATOR"
      ) {
        return reply.status(403).send({
          error: "Только OWNER / ADMIN / MODERATOR могут редактировать каналы",
        });
      }
      const data: {
        name?: string;
        description?: string | null;
        emoji?: string | null;
        internal?: boolean;
        expiresAt?: Date | null;
      } = {};
      if (parsed.data.name !== undefined) {
        data.name = parsed.data.name.trim();
      }
      if (parsed.data.description !== undefined) {
        const d = parsed.data.description?.trim();
        data.description = d ? d : null;
      }
      if (parsed.data.emoji !== undefined) {
        const e = parsed.data.emoji?.trim();
        data.emoji = e ? e : null;
      }
      if (parsed.data.internal !== undefined) {
        data.internal = parsed.data.internal;
      }
      if (expiresAtValue !== undefined) {
        data.expiresAt = expiresAtValue;
      }
      const updated = await db.channel.update({
        where: { id: channelId },
        data,
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          position: true,
          description: true,
          emoji: true,
          internal: true,
          expiresAt: true,
          serverId: true,
        },
      });
      emitChannelUpdated(updated.serverId, {
        channelId: updated.id,
        serverId: updated.serverId,
        name: updated.name,
        slug: updated.slug,
        type: updated.type,
        position: updated.position,
        description: updated.description,
        emoji: updated.emoji,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
      });
      return {
        channel: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          type: updated.type,
          position: updated.position,
          description: updated.description,
          emoji: updated.emoji,
          internal: updated.internal,
          expiresAt: updated.expiresAt?.toISOString() ?? null,
        },
      };
    },
  );

  /**
   * PATCH /api/servers/:id/channels/reorder — batch обновление positions.
   * Body: { order: [{id, position}, ...] }.
   * Permissions: OWNER / ADMIN / MODERATOR.
   * Atomic через db.$transaction.
   */
  app.patch(
    "/api/servers/:id/channels/reorder",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) return reply.status(403).send({ error: "Not a member" });
      if (
        member.role !== "OWNER" &&
        member.role !== "ADMIN" &&
        member.role !== "MODERATOR"
      ) {
        return reply.status(403).send({
          error: "Только OWNER / ADMIN / MODERATOR могут менять порядок каналов",
        });
      }
      const parsed = reorderChannelsBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const ids = parsed.data.order.map((o) => o.id);
      // Verify все channels принадлежат серверу — anti-spoof
      const channels = await db.channel.findMany({
        where: { id: { in: ids }, serverId },
        select: { id: true },
      });
      if (channels.length !== ids.length) {
        return reply.status(400).send({
          error: "Некоторые channels не принадлежат серверу или не существуют",
        });
      }
      await db.$transaction(
        parsed.data.order.map((o) =>
          db.channel.update({
            where: { id: o.id },
            data: { position: o.position },
          }),
        ),
      );
      // Emit updated event для каждого channel с новой позицией (frontend
      // обновит ChannelList сразу — sorted рендер). Можно было batch single
      // event, но reuse существующего channel:updated cleaner.
      const updated = await db.channel.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          position: true,
          description: true,
          emoji: true,
          serverId: true,
        },
      });
      for (const ch of updated) {
        emitChannelUpdated(serverId, {
          channelId: ch.id,
          serverId,
          name: ch.name,
          slug: ch.slug,
          type: ch.type,
          position: ch.position,
          description: ch.description,
          emoji: ch.emoji,
        });
      }
      return { ok: true, updated: updated.length };
    },
  );

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
    // v1.2.8 trek P3 — suspend-gate расширен на удаление каналов.
    if (channel.serverId) {
      const active = await ensureServerActive(channel.serverId, reply);
      if (!active) return;
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
    recordAudit("CHANNEL_DELETED", {
      userId,
      req,
      metadata: { serverId: channel.serverId, channelId, name: channel.name },
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
        return reply.status(415).send({
          error: `Формат ${parsed.data.contentType} не поддерживается. Используй JPEG, PNG, WebP, GIF, AVIF, HEIC, BMP или TIFF.`,
        });
      }
      const buf = Buffer.from(parsed.data.dataBase64, "base64");
      if (buf.length === 0) {
        return reply.status(400).send({ error: "Пустой файл" });
      }
      if (buf.length > ICON_MAX_BINARY) {
        return reply.status(413).send({
          error: `Файл слишком большой (${(buf.length / 1024 / 1024).toFixed(1)} MB). Максимум 20 MB.`,
        });
      }
      let resized: Buffer;
      try {
        const meta = await sharp(buf, { failOn: "none" }).metadata();
        if (!meta.width || !meta.height) {
          throw new Error(
            `Image metadata пустая (${meta.format ?? "unknown"} нечитаем)`,
          );
        }
        resized = await sharp(buf, { failOn: "none" })
          .rotate()
          .resize(512, 512, { fit: "cover", position: "center" })
          .webp({ quality: 90 })
          .toBuffer();
        if (resized.length < 800) {
          throw new Error(`Sharp вернул corrupt webp (${resized.length} байт)`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        app.log.warn({ err, mime: parsed.data.contentType, size: buf.length }, "Server icon sharp failed");
        const hint =
          /heif|heic|libheif|unsupported image format/i.test(message) ||
          /heic|heif/i.test(parsed.data.contentType)
            ? " HEIC/HEIF из iPhone не поддержан (сервер без libheif). Загрузи JPEG/PNG."
            : "";
        return reply.status(400).send({
          error: `Не удалось обработать иконку.${hint}`,
          details: message,
        });
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
      // v1.2.8 trek P3 — suspend-gate: role-changes блокируются.
      const active = await ensureServerActive(serverId, reply);
      if (!active) return;
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
      recordAudit("MEMBER_ROLE_CHANGED", {
        userId: me.userId,
        req,
        metadata: {
          serverId,
          targetUserId,
          fromRole: target.role,
          toRole: updated.role,
        },
      });
      return { ok: true, role: updated.role };
    },
  );

  /**
   * DELETE /api/servers/:id/members/:userId — исключить участника (kick).
   *
   * Permission: OWNER/ADMIN. Гейты: нельзя исключить себя (→ «покинуть
   * сервер»), нельзя исключить OWNER, ADMIN не может исключить другого
   * ADMIN (только OWNER). Side-effects зеркалят self-leave (member.delete +
   * removeServerRoom + emitMemberLeft), чтобы клиенты убрали участника.
   * Сообщения kicked-юзера НЕ удаляются (userId сохраняется в Message) —
   * operational history. Пишет MEMBER_KICKED в audit (E5 producer).
   */
  app.delete(
    "/api/servers/:id/members/:userId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, userId: targetUserId } = req.params as {
        id: string;
        userId: string;
      };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      // suspend-gate: на замороженном сервере модерация недоступна.
      const active = await ensureServerActive(serverId, reply);
      if (!active) return;
      if (me.role !== "OWNER" && me.role !== "ADMIN") {
        return reply
          .status(403)
          .send({ error: "Только OWNER/ADMIN могут исключать участников" });
      }
      if (me.userId === targetUserId) {
        return reply.status(400).send({
          error: "Нельзя исключить себя — используйте «покинуть сервер»",
        });
      }
      const target = await db.member.findUnique({
        where: { userId_serverId: { userId: targetUserId, serverId } },
        select: { id: true, role: true, userId: true },
      });
      if (!target) {
        return reply.status(404).send({ error: "Участник не найден" });
      }
      if (target.role === "OWNER") {
        return reply
          .status(403)
          .send({ error: "Нельзя исключить владельца сервера" });
      }
      if (me.role === "ADMIN" && target.role === "ADMIN") {
        return reply.status(403).send({
          error: "ADMIN не может исключить другого ADMIN — только OWNER",
        });
      }
      await db.member.delete({ where: { id: target.id } });
      removeServerRoom(target.userId, serverId);
      emitMemberLeft(serverId, {
        memberId: target.id,
        userId: target.userId,
        serverId,
      });
      recordAudit("MEMBER_KICKED", {
        userId: me.userId,
        req,
        metadata: { serverId, targetUserId, targetRole: target.role },
      });
      return { ok: true };
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

  // =========================================================================
  // v0.10.1 Server Identity — banner + brand color + description + welcome
  // =========================================================================

  const BANNER_BODY_LIMIT = 35 * 1024 * 1024;
  const BANNER_MAX_BINARY = 25 * 1024 * 1024;

  /** Валидация HSL string: "200 80% 60%" (3 числа space-separated с % на 2/3). */
  const HSL_PATTERN = /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/;

  const updateIdentityBody = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    brandColor: z
      .string()
      .max(40)
      .nullable()
      .optional()
      .refine(
        (v) => v == null || v === "" || HSL_PATTERN.test(v.trim()),
        { message: "brandColor должен быть в формате 'H S% L%' (например '200 80% 60%')" },
      ),
    description: z.string().max(1000).nullable().optional(),
    welcomeMessage: z.string().max(500).nullable().optional(),
    mode: z.enum(["ENGINEERING", "CLIENT"]).optional(),
    /**
     * v1.5.58 Discord-parity E3 — feature chips array (max 5, each ≤40 chars).
     * NULL = clear chips, [] (empty array) = also cleared (treated identically),
     * иначе up to 5 непустых строк.
     */
    features: z
      .array(z.string().min(1).max(40))
      .max(5)
      .nullable()
      .optional(),
  });

  /**
   * PATCH /api/servers/:id/identity — обновить name / brandColor / description
   * / welcomeMessage. Только OWNER. Каждое поле опциональное; передаётся
   * только то что меняется. Передача null = сброс (для nullable полей).
   */
  app.patch(
    "/api/servers/:id/identity",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      if (me.role !== "OWNER") {
        return reply.status(403).send({ error: "Только OWNER может менять оформление сервера" });
      }
      // v1.2.7 Platform Admin (trek P2) — заморожен → settings меняться не могут.
      const active = await ensureServerActive(serverId, reply);
      if (!active) return;
      const parsed = updateIdentityBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid body",
        });
      }
      const data: {
        name?: string;
        brandColor?: string | null;
        description?: string | null;
        welcomeMessage?: string | null;
        mode?: "ENGINEERING" | "CLIENT";
        features?: string | null;
      } = {};
      if (parsed.data.name !== undefined) {
        data.name = parsed.data.name.trim();
      }
      if (parsed.data.brandColor !== undefined) {
        const c = parsed.data.brandColor;
        data.brandColor = c == null || c === "" ? null : c.trim();
      }
      if (parsed.data.description !== undefined) {
        const d = parsed.data.description;
        data.description = d == null || d === "" ? null : d.trim();
      }
      if (parsed.data.welcomeMessage !== undefined) {
        const w = parsed.data.welcomeMessage;
        data.welcomeMessage = w == null || w === "" ? null : w.trim();
      }
      if (parsed.data.mode !== undefined) {
        data.mode = parsed.data.mode;
      }
      // v1.5.58 E3 — features stored as JSON.stringify, NULL clears.
      // Trim каждой chip + filter пустые (defense-in-depth поверх zod min(1)).
      if (parsed.data.features !== undefined) {
        if (parsed.data.features === null || parsed.data.features.length === 0) {
          data.features = null;
        } else {
          const cleaned = parsed.data.features
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
            .slice(0, 5);
          data.features = cleaned.length === 0 ? null : JSON.stringify(cleaned);
        }
      }
      const updated = await db.server.update({
        where: { id: serverId },
        data,
        select: {
          id: true,
          name: true,
          brandColor: true,
          description: true,
          welcomeMessage: true,
          mode: true,
          features: true,
        },
      });
      // metadata.changed — только имена изменённых полей (без значений),
      // чтобы не складывать в audit потенциальный PII из description/welcome.
      recordAudit("SERVER_IDENTITY_CHANGED", {
        userId: me.userId,
        req,
        metadata: { serverId, changed: Object.keys(data) },
      });
      return { ok: true, identity: updated };
    },
  );

  /**
   * POST /api/servers/:id/banner — загрузить banner image (1500×500 webp).
   * Только OWNER. JSON+base64 (как icon/avatar).
   */
  app.post(
    "/api/servers/:id/banner",
    { onRequest: [requireJwt], bodyLimit: BANNER_BODY_LIMIT },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      if (me.role !== "OWNER") {
        return reply.status(403).send({ error: "Только OWNER может менять баннер" });
      }
      const parsed = uploadIconBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      if (!ICON_MIME.has(parsed.data.contentType)) {
        return reply.status(415).send({
          error: `Формат ${parsed.data.contentType} не поддерживается.`,
        });
      }
      const buf = Buffer.from(parsed.data.dataBase64, "base64");
      if (buf.length === 0) {
        return reply.status(400).send({ error: "Пустой файл" });
      }
      if (buf.length > BANNER_MAX_BINARY) {
        return reply.status(413).send({
          error: `Файл ${(buf.length / 1024 / 1024).toFixed(1)} MB слишком большой. Максимум 25 MB.`,
        });
      }
      let resized: Buffer;
      try {
        const meta = await sharp(buf, { failOn: "none" }).metadata();
        if (!meta.width || !meta.height) {
          throw new Error(
            `Image metadata пустая (${meta.format ?? "unknown"} нечитаем)`,
          );
        }
        // Баннер 1500×500 (3:1 aspect). cover crop, центр.
        resized = await sharp(buf, { failOn: "none" })
          .rotate()
          .resize(1500, 500, { fit: "cover", position: "center" })
          .webp({ quality: 86 })
          .toBuffer();
        if (resized.length < 2000) {
          throw new Error(`Sharp вернул corrupt webp (${resized.length} байт)`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        app.log.warn({ err, serverId }, "Server banner sharp failed");
        const hint =
          /heif|heic|libheif|unsupported image format/i.test(message) ||
          /heic|heif/i.test(parsed.data.contentType)
            ? " HEIC/HEIF из iPhone не поддержан. Загрузи JPEG/PNG."
            : "";
        return reply.status(400).send({
          error: `Не удалось обработать баннер.${hint}`,
          details: message,
        });
      }
      const dir = path.join(process.env.UPLOADS_DIR ?? "./uploads", "server-banners");
      await fs.mkdir(dir, { recursive: true });
      // Cleanup старого banner best-effort
      const existing = await db.server.findUnique({
        where: { id: serverId },
        select: { banner: true },
      });
      if (existing?.banner) {
        const oldName = path.basename(existing.banner);
        if (oldName) await fs.unlink(path.join(dir, oldName)).catch(() => undefined);
      }
      const filename = `${serverId}-${Date.now()}.webp`;
      await fs.writeFile(path.join(dir, filename), resized);
      const url = `/uploads/server-banners/${filename}`;
      await db.server.update({ where: { id: serverId }, data: { banner: url } });
      recordAudit("SERVER_BANNER_CHANGED", {
        userId: me.userId,
        req,
        metadata: { serverId, action: "set" },
      });
      return { ok: true, banner: url };
    },
  );

  /** DELETE /api/servers/:id/banner — снять баннер. Только OWNER. */
  app.delete(
    "/api/servers/:id/banner",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const me = await loadMember(req, reply, serverId);
      if (!me) return reply;
      if (me.role !== "OWNER") {
        return reply.status(403).send({ error: "Только OWNER может менять баннер" });
      }
      const existing = await db.server.findUnique({
        where: { id: serverId },
        select: { banner: true },
      });
      if (existing?.banner) {
        const oldName = path.basename(existing.banner);
        if (oldName) {
          const dir = path.join(process.env.UPLOADS_DIR ?? "./uploads", "server-banners");
          await fs.unlink(path.join(dir, oldName)).catch(() => undefined);
        }
      }
      await db.server.update({ where: { id: serverId }, data: { banner: null } });
      recordAudit("SERVER_BANNER_CHANGED", {
        userId: me.userId,
        req,
        metadata: { serverId, action: "clear" },
      });
      return { ok: true };
    },
  );

  /**
   * v0.77 #21 phase 1: POST /api/servers/:id/search/semantic
   *
   * Body: `{ query: string, limit?: number }`. Возвращает top-N сообщений
   * сервера, отсортированных по cosine similarity к embedded query.
   *
   * Membership-only check. Не индексирует internal-каналы для MEMBER в
   * CLIENT mode (применяем тот же filter что и regular search).
   *
   * Implementation note: загружаем все embeddings сервера в память,
   * считаем dot-product (vectors уже unit-normalized). Для <30K сообщений
   * — ~100ms на средней машине. Future scale → pgvector + IVFFlat.
   *
   * 503 если embedding provider не сетап (no OLLAMA / no OPENAI key).
   */
  app.post(
    "/api/servers/:id/search/semantic",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const body = req.body as { query?: string; limit?: number };
      const q = (body?.query ?? "").trim();
      if (!q || q.length < 3) {
        return reply
          .status(400)
          .send({ error: "Query must be at least 3 characters" });
      }
      const limit = Math.min(50, Math.max(1, body?.limit ?? 20));

      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const server = await db.server.findUnique({
        where: { id: serverId },
        select: { mode: true },
      });
      const hideInternal =
        server?.mode === "CLIENT" && member.role === "MEMBER";

      const { embedText, cosineSim, EmbeddingNotConfiguredError } =
        await import("../ai/embeddings.js");
      let queryVec: number[];
      let queryModel: string;
      try {
        const r = await embedText(q);
        queryVec = r.vector;
        queryModel = r.model;
      } catch (err) {
        if (err instanceof EmbeddingNotConfiguredError) {
          return reply
            .status(503)
            .send({ error: "Semantic search не сконфигурирован" });
        }
        req.log.warn({ err }, "embed query failed");
        return reply
          .status(502)
          .send({ error: "Не удалось встроить запрос; попробуй ещё раз" });
      }

      // Load embeddings всех messages сервера (через channel JOIN).
      // Для большого workspace это много — добавим soft cap 30K
      // и top-up'нем последние. Future: per-channel partitioning.
      const rows = await db.messageEmbedding.findMany({
        where: {
          model: queryModel, // cross-model search не имеет смысла
          message: {
            channel: {
              serverId,
              ...(hideInternal ? { internal: false } : {}),
            },
            deletedAt: null,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30_000,
        select: {
          vector: true,
          message: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              channelId: true,
              userId: true,
              channel: { select: { name: true } },
              user: { select: { id: true, displayName: true, avatar: true } },
            },
          },
        },
      });

      const scored: Array<{
        score: number;
        messageId: string;
        content: string;
        createdAt: string;
        channelId: string;
        channelName: string;
        userId: string | null;
        displayName: string | null;
        avatar: string | null;
      }> = [];
      for (const r of rows) {
        const msg = r.message;
        if (!msg || !msg.channelId) continue;
        const score = cosineSim(queryVec, r.vector);
        if (score <= 0.1) continue; // отсечка низкорелевантных
        scored.push({
          score,
          messageId: msg.id,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
          channelId: msg.channelId,
          channelName: msg.channel?.name ?? "—",
          userId: msg.user?.id ?? null,
          displayName: msg.user?.displayName ?? null,
          avatar: msg.user?.avatar ?? null,
        });
      }
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, limit);
      return {
        query: q,
        model: queryModel,
        total: scored.length,
        results: top,
      };
    },
  );

  /**
   * v0.76 #25 phase 1 → Discord-parity E5: GET /api/servers/:id/audit-log
   * (backend slice; версия присваивается при ship фронт-таба Codex'ом).
   *
   * OWNER/ADMIN-only. Server-relevant audit events (SERVER_*, CHANNEL_*,
   * MEMBER_*, BOT_*, MESSAGE_DELETED_BY_MOD). Auth events (login/logout) —
   * global, для server-scoped панели зашумят, сюда не попадают.
   *
   * E5 изменения:
   * - **serverId scope** — раньше where фильтровал только по type, без
   *   привязки к серверу: OWNER сервера X видел бы события сервера Y
   *   (cross-server information disclosure). Теперь обязательный
   *   `metadata contains "serverId":"<id>"`. Все эмиттеры пишут serverId
   *   в metadata (servers.ts мутации + bots.ts). События без serverId в
   *   metadata в server-scoped панель не попадают by design.
   * - **Фильтры** (query): type (один из server-scoped), userId (инициатор),
   *   since/until (ISO 8601 по createdAt).
   * - **Pagination** — take (1..100, default 50) + skip (default 0) + total.
   *   Response key `events` сохранён (backward compat).
   *
   * NB: MESSAGE_DELETED_BY_MOD пока без продюсера (mod-delete не пишет audit) —
   * тип оставлен в фильтре для forward-compat. MEMBER_KICKED продюсер добавлен
   * вместе с kick-route (DELETE /api/servers/:id/members/:userId).
   */
  const serverScopedTypes = [
    "SERVER_CREATED",
    "SERVER_DELETED",
    "SERVER_BANNER_CHANGED",
    "SERVER_IDENTITY_CHANGED",
    "MEMBER_ROLE_CHANGED",
    "MEMBER_KICKED",
    "MESSAGE_DELETED_BY_MOD",
    "CHANNEL_CREATED",
    "CHANNEL_DELETED",
    "BOT_CREATED",
    "BOT_DELETED",
    "BOT_KEY_REGENERATED",
  ] as const;
  const auditLogQuery = z.object({
    type: z.enum(serverScopedTypes).optional(),
    userId: z.string().min(1).max(64).optional(),
    since: z.string().datetime().optional(),
    until: z.string().datetime().optional(),
    take: z.coerce.number().int().min(1).max(100).default(50),
    skip: z.coerce.number().int().min(0).default(0),
  });
  app.get(
    "/api/servers/:id/audit-log",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      if (member.role !== "OWNER" && member.role !== "ADMIN") {
        return reply
          .status(403)
          .send({ error: "Только OWNER/ADMIN могут видеть audit-log" });
      }
      const parsedQuery = auditLogQuery.safeParse(req.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? "Invalid query",
        });
      }
      const { type, userId: actorId, since, until, take, skip } =
        parsedQuery.data;

      const createdAt: { gte?: Date; lte?: Date } = {};
      if (since) createdAt.gte = new Date(since);
      if (until) createdAt.lte = new Date(until);
      const typeFilter = type ? [type] : serverScopedTypes;
      const where = {
        type: { in: typeFilter as unknown as string[] } as any,
        // serverId scope: каждый эмиттер кладёт serverId в metadata JSON.
        // contains по keyed-фрагменту, а не по голому id — точнее.
        metadata: { contains: `"serverId":"${serverId}"` },
        ...(actorId ? { userId: actorId } : {}),
        ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
      };

      const [total, events] = await Promise.all([
        db.auditLog.count({ where }),
        db.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take,
          skip,
          select: {
            id: true,
            type: true,
            createdAt: true,
            metadata: true,
            user: { select: { id: true, displayName: true, avatar: true } },
          },
        }),
      ]);
      return {
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          createdAt: e.createdAt.toISOString(),
          metadata: e.metadata,
          user: e.user
            ? {
                id: e.user.id,
                displayName: e.user.displayName,
                avatar: e.user.avatar,
              }
            : null,
        })),
        total,
        take,
        skip,
      };
    },
  );

  /**
   * v1.5.54 Discord-parity D3 — Server isolation (emergency lock).
   *
   * POST /api/servers/:id/lock — наложить lock. Body { reason?: string (≤500) }.
   * Permission: OWNER/ADMIN.
   * Behaviour: устанавливает lockedAt = now, lockedReason, lockedByUserId.
   * После lock'а POST /api/servers/join/:code возвращает 403 для НЕ-members.
   * Existing members + write-операции продолжают работать.
   *
   * DELETE /api/servers/:id/lock — снять lock.
   * Permission: OWNER/ADMIN.
   * Обнуляет три поля.
   *
   * Idempotent: повторный POST на locked серверe обновляет reason+actor;
   * DELETE на не-locked сервере возвращает 200 без изменений.
   */
  const lockBody = z.object({
    reason: z.string().max(500).optional().nullable(),
  });

  app.post(
    "/api/servers/:id/lock",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });

      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(404).send({ error: "Server not found" });
      }
      if (member.role !== "OWNER" && member.role !== "ADMIN") {
        return reply.status(403).send({ error: "OWNER or ADMIN only" });
      }

      const parsed = lockBody.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const updated = await db.server.update({
        where: { id: serverId },
        data: {
          lockedAt: new Date(),
          lockedReason: parsed.data.reason?.trim() || null,
          lockedByUserId: userId,
        },
        select: {
          id: true,
          lockedAt: true,
          lockedReason: true,
          lockedByUserId: true,
        },
      });
      return {
        server: {
          id: updated.id,
          lockedAt: updated.lockedAt?.toISOString() ?? null,
          lockedReason: updated.lockedReason,
          lockedByUserId: updated.lockedByUserId,
        },
      };
    },
  );

  app.delete(
    "/api/servers/:id/lock",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });

      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(404).send({ error: "Server not found" });
      }
      if (member.role !== "OWNER" && member.role !== "ADMIN") {
        return reply.status(403).send({ error: "OWNER or ADMIN only" });
      }

      const updated = await db.server.update({
        where: { id: serverId },
        data: {
          lockedAt: null,
          lockedReason: null,
          lockedByUserId: null,
        },
        select: { id: true },
      });
      return { server: { id: updated.id, lockedAt: null, lockedReason: null, lockedByUserId: null } };
    },
  );
}
