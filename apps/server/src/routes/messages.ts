import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { serializeUser } from "../lib/userView.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  emitDmReactionAdded,
  emitDmReactionRemoved,
  emitMessageDeleted,
  emitMessagePinned,
  emitMessageUnpinned,
  emitMessageUpdated,
  emitReactionAdded,
  emitReactionRemoved,
} from "../realtime.js";
import { unlinkAttachmentFiles } from "../attachments.js";

/** OWNER / ADMIN / MODERATOR могут модерировать (закреплять/удалять чужое).
 * v1.6.96 — вынесено из 3 одинаковых inline-проверок (delete/pin/unpin). */
function isServerModerator(role: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

const editBody = z.object({
  content: z.string().min(1).max(8000),
});

/**
 * Whitelist Unicode эмодзи. Узкий список — гарантирует что в БД не попадёт
 * произвольный Unicode. Расширение списка — отдельным изменением.
 * v1.2.24 — кроме Unicode whitelist допускаются и custom `:shortcode:`,
 * если ряд `Emoji` существует на сервере данного сообщения (см.
 * `validateReactionEmoji` ниже).
 */
const ALLOWED_EMOJI = [
  "👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀",
  "🚀", "💯", "🙏", "👏",
] as const;
const allowedSet = new Set<string>(ALLOWED_EMOJI);

/**
 * Custom-emoji shortcode format: `:[a-z0-9_-]{2,30}:` (см. emojis.ts).
 * Возвращает shortcode без двоеточий, если match; иначе null.
 */
function parseCustomShortcode(emoji: string): string | null {
  const m = /^:([a-z0-9_-]{2,30}):$/.exec(emoji);
  return m ? m[1] : null;
}

/**
 * Validate emoji для reaction:
 *   - Unicode из whitelist → ok.
 *   - `:shortcode:` → есть ли row в Emoji table для serverId.
 *     В DM (serverId=null) custom emoji запрещены.
 */
async function validateReactionEmoji(
  emoji: string,
  serverId: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (allowedSet.has(emoji)) return { ok: true };
  const shortcode = parseCustomShortcode(emoji);
  if (!shortcode) {
    return { ok: false, reason: "Emoji not in allowed list" };
  }
  if (!serverId) {
    return { ok: false, reason: "Custom emoji не разрешены в личных сообщениях" };
  }
  const row = await db.emoji.findUnique({
    where: { serverId_shortcode: { serverId, shortcode } },
    select: { id: true },
  });
  return row
    ? { ok: true }
    : { ok: false, reason: `:${shortcode}: не найден на этом сервере` };
}

const reactionBody = z.object({
  // Базовый shape; реальная server-aware валидация — в route после
  // того как мы знаем serverId сообщения.
  emoji: z.string().min(1).max(64),
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
        // v1.2.9 — deletedAt: null defensively; на самом деле delete-route
        // ставит pinnedAt=null при удалении, так что вряд ли встретится.
        where: { channelId, pinnedAt: { not: null }, deletedAt: null },
        orderBy: { pinnedAt: "desc" },
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
        },
      });
      return {
        pinned: pinned.map((m) => ({
          id: m.id,
          content: m.deletedAt ? DELETED_PLACEHOLDER : m.content,
          createdAt: m.createdAt.toISOString(),
          editedAt: m.editedAt?.toISOString() ?? null,
          deletedAt: m.deletedAt?.toISOString() ?? null,
          pinnedAt: m.pinnedAt?.toISOString() ?? null,
          user: serializeUser(m.user),
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
      if (!m.channelId) {
        return reply.status(400).send({ error: "Use /api/dm/messages/:id for DM messages" });
      }
      if (m.userId !== userId) {
        return reply.status(403).send({ error: "Only author can edit" });
      }
      if (m.deletedAt) {
        return reply.status(410).send({ error: "Cannot edit deleted message" });
      }
      // v1.5.24 — fetch full current content + previous editedAt чтобы
      // сохранить snapshot в MessageEdit перед перезаписью.
      const current = await db.message.findUnique({
        where: { id: messageId },
        select: { content: true, editedAt: true, createdAt: true },
      });
      const editedAt = new Date();
      // Двойной write — snapshot + update — в одной транзакции:
      // failure on UPDATE не оставит orphan snapshot.
      const [, updated] = await db.$transaction([
        db.messageEdit.create({
          data: {
            messageId,
            previousContent: current?.content ?? "",
            // editedAt snapshot'а — момент когда current content СТАЛ
            // current (т.е. previous editedAt или createdAt для первого
            // edit'а). Это позволяет реконструировать timeline в UI.
            editedAt: current?.editedAt ?? current?.createdAt ?? editedAt,
          },
        }),
        db.message.update({
          where: { id: messageId },
          data: { content: parsed.data.content, editedAt },
        }),
      ]);
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
   * v1.5.24 — GET /api/messages/:id/edits — список previous content
   * snapshots. Member-only (проверка channel.serverId → Member lookup).
   * Возвращается newest-first (последнее редактирование в начале).
   */
  app.get(
    "/api/messages/:id/edits",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: messageId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          channelId: true,
          channel: { select: { serverId: true } },
        },
      });
      if (!m || !m.channel) {
        return reply.status(404).send({ error: "Message not found" });
      }
      // Member-only — protect history of messages from non-members.
      const member = await db.member.findUnique({
        where: {
          userId_serverId: { userId, serverId: m.channel.serverId },
        },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member" });
      }
      const edits = await db.messageEdit.findMany({
        where: { messageId },
        orderBy: { editedAt: "desc" },
        select: { id: true, previousContent: true, editedAt: true },
      });
      return {
        edits: edits.map((e) => ({
          id: e.id,
          previousContent: e.previousContent,
          editedAt: e.editedAt.toISOString(),
        })),
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
      if (!m.channelId) {
        return reply.status(400).send({ error: "Use /api/dm/messages/:id for DM messages" });
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
        if (!member || !isServerModerator(member.role)) {
          return reply.status(403).send({ error: "Only author or OWNER/ADMIN/MODERATOR can delete" });
        }
      }
      const deletedAt = new Date();
      // pinned-сообщение → unpin при удалении (чтобы pin-bar не показывал «удалено»)
      await db.message.update({
        where: { id: messageId },
        data: { deletedAt, pinnedAt: null },
      });
      // Cleanup attachment-файлов с disk (best-effort). Прежде чем удалить
      // Attachment rows — соберём urls (потом cascade-delete можно).
      const attachments = await db.attachment.findMany({
        where: { messageId },
        select: { url: true, thumbnailUrl: true },
      });
      if (attachments.length > 0) {
        const urls = attachments.flatMap((a) => [a.url, a.thumbnailUrl]);
        await db.attachment.deleteMany({ where: { messageId } });
        // Best-effort fs cleanup — не блокируем response
        void unlinkAttachmentFiles(urls);
      }
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
      if (!m.channelId) {
        return reply.status(400).send({ error: "Pin is not available for DM messages" });
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
      if (!member || !isServerModerator(member.role)) {
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
      if (!m.channelId) {
        return reply.status(400).send({ error: "Unpin is not available for DM messages" });
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
      if (!member || !isServerModerator(member.role)) {
        return reply.status(403).send({ error: "Only OWNER/ADMIN/MODERATOR can unpin" });
      }
      await db.message.update({ where: { id: messageId }, data: { pinnedAt: null } });
      emitMessageUnpinned(m.channelId, { messageId, channelId: m.channelId });
      return { ok: true };
    },
  );

  /**
   * POST /api/messages/:id/reactions — добавить реакцию. Любой member.
   * Idempotent через unique constraint (messageId, userId, emoji).
   * Запрещено реагировать на soft-deleted сообщения.
   */
  app.post(
    "/api/messages/:id/reactions",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: messageId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = reactionBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid emoji" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          channelId: true,
          conversationId: true,
          deletedAt: true,
          channel: { select: { serverId: true } },
          conversation: { select: { userAId: true, userBId: true } },
        },
      });
      if (!m) {
        return reply.status(404).send({ error: "Message not found" });
      }
      if (m.deletedAt) {
        return reply.status(410).send({ error: "Cannot react to deleted message" });
      }
      // Проверка участия: либо member сервера, либо участник DM
      let serverIdForEmoji: string | null = null;
      if (m.channelId && m.channel) {
        const member = await db.member.findUnique({
          where: { userId_serverId: { userId, serverId: m.channel.serverId } },
          select: { id: true },
        });
        if (!member) {
          return reply.status(403).send({ error: "Not a member of this server" });
        }
        serverIdForEmoji = m.channel.serverId;
      } else if (m.conversationId && m.conversation) {
        const ok =
          m.conversation.userAId === userId || m.conversation.userBId === userId;
        if (!ok) {
          return reply.status(403).send({ error: "Not a participant of this DM" });
        }
      } else {
        return reply.status(500).send({ error: "Orphan message" });
      }
      const { emoji } = parsed.data;
      // v1.2.24: server-aware validation (Unicode whitelist + custom).
      const validation = await validateReactionEmoji(emoji, serverIdForEmoji);
      if (!validation.ok) {
        return reply.status(400).send({ error: validation.reason });
      }
      // upsert через try/catch: повторный POST = same row, не fail
      try {
        await db.reaction.create({
          data: { messageId, userId, emoji },
        });
        if (m.channelId) {
          emitReactionAdded(m.channelId, { messageId, channelId: m.channelId, emoji, userId });
        } else if (m.conversationId) {
          emitDmReactionAdded(m.conversationId, {
            messageId,
            conversationId: m.conversationId,
            emoji,
            userId,
          });
        }
      } catch (err: unknown) {
        // unique violation = уже стоит, idempotent ok
        if (
          err instanceof Error &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          return { ok: true, alreadyExists: true };
        }
        throw err;
      }
      return { ok: true };
    },
  );

  /** DELETE /api/messages/:id/reactions/:emoji — снять свою реакцию. */
  app.delete(
    "/api/messages/:id/reactions/:emoji",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: messageId, emoji: rawEmoji } = req.params as {
        id: string;
        emoji: string;
      };
      const emoji = decodeURIComponent(rawEmoji);
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      // v1.2.24 — на DELETE мягче: shape OK (Unicode whitelist или
      // `:shortcode:` format), полная server-aware проверка не нужна
      // (если row не существует, ниже idempotent {alreadyAbsent}).
      if (!allowedSet.has(emoji) && !parseCustomShortcode(emoji)) {
        return reply.status(400).send({ error: "Emoji not in allowed list" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: { id: true, channelId: true, conversationId: true },
      });
      if (!m) {
        return reply.status(404).send({ error: "Message not found" });
      }
      const existing = await db.reaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
        select: { id: true },
      });
      if (!existing) {
        return { ok: true, alreadyAbsent: true };
      }
      await db.reaction.delete({ where: { id: existing.id } });
      if (m.channelId) {
        emitReactionRemoved(m.channelId, { messageId, channelId: m.channelId, emoji, userId });
      } else if (m.conversationId) {
        emitDmReactionRemoved(m.conversationId, {
          messageId,
          conversationId: m.conversationId,
          emoji,
          userId,
        });
      }
      return { ok: true };
    },
  );
}
