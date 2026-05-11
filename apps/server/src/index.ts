import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { Server as SocketServer } from "socket.io";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerServerRoutes } from "./routes/servers.js";
import { setSocketIO } from "./realtime.js";
import { registerSocketAuth } from "./auth/socketAuth.js";
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
app.get("/api/version", async () => ({ name: "@eclipse-chat/server", version: "0.4.0" }));

await registerAuthRoutes(app);
await registerChannelRoutes(app);
await registerServerRoutes(app);
await app.ready();

/* Socket.io: тот же HTTP-сервер, что и у Fastify */
const io = new SocketServer(app.server, {
  path: "/socket.io",
  cors: { origin: corsOrigin, methods: ["GET", "POST"] },
});
setSocketIO(io);
registerSocketAuth(io, resolvedJwtSecret);

/** Авто-подписка авторизованного сокета на все его server-комнаты. */
async function subscribeToUserServers(socket: import("socket.io").Socket, userId: string) {
  const memberships = await db.member.findMany({
    where: { userId },
    select: { serverId: true },
  });
  for (const m of memberships) {
    await socket.join(`server:${m.serverId}`);
  }
}

io.on("connection", (socket) => {
  socket.emit("server:hello", { t: Date.now(), msg: "Eclipse Chat" });

  const userId = (socket.data as { userId: string | null | undefined }).userId;
  if (userId) {
    void subscribeToUserServers(socket, userId).catch((err) => {
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
});

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info({ port }, "Server + Socket.io");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
