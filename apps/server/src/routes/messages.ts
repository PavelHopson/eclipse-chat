import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  emitMessageDeleted,
  emitMessagePinned,
  emitMessageUnpinned,
  emitMessageUpdated,
} from "../realtime.js";

const editBody = z.object({
  content: z.string().min(1).max(8000),
});

const DELETED_PLACEHOLDER = "[сообщение удалено]";

/**
 * Message lifecycle routes — edit / soft-delete / pin / unpin / get-pinned.
 *
 * Permissions:
 *  - edit:        только автор
 *  - delete:      автор ИЛИ OWNER / ADMIN / MODERATOR сервера
 *  - pin/unpin:   только OWNER / ADMIN / MODERATOR сервера
 */
export async function registerMessageRoutes(app: FastifyInstance) {
  /**
   * GET /api/channels/:id/pinned — текущий список pinned-сообщений
   * канала. Возвращает в порядке pinnedAt desc (новые pin'ы сверху).
   */
  app.get(
    "/api/channels/:id/pinned",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: channelId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const ch = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true },
      });
      if (!ch) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: ch.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const pinned = await db.message.findMany({
        where: { channelId, pinnedAt: { not: null } },
        orderBy: { pinnedAt: "desc" },
        include: { user: { select: { id: true, displayName: true, avatar: true } } },
      });
      return {
        pinned: pinned.map((m) => ({
          id: m.id,
          content: m.deletedAt ? DELETED_PLACEHOLDER : m.content,
          createdAt: m.createdAt.toISOString(),
          editedAt: m.editedAt?.toISOString() ?? null,
          deletedAt: m.deletedAt?.toISOString() ?? null,
          pinnedAt: m.pinnedAt?.toISOString() ?? null,
          user: { id: m.user.id, displayName: m.user.displayName, avatar: m.user.avatar },
        })),
      };
    },
  );

  /**
   * PATCH /api/messages/:id — редактирование. Только автор.
   * Soft-deleted сообщения нельзя редактировать.
   */
  app.patch(
    "/api/messages/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: messageId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = editBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: { id: true, userId: true, channelId: true, deletedAt: true },
      });
      if (!m) {
        return reply.status(404).send({ error: "Message not found" });
      }
      if (m.userId !== userId) {
        return reply.status(403).send({ error: "Only author can edit" });
      }
      if (m.deletedAt) {
        return reply.status(410).send({ error: "Cannot edit deleted message" });
      }
      const editedAt = new Date();
      const updated = await db.message.update({
        where: { id: messageId },
        data: { content: parsed.data.content, editedAt },
      });
      emitMessageUpdated(m.channelId, {
        messageId,
        channelId: m.channelId,
        content: updated.content,
        editedAt: editedAt.toISOString(),
      });
      return {
        message: {
          id: updated.id,
          content: updated.content,
          editedAt: editedAt.toISOString(),
        },
      };
    },
  );

  /**
   * DELETE /api/messages/:id — soft-delete. Автор может удалять свои;
   * OWNER / ADMIN / MODERATOR сервера могут удалять чужие.
   */
  app.delete(
    "/api/messages/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: messageId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: { id: true, userId: true, channelId: true, deletedAt: true },
      });
      if (!m) {
        return reply.status(404).send({ error: "Message not found" });
      }
      if (m.deletedAt) {
        return { ok: true, alreadyDeleted: true };
      }
      // Проверка прав: автор ИЛИ модерация сервера
      if (m.userId !== userId) {
        const ch = await db.channel.findUnique({
          where: { id: m.channelId },
          select: { serverId: true },
        });
        if (!ch) {
          return reply.status(404).send({ error: "Channel not found" });
        }
        const member = await db.member.findUnique({
          where: { userId_serverId: { userId, serverId: ch.serverId } },
          select: { role: true },
        });
        if (!member || (member.role !== "OWNER" && member.role !== "ADMIN" && member.role !== "MODERATOR")) {
          return reply.status(403).send({ error: "Only author or OWNER/ADMIN/MODERATOR can delete" });
        }
      }
      const deletedAt = new Date();
      // pinned-сообщение → unpin при удалении (чтобы pin-bar не показывал «удалено»)
      await db.message.update({
        where: { id: messageId },
        data: { deletedAt, pinnedAt: null },
      });
      emitMessageDeleted(m.channelId, {
        messageId,
        channelId: m.channelId,
        deletedAt: deletedAt.toISOString(),
      });
      return { ok: true, deletedAt: deletedAt.toISOString() };
    },
  );

  /**
   * POST /api/messages/:id/pin — закрепить. Только OWNER/ADMIN/MODERATOR.
   * Idempotent — повторный pin обновляет pinnedAt.
   */
  app.post(
    "/api/messages/:id/pin",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: messageId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: { id: true, channelId: true, deletedAt: true },
      });
      if (!m) {
        return reply.status(404).send({ error: "Message not found" });
      }
      if (m.deletedAt) {
        return reply.status(410).send({ error: "Cannot pin deleted message" });
      }
      const ch = await db.channel.findUnique({
        where: { id: m.channelId },
        select: { serverId: true },
      });
      if (!ch) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: ch.serverId } },
        select: { role: true },
      });
      if (!member || (member.role !== "OWNER" && member.role !== "ADMIN" && member.role !== "MODERATOR")) {
        return reply.status(403).send({ error: "Only OWNER/ADMIN/MODERATOR can pin" });
      }
      const pinnedAt = new Date();
      await db.message.update({ where: { id: messageId }, data: { pinnedAt } });
      emitMessagePinned(m.channelId, {
        messageId,
        channelId: m.channelId,
        pinnedAt: pinnedAt.toISOString(),
      });
      return { ok: true, pinnedAt: pinnedAt.toISOString() };
    },
  );

  /** DELETE /api/messages/:id/pin — снять закрепление. */
  app.delete(
    "/api/messages/:id/pin",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: messageId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: { id: true, channelId: true },
      });
      if (!m) {
        return reply.status(404).send({ error: "Message not found" });
      }
      const ch = await db.channel.findUnique({
        where: { id: m.channelId },
        select: { serverId: true },
      });
      if (!ch) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: ch.serverId } },
        select: { role: true },
      });
      if (!member || (member.role !== "OWNER" && member.role !== "ADMIN" && member.role !== "MODERATOR")) {
        return reply.status(403).send({ error: "Only OWNER/ADMIN/MODERATOR can unpin" });
      }
      await db.message.update({ where: { id: messageId }, data: { pinnedAt: null } });
      emitMessageUnpinned(m.channelId, { messageId, channelId: m.channelId });
      return { ok: true };
    },
  );
}
