import "dotenv/config";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyJwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import sharp from "sharp";
import { Server as SocketServer } from "socket.io";
import { registerActionRoutes } from "./routes/actions.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBotRoutes } from "./routes/bots.js";
import { registerTwoFactorRoutes } from "./routes/twoFactor.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerDigestRoutes } from "./routes/digest.js";
import { registerDmRoutes } from "./routes/dm.js";
import { registerHomeRoutes } from "./routes/home.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerIncidentRoutes } from "./routes/incidents.js";
import { registerServerRoutes } from "./routes/servers.js";
import { registerTableRoutes } from "./routes/tables.js";
import { registerThreadRoutes } from "./routes/threads.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerVisitRoutes } from "./routes/visits.js";
import { registerVoiceRoutes } from "./routes/voice.js";
import { setSocketIO } from "./realtime.js";
import { registerSocketAuth } from "./auth/socketAuth.js";
import { setPresenceIO, trackConnect, trackDisconnect } from "./presence.js";
import {
  setVoicePresenceIO,
  snapshotForServer,
  metaSnapshotForUsers,
  trackVoiceJoin,
  trackVoiceLeave,
  updateVoiceMeta,
  broadcastSpeaking,
} from "./voicePresence.js";
import { db } from "./db.js";

const port = Number(process.env.PORT) || 3001;
const jwtSecret = process.env.JWT_SECRET;
const resolvedJwtSecret = jwtSecret ?? "dev-insecure-eclipse-chat";
if (!jwtSecret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production");
}

const app = Fastify({ logger: true });

const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
await app.register(cors, { origin: corsOrigin, credentials: true });

// Security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
// CSP с unsafe-inline для styles (у нас inline styles в React components) +
// unsafe-eval отключаем. img-src разрешает blob: для uploads preview + data: для avatars.
// connect-src wildcard wss/https для LiveKit + Socket.io.
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "wss:", "https:"],
      mediaSrc: ["'self'", "blob:", "data:"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  // HSTS — только в проде (HTTPS); dev может быть HTTP localhost.
  hsts: process.env.NODE_ENV === "production"
    ? { maxAge: 15552000, includeSubDomains: true, preload: false }
    : false,
  crossOriginEmbedderPolicy: false, // ломает inline images через blob иногда
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

// Rate limiting (global): защита от base-line abuse.
// Per-route override в auth.ts для логина (тоньше).
await app.register(rateLimit, {
  global: false, // включаем выборочно через config: {rateLimit: ...} в routes
  max: 100,
  timeWindow: "1 minute",
  hook: "onRequest",
  keyGenerator: (req) => {
    // Используем X-Forwarded-For (nginx ставит) или fallback req.ip
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string") return fwd.split(",")[0]?.trim() || req.ip;
    return req.ip;
  },
});
await app.register(fastifyJwt, {
  secret: resolvedJwtSecret,
});
// Статика для аватарок. В проде nginx обычно перехватывает
// `/eclipse-chat/uploads/` сам через alias — это fallback + dev-режим.
const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? "./uploads");
await app.register(fastifyStatic, {
  root: uploadsDir,
  prefix: "/uploads/",
  decorateReply: false,
  cacheControl: true,
  maxAge: "1h",
});

app.get("/health", async () => ({ ok: true, service: "eclipse-chat-server" }));
app.get("/api/health", async () => {
  let dbOk = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }
  return { ok: true, service: "eclipse-chat-server", database: dbOk };
});
app.get("/api/version", async () => ({ name: "@eclipse-chat/server", version: "0.59.0" }));

await registerAuthRoutes(app);
await registerTwoFactorRoutes(app);
await registerBotRoutes(app);
// Startup diagnostic: log sharp format support так admin сразу видит
// что libheif/libavif установлены или нет — главная причина «сломанных
// изображений» при загрузке HEIC с iPhone.
{
  const formats = sharp.format as unknown as Record<
    string,
    { input?: { file?: boolean } }
  >;
  const supported: string[] = [];
  const missing: string[] = [];
  for (const fmt of ["jpeg", "png", "webp", "gif", "avif", "heif", "tiff", "svg"]) {
    const info = formats[fmt];
    if (info?.input?.file) {
      supported.push(fmt);
    } else {
      missing.push(fmt);
    }
  }
  app.log.info({ supported, missing }, "Sharp image format support");
  if (missing.includes("heif")) {
    app.log.warn(
      "Sharp без HEIF/HEIC поддержки. iPhone-фотки в этом формате отлупит 400. " +
        "Чтобы включить: `apt install libheif1 libheif-dev` + `npm rebuild sharp` " +
        "из корня /var/www/eclipse-chat.",
    );
  }
}

await registerChannelRoutes(app);
await registerActionRoutes(app);
await registerDigestRoutes(app);
await registerServerRoutes(app);
await registerUserRoutes(app);
await registerMessageRoutes(app);
await registerThreadRoutes(app);
await registerIncidentRoutes(app);
await registerVoiceRoutes(app);
await registerDmRoutes(app);
await registerHomeRoutes(app);
registerAnalyticsRoutes(app);
await registerVisitRoutes(app);
await registerTableRoutes(app);
await app.ready();

/* Socket.io: тот же HTTP-сервер, что и у Fastify */
const io = new SocketServer(app.server, {
  path: "/socket.io",
  cors: { origin: corsOrigin, methods: ["GET", "POST"] },
});
setSocketIO(io);
setPresenceIO(io);
setVoicePresenceIO(io);
registerSocketAuth(io, resolvedJwtSecret);

/**
 * Авто-подписка авторизованного сокета на server-rooms + регистрация в
 * presence-tracker. Возвращает список serverIds — используется для emit
 * presence:update в нужные rooms.
 */
async function subscribeToUserServers(
  socket: import("socket.io").Socket,
  userId: string,
): Promise<string[]> {
  const memberships = await db.member.findMany({
    where: { userId },
    select: { serverId: true },
  });
  const serverIds = memberships.map((m) => m.serverId);
  for (const serverId of serverIds) {
    await socket.join(`server:${serverId}`);
  }
  return serverIds;
}

/**
 * Снимок voice presence для всех channels на серверах user'а.
 * Возвращает `byChannel` (кто где) + `meta` (mic/deafen-состояние каждого
 * участника эфира) — чтобы sidebar у новоприбывшего сразу показал актуальные
 * Discord-style индикаторы, не дожидаясь дельта-событий.
 */
async function buildVoicePresenceSnapshot(
  userId: string,
): Promise<{ byChannel: Record<string, string[]>; meta: Record<string, { micMuted: boolean; deafened: boolean }> }> {
  const memberships = await db.member.findMany({
    where: { userId },
    select: { serverId: true },
  });
  if (memberships.length === 0) return { byChannel: {}, meta: {} };
  const channels = await db.channel.findMany({
    where: { serverId: { in: memberships.map((m) => m.serverId) }, type: "VOICE" },
    select: { id: true },
  });
  const byChannel = snapshotForServer(channels.map((c) => c.id));
  const userIds = Array.from(new Set(Object.values(byChannel).flat()));
  return { byChannel, meta: metaSnapshotForUsers(userIds) };
}

io.on("connection", (socket) => {
  socket.emit("server:hello", { t: Date.now(), msg: "Eclipse Chat" });

  const userId = (socket.data as { userId: string | null | undefined }).userId;
  if (userId) {
    // Auto-subscribe to user-specific room для DM events (dm:conversation:bumped).
    void socket.join(`user:${userId}`);
    void subscribeToUserServers(socket, userId)
      .then((serverIds) => {
        trackConnect(userId, socket.id, serverIds);
        // Сразу высылаем snapshot voice presence — чтобы UI у новоприбывшего
        // не ждал событий, а сразу показал кто где в эфире.
        return buildVoicePresenceSnapshot(userId);
      })
      .then((snap) => {
        if (snap) {
          socket.emit("voice:state", snap.byChannel);
          socket.emit("voice:meta", snap.meta);
        }
      })
      .catch((err) => {
        app.log.error({ err, userId }, "Failed to subscribe socket to user servers");
      });
  }

  socket.on("client:ping", (cb) => {
    if (typeof cb === "function") {
      cb({ t: Date.now() });
    }
  });
  socket.on("channel:join", (channelId: string) => {
    const uid = (socket.data as { userId: string | null | undefined }).userId;
    if (!uid) {
      return;
    }
    if (typeof channelId === "string" && channelId) {
      void socket.join(`channel:${channelId}`);
    }
  });
  socket.on("channel:leave", (channelId: string) => {
    if (typeof channelId === "string" && channelId) {
      void socket.leave(`channel:${channelId}`);
    }
  });

  // Thread rooms — frontend подписывается на thread:${rootId} когда открывает
  // Thread panel. Backend verify ownership (user — member канала root'а).
  socket.on("thread:join", async (rootId: string) => {
    const uid = (socket.data as { userId: string | null | undefined }).userId;
    if (!uid || typeof rootId !== "string" || !rootId) return;
    const root = await db.message.findUnique({
      where: { id: rootId },
      select: { channelId: true, channel: { select: { serverId: true } } },
    });
    if (!root || !root.channelId || !root.channel) return;
    const member = await db.member.findUnique({
      where: { userId_serverId: { userId: uid, serverId: root.channel.serverId } },
      select: { id: true },
    });
    if (!member) return;
    await socket.join(`thread:${rootId}`);
  });
  socket.on("thread:leave", (rootId: string) => {
    if (typeof rootId === "string" && rootId) {
      void socket.leave(`thread:${rootId}`);
    }
  });

  // DM rooms — frontend подписывается на dm:${conversationId} когда открывает.
  // Backend verify ownership (user — участник этого conversation).
  socket.on("dm:join", async (conversationId: string) => {
    const uid = (socket.data as { userId: string | null | undefined }).userId;
    if (!uid || typeof conversationId !== "string" || !conversationId) return;
    const convo = await db.directConversation.findUnique({
      where: { id: conversationId },
      select: { userAId: true, userBId: true },
    });
    if (!convo) return;
    if (convo.userAId !== uid && convo.userBId !== uid) return;
    await socket.join(`dm:${conversationId}`);
  });
  socket.on("dm:leave", (conversationId: string) => {
    if (typeof conversationId === "string" && conversationId) {
      void socket.leave(`dm:${conversationId}`);
    }
  });

  // typing:start / typing:stop — ephemeral, без DB. Broadcast в channel-room
  // ИСКЛЮЧАЯ sender (socket.to(...) вместо io.to(...)). User identity берётся
  // из socket.data — нельзя spoof'нуть.
  socket.on("typing:start", async (channelId: string) => {
    const uid = (socket.data as { userId: string | null | undefined }).userId;
    if (!uid || typeof channelId !== "string" || !channelId) return;
    // Prefetch displayName из БД один раз (на typing event'е — небольшой overhead;
    // если будет узкое место — кешировать на socket.data при connect)
    const user = await db.user.findUnique({
      where: { id: uid },
      select: { displayName: true },
    });
    if (!user) return;
    socket.to(`channel:${channelId}`).emit("typing:start", {
      channelId,
      userId: uid,
      displayName: user.displayName,
    });
  });
  socket.on("typing:stop", (channelId: string) => {
    const uid = (socket.data as { userId: string | null | undefined }).userId;
    if (!uid || typeof channelId !== "string" || !channelId) return;
    socket.to(`channel:${channelId}`).emit("typing:stop", {
      channelId,
      userId: uid,
    });
  });

  // ===== Voice presence =====
  // Frontend emits 'voice:join' после успешного LiveKit Room.connect().
  // Verify membership и channel.type === VOICE — иначе spoof'ить можно с лёгкостью.
  socket.on(
    "voice:join",
    async (payload: { channelId: string }, cb?: (err: string | null) => void) => {
      const uid = (socket.data as { userId: string | null | undefined }).userId;
      if (!uid) {
        cb?.("Unauthorized");
        return;
      }
      const channelId = payload?.channelId;
      if (typeof channelId !== "string" || !channelId) {
        cb?.("Bad channelId");
        return;
      }
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, type: true, serverId: true },
      });
      if (!channel || channel.type !== "VOICE") {
        cb?.("Channel not found or not VOICE");
        return;
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId: uid, serverId: channel.serverId } },
        select: { id: true },
      });
      if (!member) {
        cb?.("Not a member");
        return;
      }
      trackVoiceJoin(socket.id, uid, channel.id, channel.serverId);
      cb?.(null);
    },
  );

  socket.on("voice:leave", () => {
    trackVoiceLeave(socket.id);
  });

  // Клиент переключил микрофон / звук — обновляем meta и рассылаем дельту
  // всем участникам сервера (Discord-style mute/deafen-иконки в sidebar).
  socket.on(
    "voice:meta:update",
    (payload: { micMuted?: unknown; deafened?: unknown }) => {
      if (!payload || typeof payload !== "object") return;
      updateVoiceMeta(socket.id, {
        micMuted: typeof payload.micMuted === "boolean" ? payload.micMuted : undefined,
        deafened: typeof payload.deafened === "boolean" ? payload.deafened : undefined,
      });
    },
  );

  // Клиент начал/перестал говорить — рассылаем дельту участникам сервера,
  // чтобы speaking-glow был виден во всех voice-каналах sidebar.
  socket.on("voice:speaking:update", (payload: { speaking?: unknown }) => {
    if (!payload || typeof payload !== "object") return;
    broadcastSpeaking(socket.id, Boolean(payload.speaking));
  });

  socket.on("disconnect", () => {
    if (userId) {
      trackDisconnect(userId, socket.id);
    }
    // Auto-cleanup voice presence (если socket crashed/closed без явного leave).
    trackVoiceLeave(socket.id);
  });
});

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info({ port }, "Server + Socket.io");

  // Keep-alive ping для Neon free tier (Scales to zero после ~5 минут idle).
  // Без этого Neon рвёт connection и каждый запрос имеет 20-сек cold start.
  // На native PG (prod) этот ping безвреден, лишний `SELECT 1` каждую минуту.
  setInterval(() => {
    db.$queryRaw`SELECT 1`.catch((err) => {
      app.log.warn({ err }, "DB keepalive failed (auto-retry on next request)");
    });
  }, 60_000);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
