import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  generateLivekitToken,
  getLivekitConfig,
  roomNameForChannel,
} from "../livekit.js";
import { canAccessRealtimeChannel } from "../lib/realtimeAccess.js";

export const VOICE_TOKEN_TTL_SECONDS = 5 * 60;
export const VOICE_TOKEN_RATE_LIMIT = 20;
const VOICE_TOKEN_RATE_WINDOW_MS = 60_000;
const MAX_TRACKED_VOICE_USERS = 10_000;

/**
 * Voice channel JWT issuance.
 *
 *   POST /api/channels/:id/voice/join
 *     - проверка: channel exists, type === VOICE, user is member
 *     - LIVEKIT_API_KEY/SECRET/WS_URL должны быть в env, иначе 503
 *     - возвращает { wsUrl, token, roomName, identity }
 *
 * Frontend передаёт wsUrl + token в `livekit-client` `Room.connect()`.
 */
export async function registerVoiceRoutes(app: FastifyInstance) {
  const tokenWindows = new Map<string, { startedAt: number; count: number }>();
  const consumeTokenAttempt = (userId: string, now = Date.now()): boolean => {
    const current = tokenWindows.get(userId);
    if (!current || now - current.startedAt >= VOICE_TOKEN_RATE_WINDOW_MS) {
      if (!current && tokenWindows.size >= MAX_TRACKED_VOICE_USERS) {
        for (const [key, value] of tokenWindows) {
          if (now - value.startedAt >= VOICE_TOKEN_RATE_WINDOW_MS) tokenWindows.delete(key);
        }
        if (tokenWindows.size >= MAX_TRACKED_VOICE_USERS) return false;
      }
      tokenWindows.set(userId, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= VOICE_TOKEN_RATE_LIMIT) return false;
    current.count += 1;
    return true;
  };
  app.post(
    "/api/channels/:id/voice/join",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: channelId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      if (!consumeTokenAttempt(userId)) {
        return reply.header("retry-after", "60").status(429).send({
          error: "Too many voice join attempts",
        });
      }
      const cfg = getLivekitConfig();
      if (!cfg) {
        return reply.status(503).send({
          error: "Voice service not configured",
          hint: "Server admin: set LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_WS_URL in apps/server/.env",
        });
      }
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: {
          id: true,
          type: true,
          serverId: true,
          name: true,
          internal: true,
          server: { select: { mode: true } },
        },
      });
      if (!channel) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      if (channel.type !== "VOICE") {
        return reply.status(400).send({ error: "Channel is not a voice channel" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: channel.serverId } },
        select: { id: true, role: true },
      });
      if (
        !member ||
        !canAccessRealtimeChannel(channel.server.mode, channel.internal, member.role)
      ) {
        return reply.status(403).send({ error: "Channel access denied" });
      }
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, avatar: true },
      });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      const roomName = roomNameForChannel(channelId);
      const livekitIdentity = `${user.id}:${randomUUID()}`;
      const participantMetadata = JSON.stringify({
        userId: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
      });
      const token = generateLivekitToken(
        {
          identity: livekitIdentity,
          name: user.displayName,
          metadata: participantMetadata,
          room: roomName,
          ttlSeconds: VOICE_TOKEN_TTL_SECONDS,
          canPublishData: false,
        },
        cfg,
      );
      return {
        wsUrl: cfg.wsUrl,
        token,
        roomName,
        identity: user.id,
        livekitIdentity,
        metadata: {
          displayName: user.displayName,
          avatar: user.avatar,
        },
      };
    },
  );

  /**
   * GET /api/voice/health — проверка что LiveKit env настроен.
   * Frontend может использовать для conditional rendering VoiceRoom vs
   * VoicePlaceholder.
   */
  app.get("/api/voice/health", async () => {
    const cfg = getLivekitConfig();
    return {
      enabled: cfg != null,
      wsUrl: cfg?.wsUrl ?? null,
    };
  });
}
