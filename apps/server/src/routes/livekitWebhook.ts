import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import {
  channelIdFromLivekitRoom,
  getLivekitConfig,
  removeLivekitParticipant,
  userIdFromLivekitIdentity,
  verifyLivekitWebhook,
  type LivekitConfig,
  type LivekitWebhookEvent,
} from "../livekit.js";
import { canAccessRealtimeChannel } from "../lib/realtimeAccess.js";

export const LIVEKIT_WEBHOOK_BODY_LIMIT = 64 * 1024;

type ChannelAccess = {
  id: string;
  type: string;
  serverId: string;
  internal: boolean;
  server: { mode: "ENGINEERING" | "CLIENT" };
};

type LivekitWebhookDependencies = {
  config: () => LivekitConfig | null;
  findChannel: (channelId: string) => Promise<ChannelAccess | null>;
  findMemberRole: (userId: string, serverId: string) => Promise<string | null>;
  removeParticipant: (room: string, identity: string, cfg: LivekitConfig) => Promise<boolean>;
};

const defaultDependencies: LivekitWebhookDependencies = {
  config: getLivekitConfig,
  findChannel: async (channelId) => db.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      type: true,
      serverId: true,
      internal: true,
      server: { select: { mode: true } },
    },
  }),
  findMemberRole: async (userId, serverId) => {
    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
      select: { role: true },
    });
    return member?.role ?? null;
  },
  removeParticipant: (room, identity, cfg) => removeLivekitParticipant(room, identity, cfg),
};

function boundedText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

function metadataMatchesUser(metadata: unknown, userId: string): boolean {
  if (typeof metadata !== "string" || metadata.length === 0 || metadata.length > 4096) return false;
  try {
    const parsed: unknown = JSON.parse(metadata);
    return Boolean(
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      (parsed as { userId?: unknown }).userId === userId,
    );
  } catch {
    return false;
  }
}

export async function registerLivekitWebhookRoutes(
  app: FastifyInstance,
  dependencies: Partial<LivekitWebhookDependencies> = {},
) {
  const deps = { ...defaultDependencies, ...dependencies };
  app.post(
    "/api/webhooks/livekit",
    {
      bodyLimit: LIVEKIT_WEBHOOK_BODY_LIMIT,
      config: { rateLimit: { max: 180, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const cfg = deps.config();
      if (!cfg) return reply.status(503).send({ error: "Voice service unavailable" });

      const rawBody = (req as typeof req & { rawBody?: string }).rawBody ?? "";
      const authorization = typeof req.headers.authorization === "string"
        ? req.headers.authorization
        : "";
      let event: LivekitWebhookEvent;
      try {
        event = verifyLivekitWebhook(rawBody, authorization, cfg);
      } catch {
        req.log.warn({ reason: "signature" }, "Rejected LiveKit webhook");
        return reply.status(401).send({ error: "Invalid webhook signature" });
      }

      if (event.event !== "participant_joined") return reply.status(204).send();

      const eventId = boundedText(event.id, 160) ?? "unknown";
      const room = boundedText(event.room?.name, 256);
      const identity = boundedText(event.participant?.identity, 256);
      if (!room || !identity) {
        req.log.warn({ eventId, reason: "coordinates" }, "Rejected LiveKit participant event");
        return reply.status(400).send({ error: "Invalid participant event" });
      }

      const deny = async (reason: string) => {
        try {
          await deps.removeParticipant(room, identity, cfg);
          req.log.warn({ eventId, reason }, "Removed unauthorized LiveKit participant");
          return reply.status(200).send({ ok: true, action: "removed" });
        } catch {
          req.log.error({ eventId, reason }, "Failed to remove unauthorized LiveKit participant");
          return reply.status(503).send({ error: "Voice authorization unavailable" });
        }
      };

      const channelId = channelIdFromLivekitRoom(room);
      const userId = userIdFromLivekitIdentity(identity);
      if (!channelId || !userId || !metadataMatchesUser(event.participant?.metadata, userId)) {
        return deny("identity_or_room");
      }

      try {
        const channel = await deps.findChannel(channelId);
        if (!channel || channel.id !== channelId || channel.type !== "VOICE") {
          return deny("channel");
        }
        const role = await deps.findMemberRole(userId, channel.serverId);
        if (
          !role ||
          !canAccessRealtimeChannel(
            channel.server.mode,
            channel.internal,
            role as Parameters<typeof canAccessRealtimeChannel>[2],
          )
        ) {
          return deny("acl");
        }
      } catch {
        return deny("acl_lookup");
      }

      return reply.status(204).send();
    },
  );
}
