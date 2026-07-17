import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  generateLivekitToken,
  getLivekitConfig,
  roomNameForChannel,
} from "../livekit.js";

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
  app.post(
    "/api/channels/:id/voice/join",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: channelId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
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
        select: { id: true, type: true, serverId: true, name: true },
      });
      if (!channel) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      if (channel.type !== "VOICE") {
        return reply.status(400).send({ error: "Channel is not a voice channel" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: channel.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
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
