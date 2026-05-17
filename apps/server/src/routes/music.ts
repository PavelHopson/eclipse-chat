import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { emitMusicSessionUpdated } from "../realtime.js";

/**
 * Shared listening room (v0.61) — синхронный audio playback на канале.
 *
 * Endpoints:
 *   GET    /api/channels/:id/music              — текущее состояние или null
 *   POST   /api/channels/:id/music/start        — start новый track
 *                                                 (body: { attachmentId })
 *                                                 Если session уже есть и в
 *                                                 ней есть host — replace track.
 *   POST   /api/channels/:id/music/pause        — host / MOD+
 *   POST   /api/channels/:id/music/resume       — host / MOD+
 *   POST   /api/channels/:id/music/skip         — host / MOD+ → next in queue
 *                                                 или stop если очередь пуста.
 *   POST   /api/channels/:id/music/stop         — host / MOD+; delete session
 *   POST   /api/channels/:id/music/queue        — body: { attachmentId },
 *                                                 любой member.
 *
 * Permissions: member-only для всего. Host + MOD+ роли для destructive
 * операций. Source треков — audio attachments в любом сообщении того же
 * сервера (не только из этого канала — позволяет переслать voice-сообщение
 * из DM и поставить его в очередь).
 */

const startBody = z.object({
  attachmentId: z.string().min(1),
});

const queueBody = z.object({
  attachmentId: z.string().min(1),
});

async function loadChannelMembership(userId: string, channelId: string) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, serverId: true, type: true },
  });
  if (!channel) return { error: "Channel not found" as const };
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId: channel.serverId } },
    select: { id: true, role: true },
  });
  if (!member) return { error: "Not a member of this server" as const };
  return { channel, member };
}

function isMod(role: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER") {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

type ChannelMembership = NonNullable<
  Awaited<ReturnType<typeof loadChannelMembership>>["channel"]
>;

/**
 * Проверяет что audio-attachment существует, принадлежит тому же серверу
 * (через message → channel.serverId) и mime audio/*.
 */
async function loadAudioAttachment(attachmentId: string, serverId: string) {
  const att = await db.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      url: true,
      thumbnailUrl: true,
      size: true,
      message: {
        select: {
          channel: { select: { serverId: true } },
        },
      },
    },
  });
  if (!att) return null;
  if (!att.mimeType.startsWith("audio/")) return null;
  // Attachment может быть в DM (att.message.channel = null) или в server-канале.
  // Принимаем только server attachments из этого же сервера — DM tracks
  // не делимся (privacy).
  const attServerId = att.message?.channel?.serverId;
  if (attServerId !== serverId) return null;
  return att;
}

function parseQueue(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

const sessionInclude = {
  currentTrack: {
    select: {
      id: true,
      filename: true,
      mimeType: true,
      url: true,
      thumbnailUrl: true,
      size: true,
      transcript: true,
      transcriptStatus: true,
    },
  },
  host: {
    select: { id: true, displayName: true, avatar: true },
  },
} as const;

type SerializedSession = ReturnType<typeof serializeSession>;

function serializeSession(s: {
  id: string;
  channelId: string;
  currentTrackAttachmentId: string | null;
  currentTrack: {
    id: string;
    filename: string;
    mimeType: string;
    url: string;
    thumbnailUrl: string | null;
    size: number;
  } | null;
  startedAt: Date | null;
  positionMs: number;
  isPlaying: boolean;
  queue: string;
  hostUserId: string;
  host: { id: string; displayName: string; avatar: string | null };
  updatedAt: Date;
}) {
  return {
    id: s.id,
    channelId: s.channelId,
    currentTrack: s.currentTrack
      ? {
          id: s.currentTrack.id,
          filename: s.currentTrack.filename,
          mimeType: s.currentTrack.mimeType,
          url: s.currentTrack.url,
          thumbnailUrl: s.currentTrack.thumbnailUrl,
          size: s.currentTrack.size,
        }
      : null,
    startedAt: s.startedAt?.toISOString() ?? null,
    positionMs: s.positionMs,
    isPlaying: s.isPlaying,
    queue: parseQueue(s.queue),
    host: {
      id: s.host.id,
      displayName: s.host.displayName,
      avatar: s.host.avatar,
    },
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function registerMusicRoutes(app: FastifyInstance) {
  /** GET state — null если сессии нет. */
  app.get(
    "/api/channels/:id/music",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const ctx = await loadChannelMembership(userId, channelId);
      if ("error" in ctx) {
        return reply.status(ctx.error === "Channel not found" ? 404 : 403).send({
          error: ctx.error,
        });
      }
      const session = await db.musicSession.findUnique({
        where: { channelId },
        include: sessionInclude,
      });
      return { session: session ? serializeSession(session) : null };
    },
  );

  /** POST start — start новый track. Создаёт session если нет, replace
   *  current track если есть (host берёт control). */
  app.post(
    "/api/channels/:id/music/start",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const parsed = startBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const ctx = await loadChannelMembership(userId, channelId);
      if ("error" in ctx) {
        return reply.status(ctx.error === "Channel not found" ? 404 : 403).send({
          error: ctx.error,
        });
      }
      if (ctx.channel.type === "VOICE") {
        return reply.status(400).send({
          error:
            "Voice channels не поддерживают music session в v1 (используется LiveKit pipeline).",
        });
      }
      const track = await loadAudioAttachment(
        parsed.data.attachmentId,
        ctx.channel.serverId,
      );
      if (!track) {
        return reply.status(400).send({
          error: "Audio attachment not found или не принадлежит этому пространству",
        });
      }
      const now = new Date();
      const session = await db.musicSession.upsert({
        where: { channelId },
        update: {
          currentTrackAttachmentId: track.id,
          startedAt: now,
          positionMs: 0,
          isPlaying: true,
          hostUserId: userId,
        },
        create: {
          channelId,
          currentTrackAttachmentId: track.id,
          startedAt: now,
          positionMs: 0,
          isPlaying: true,
          queue: "[]",
          hostUserId: userId,
        },
        include: sessionInclude,
      });
      const payload = serializeSession(session);
      emitMusicSessionUpdated(channelId, payload);
      return { session: payload };
    },
  );

  /** POST pause — host / MOD+. Saved position = elapsed since startedAt. */
  app.post(
    "/api/channels/:id/music/pause",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const ctx = await loadChannelMembership(userId, channelId);
      if ("error" in ctx) {
        return reply.status(ctx.error === "Channel not found" ? 404 : 403).send({
          error: ctx.error,
        });
      }
      const session = await db.musicSession.findUnique({
        where: { channelId },
        include: sessionInclude,
      });
      if (!session) {
        return reply.status(404).send({ error: "No active session" });
      }
      if (session.hostUserId !== userId && !isMod(ctx.member.role)) {
        return reply.status(403).send({ error: "Only host or moderator can pause" });
      }
      if (!session.isPlaying) {
        // Idempotent — уже paused.
        return { session: serializeSession(session) };
      }
      const elapsed = session.startedAt
        ? Date.now() - session.startedAt.getTime()
        : 0;
      const updated = await db.musicSession.update({
        where: { channelId },
        data: {
          isPlaying: false,
          startedAt: null,
          positionMs: session.positionMs + Math.max(0, elapsed),
        },
        include: sessionInclude,
      });
      const payload = serializeSession(updated);
      emitMusicSessionUpdated(channelId, payload);
      return { session: payload };
    },
  );

  /** POST resume. */
  app.post(
    "/api/channels/:id/music/resume",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const ctx = await loadChannelMembership(userId, channelId);
      if ("error" in ctx) {
        return reply.status(ctx.error === "Channel not found" ? 404 : 403).send({
          error: ctx.error,
        });
      }
      const session = await db.musicSession.findUnique({
        where: { channelId },
        include: sessionInclude,
      });
      if (!session) {
        return reply.status(404).send({ error: "No active session" });
      }
      if (session.hostUserId !== userId && !isMod(ctx.member.role)) {
        return reply.status(403).send({ error: "Only host or moderator can resume" });
      }
      if (session.isPlaying) {
        return { session: serializeSession(session) };
      }
      if (!session.currentTrackAttachmentId) {
        return reply.status(400).send({ error: "Нет текущего трека" });
      }
      const updated = await db.musicSession.update({
        where: { channelId },
        data: {
          isPlaying: true,
          startedAt: new Date(),
        },
        include: sessionInclude,
      });
      const payload = serializeSession(updated);
      emitMusicSessionUpdated(channelId, payload);
      return { session: payload };
    },
  );

  /** POST skip — next track из queue, либо stop если очередь пуста. */
  app.post(
    "/api/channels/:id/music/skip",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const ctx = await loadChannelMembership(userId, channelId);
      if ("error" in ctx) {
        return reply.status(ctx.error === "Channel not found" ? 404 : 403).send({
          error: ctx.error,
        });
      }
      const session = await db.musicSession.findUnique({
        where: { channelId },
      });
      if (!session) return reply.status(404).send({ error: "No active session" });
      if (session.hostUserId !== userId && !isMod(ctx.member.role)) {
        return reply.status(403).send({ error: "Only host or moderator can skip" });
      }
      const queue = parseQueue(session.queue);
      if (queue.length === 0) {
        // Нет следующего — drop session.
        await db.musicSession.delete({ where: { channelId } });
        emitMusicSessionUpdated(channelId, null);
        return { session: null };
      }
      const nextId = queue[0];
      const nextQueue = queue.slice(1);
      const track = await loadAudioAttachment(nextId, ctx.channel.serverId);
      if (!track) {
        // Битый id в очереди — skip его и пробуем дальше.
        await db.musicSession.update({
          where: { channelId },
          data: { queue: JSON.stringify(nextQueue) },
        });
        return reply.status(409).send({
          error: "Следующий трек недоступен, попробуй ещё раз skip",
        });
      }
      const now = new Date();
      const updated = await db.musicSession.update({
        where: { channelId },
        data: {
          currentTrackAttachmentId: track.id,
          startedAt: now,
          positionMs: 0,
          isPlaying: true,
          queue: JSON.stringify(nextQueue),
        },
        include: sessionInclude,
      });
      const payload = serializeSession(updated);
      emitMusicSessionUpdated(channelId, payload);
      return { session: payload };
    },
  );

  /** POST stop — drop session, всем уведомление. */
  app.post(
    "/api/channels/:id/music/stop",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const ctx = await loadChannelMembership(userId, channelId);
      if ("error" in ctx) {
        return reply.status(ctx.error === "Channel not found" ? 404 : 403).send({
          error: ctx.error,
        });
      }
      const session = await db.musicSession.findUnique({
        where: { channelId },
        select: { hostUserId: true },
      });
      if (!session) return { ok: true, alreadyStopped: true };
      if (session.hostUserId !== userId && !isMod(ctx.member.role)) {
        return reply.status(403).send({ error: "Only host or moderator can stop" });
      }
      await db.musicSession.delete({ where: { channelId } });
      emitMusicSessionUpdated(channelId, null);
      return { ok: true };
    },
  );

  /** POST queue add — любой member. Если session нет, создаёт её PAUSED
   *  с этим треком как current (вместо отдельного «start»). */
  app.post(
    "/api/channels/:id/music/queue",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const parsed = queueBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const ctx = await loadChannelMembership(userId, channelId);
      if ("error" in ctx) {
        return reply.status(ctx.error === "Channel not found" ? 404 : 403).send({
          error: ctx.error,
        });
      }
      const track = await loadAudioAttachment(
        parsed.data.attachmentId,
        ctx.channel.serverId,
      );
      if (!track) {
        return reply.status(400).send({
          error: "Audio attachment not found или не принадлежит этому пространству",
        });
      }
      const existing = await db.musicSession.findUnique({
        where: { channelId },
      });
      if (!existing) {
        // Создаём session как «paused с queue», не auto-start — пусть кто-то
        // явно жмёт play. Это безопаснее для UX (queue add ≠ start playback
        // другим участникам без их участия).
        const created = await db.musicSession.create({
          data: {
            channelId,
            currentTrackAttachmentId: track.id,
            startedAt: null,
            positionMs: 0,
            isPlaying: false,
            queue: "[]",
            hostUserId: userId,
          },
          include: sessionInclude,
        });
        const payload = serializeSession(created);
        emitMusicSessionUpdated(channelId, payload);
        return { session: payload };
      }
      const queue = parseQueue(existing.queue);
      // Avoid duplicate consecutive entries.
      if (queue[queue.length - 1] === track.id) {
        return reply.status(409).send({ error: "Этот трек уже последний в очереди" });
      }
      queue.push(track.id);
      const updated = await db.musicSession.update({
        where: { channelId },
        data: { queue: JSON.stringify(queue) },
        include: sessionInclude,
      });
      const payload = serializeSession(updated);
      emitMusicSessionUpdated(channelId, payload);
      return { session: payload };
    },
  );
}

export type { SerializedSession as MusicSessionPayload };
