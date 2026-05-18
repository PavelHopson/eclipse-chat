import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { emitVoiceNoteUpdated } from "../realtime.js";

/**
 * v0.88 #23 phase 1a — Voice room shared notepad routes.
 *
 *   GET   /api/channels/:id/voice-note  — read current state (creates empty
 *                                          row если ещё нет).
 *   PATCH /api/channels/:id/voice-note  — update content. Optimistic concurrency
 *                                          через `baseVersion`. Conflict → 409
 *                                          с current state.
 *
 * Phase 1a model: last-writer-wins с version counter. Two clients editing
 * simultaneously без CRDT — один потеряет diff. Документировано в schema.
 * Phase 1b (Yjs CRDT) — когда npm registry перестанет отказывать в yjs.
 *
 * Permission: VOICE channel + member of server. Notepad doesn't сохраняется
 * для не-voice каналов (return 400). Содержимое плотное (text/markdown), cap
 * 100KB чтобы избежать abuse.
 *
 * Realtime: socket-room `channel:${channelId}` получает `voice-note:updated`.
 */

const updateBody = z.object({
  content: z.string().max(100_000),
  baseVersion: z.number().int().min(0).max(1_000_000_000),
});

export function registerVoiceNoteRoutes(app: FastifyInstance) {
  /** Read or auto-create empty doc для VOICE channel. */
  app.get(
    "/api/channels/:id/voice-note",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, type: true, serverId: true },
      });
      if (!channel) return reply.status(404).send({ error: "Channel not found" });
      if (channel.type !== "VOICE") {
        return reply.status(400).send({ error: "Voice notes — только для VOICE каналов" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: channel.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      let note = await db.voiceNote.findUnique({
        where: { channelId },
        select: {
          channelId: true,
          content: true,
          version: true,
          lastEditorUserId: true,
          updatedAt: true,
          lastEditor: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      if (!note) {
        const created = await db.voiceNote.create({
          data: { channelId },
          select: {
            channelId: true,
            content: true,
            version: true,
            lastEditorUserId: true,
            updatedAt: true,
            lastEditor: { select: { id: true, displayName: true, avatar: true } },
          },
        });
        note = created;
      }
      return {
        channelId: note.channelId,
        content: note.content,
        version: note.version,
        lastEditorUserId: note.lastEditorUserId,
        lastEditor: note.lastEditor,
        updatedAt: note.updatedAt.toISOString(),
      };
    },
  );

  /** Update content (optimistic concurrency). Conflict → 409 + current state. */
  app.patch(
    "/api/channels/:id/voice-note",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      const parsed = updateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, type: true, serverId: true },
      });
      if (!channel) return reply.status(404).send({ error: "Channel not found" });
      if (channel.type !== "VOICE") {
        return reply.status(400).send({ error: "Voice notes — только для VOICE каналов" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: channel.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      // Upsert pattern: get current, version-check, save.
      const current = await db.voiceNote.findUnique({
        where: { channelId },
        select: { version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (parsed.data.baseVersion !== currentVersion) {
        // Conflict — return current state.
        const fresh = await db.voiceNote.findUnique({
          where: { channelId },
          select: {
            channelId: true,
            content: true,
            version: true,
            lastEditorUserId: true,
            updatedAt: true,
            lastEditor: { select: { id: true, displayName: true, avatar: true } },
          },
        });
        return reply.status(409).send({
          error: "Conflict: someone else edited the note",
          current: fresh
            ? {
                channelId: fresh.channelId,
                content: fresh.content,
                version: fresh.version,
                lastEditorUserId: fresh.lastEditorUserId,
                lastEditor: fresh.lastEditor,
                updatedAt: fresh.updatedAt.toISOString(),
              }
            : null,
        });
      }
      const updated = await db.voiceNote.upsert({
        where: { channelId },
        create: {
          channelId,
          content: parsed.data.content,
          version: 1,
          lastEditorUserId: userId,
        },
        update: {
          content: parsed.data.content,
          version: { increment: 1 },
          lastEditorUserId: userId,
        },
        select: {
          channelId: true,
          content: true,
          version: true,
          lastEditorUserId: true,
          updatedAt: true,
          lastEditor: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      emitVoiceNoteUpdated(channelId, {
        channelId: updated.channelId,
        content: updated.content,
        version: updated.version,
        lastEditorUserId: updated.lastEditorUserId,
        lastEditorDisplayName: updated.lastEditor?.displayName ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      });
      return {
        channelId: updated.channelId,
        content: updated.content,
        version: updated.version,
        lastEditorUserId: updated.lastEditorUserId,
        lastEditor: updated.lastEditor,
        updatedAt: updated.updatedAt.toISOString(),
      };
    },
  );
}
