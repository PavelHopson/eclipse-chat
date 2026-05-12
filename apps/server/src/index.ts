import "dotenv/config";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import { Server as SocketServer } from "socket.io";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerDmRoutes } from "./routes/dm.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerServerRoutes } from "./routes/servers.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerVoiceRoutes } from "./routes/voice.js";
import { setSocketIO } from "./realtime.js";
import { registerSocketAuth } from "./auth/socketAuth.js";
import { setPresenceIO, trackConnect, trackDisconnect } from "./presence.js";
import {
  setVoicePresenceIO,
  snapshotForServer,
  trackVoiceJoin,
  trackVoiceLeave,
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
app.get("/api/version", async () => ({ name: "@eclipse-chat/server", version: "0.5.0" }));

await registerAuthRoutes(app);
await registerChannelRoutes(app);
await registerServerRoutes(app);
await registerUserRoutes(app);
await registerMessageRoutes(app);
await registerVoiceRoutes(app);
await registerDmRoutes(app);
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

/** Снимок voice presence для всех channels на серверах user'а. */
async function buildVoicePresenceSnapshot(userId: string): Promise<Record<string, string[]>> {
  const memberships = await db.member.findMany({
    where: { userId },
    select: { serverId: true },
  });
  if (memberships.length === 0) return {};
  const channels = await db.channel.findMany({
    where: { serverId: { in: memberships.map((m) => m.serverId) }, type: "VOICE" },
    select: { id: true },
  });
  return snapshotForServer(channels.map((c) => c.id));
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
        if (snap) socket.emit("voice:state", snap);
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
