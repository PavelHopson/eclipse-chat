import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  emitDmConversationBumped,
  emitDmMessageDeleted,
  emitDmMessageNew,
  emitDmMessageUpdated,
} from "../realtime.js";
import {
  ATTACHMENTS_PER_MESSAGE,
  MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS,
  processAttachment,
  unlinkAttachmentFiles,
} from "../attachments.js";

/**
 * Direct Messages (DM) — 1-to-1 приватные диалоги.
 *
 * Routes:
 *   GET    /api/dm/conversations                  — мои conversations sorted by lastMessageAt
 *   POST   /api/dm/conversations/:userId          — get-or-create with given user
 *   GET    /api/dm/conversations/:id/messages     — paginated history
 *   POST   /api/dm/conversations/:id/messages     — send (content + attachments)
 *   PATCH  /api/dm/messages/:id                   — edit (author only)
 *   DELETE /api/dm/messages/:id                   — soft-delete (author only — no moderation в DM)
 *
 * Socket rooms:
 *   `dm:${conversationId}` — оба participant'а подписаны на оба моменты,
 *   `user:${userId}` — для `dm:conversation:bumped` (sidebar list resort).
 *
 * Group DMs (3+ users) — будущее v0.8.1 расширение через polymorphic
 * Conversation.members[]. Для MVP — только 1-to-1.
 */

const attachmentInputSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(80),
  dataBase64: z.string().min(1),
});

const sendMessageBody = z.object({
  content: z.string().max(8000).optional().default(""),
  attachments: z.array(attachmentInputSchema).max(ATTACHMENTS_PER_MESSAGE).optional(),
});

const editBody = z.object({
  content: z.string().min(1).max(8000),
});

/**
 * Нормализуем пару user-id'ов в (userAId, userBId) где userA < userB
 * по string comparison. Гарантирует unique constraint работает —
 * иначе «A->B» и «B->A» создались бы как два разных conversation.
 */
function sortIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Кратко-форматированный preview content (для sidebar list). */
function previewContent(content: string, attachmentCount: number): string {
  if (content) {
    return content.length > 80 ? content.slice(0, 77) + "…" : content;
  }
  if (attachmentCount > 0) {
    return `📎 ${attachmentCount} ${attachmentCount === 1 ? "файл" : "файла"}`;
  }
  return "";
}

export async function registerDmRoutes(app: FastifyInstance) {
  /**
   * GET /api/dm/conversations — список моих conversations, sort by lastMessageAt desc.
   */
  app.get("/api/dm/conversations", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const list = await db.directConversation.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        userA: { select: { id: true, displayName: true, avatar: true, status: true } },
        userB: { select: { id: true, displayName: true, avatar: true, status: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            userId: true,
            deletedAt: true,
            attachments: { select: { id: true } },
          },
        },
      },
    });
    return {
      conversations: list.map((c) => {
        const other = c.userAId === userId ? c.userB : c.userA;
        const last = c.messages[0];
        return {
          id: c.id,
          other: {
            id: other.id,
            displayName: other.displayName,
            avatar: other.avatar,
            manualStatus: other.status,
          },
          createdAt: c.createdAt.toISOString(),
          lastMessageAt: c.lastMessageAt.toISOString(),
          lastMessage: last
            ? {
                id: last.id,
                content: last.deletedAt
                  ? "[сообщение удалено]"
                  : previewContent(last.content, last.attachments.length),
                createdAt: last.createdAt.toISOString(),
                userId: last.userId,
                mine: last.userId === userId,
              }
            : null,
        };
      }),
    };
  });

  /**
   * POST /api/dm/conversations/:userId — get-or-create conversation с given user.
   * Idempotent: если уже существует — вернёт существующий.
   * Auto-subscribes socket рrooms.
   */
  app.post(
    "/api/dm/conversations/:userId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { userId: otherId } = req.params as { userId: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      if (me === otherId) {
        return reply.status(400).send({ error: "Cannot DM yourself" });
      }
      const other = await db.user.findUnique({
        where: { id: otherId },
        select: { id: true, displayName: true, avatar: true, status: true },
      });
      if (!other) {
        return reply.status(404).send({ error: "User not found" });
      }
      const [userAId, userBId] = sortIds(me, otherId);
      const convo = await db.directConversation.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
        select: { id: true, createdAt: true, lastMessageAt: true },
      });
      return {
        conversation: {
          id: convo.id,
          createdAt: convo.createdAt.toISOString(),
          lastMessageAt: convo.lastMessageAt.toISOString(),
          other: {
            id: other.id,
            displayName: other.displayName,
            avatar: other.avatar,
            manualStatus: other.status,
          },
        },
      };
    },
  );

  /**
   * GET /api/dm/conversations/:id/messages — пагинация take=N.
   */
  app.get(
    "/api/dm/conversations/:id/messages",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: conversationId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const convo = await db.directConversation.findUnique({
        where: { id: conversationId },
        select: { id: true, userAId: true, userBId: true },
      });
      if (!convo) {
        return reply.status(404).send({ error: "Conversation not found" });
      }
      if (convo.userAId !== me && convo.userBId !== me) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      const take = Math.min(
        100,
        Math.max(1, Number((req.query as { take?: string }).take) || 50),
      );
      const messages = await db.message.findMany({
        where: { conversationId },
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, displayName: true, avatar: true } },
          reactions: { select: { emoji: true, userId: true } },
          attachments: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              size: true,
              url: true,
              width: true,
              height: true,
              thumbnailUrl: true,
              position: true,
            },
            orderBy: { position: "asc" },
          },
        },
      });
      return {
        conversationId,
        messages: messages.reverse().map((m) => {
          const grouped = new Map<string, { count: number; mine: boolean }>();
          for (const r of m.reactions) {
            const cur = grouped.get(r.emoji) ?? { count: 0, mine: false };
            cur.count += 1;
            if (r.userId === me) cur.mine = true;
            grouped.set(r.emoji, cur);
          }
          const reactions = Array.from(grouped.entries()).map(([emoji, agg]) => ({
            emoji,
            count: agg.count,
            mine: agg.mine,
          }));
          return {
            id: m.id,
            content: m.deletedAt ? "" : m.content,
            createdAt: m.createdAt.toISOString(),
            editedAt: m.editedAt?.toISOString() ?? null,
            deletedAt: m.deletedAt?.toISOString() ?? null,
            user: {
              id: m.user.id,
              displayName: m.user.displayName,
              avatar: m.user.avatar,
            },
            reactions,
            attachments: m.deletedAt ? [] : m.attachments,
          };
        }),
      };
    },
  );

  /**
   * POST /api/dm/conversations/:id/messages — отправка.
   * Обновляет conversation.lastMessageAt в транзакции с insert message.
   */
  app.post(
    "/api/dm/conversations/:id/messages",
    {
      onRequest: [requireJwt],
      bodyLimit: MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS,
    },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: conversationId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = sendMessageBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const trimmed = parsed.data.content.trim();
      const attachInputs = parsed.data.attachments ?? [];
      if (trimmed === "" && attachInputs.length === 0) {
        return reply
          .status(400)
          .send({ error: "Message must have content or attachments" });
      }
      const convo = await db.directConversation.findUnique({
        where: { id: conversationId },
        select: { id: true, userAId: true, userBId: true },
      });
      if (!convo) {
        return reply.status(404).send({ error: "Conversation not found" });
      }
      if (convo.userAId !== me && convo.userBId !== me) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      const user = await db.user.findUnique({
        where: { id: me },
        select: { id: true, displayName: true, avatar: true },
      });
      if (!user) {
        return reply.status(401).send({ error: "User not found" });
      }
      // Create message + bump lastMessageAt в одной транзакции (consistency).
      const now = new Date();
      const m = await db.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            content: trimmed,
            userId: me,
            conversationId,
            createdAt: now,
          },
        });
        await tx.directConversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: now },
        });
        return created;
      });
      // Attachments processing — outside transaction (FS I/O slow)
      const processedAttachments = [];
      for (let i = 0; i < attachInputs.length; i++) {
        try {
          const proc = await processAttachment(attachInputs[i], m.id, i);
          const created = await db.attachment.create({
            data: {
              messageId: m.id,
              filename: proc.filename,
              mimeType: proc.mimeType,
              size: proc.size,
              url: proc.url,
              width: proc.width,
              height: proc.height,
              thumbnailUrl: proc.thumbnailUrl,
              position: proc.position,
            },
          });
          processedAttachments.push(created);
        } catch (err) {
          // Откатим message при provoke attachment failure
          await db.message.delete({ where: { id: m.id } });
          const msg = err instanceof Error ? err.message : "Attachment processing failed";
          return reply.status(400).send({ error: msg });
        }
      }
      const payload = {
        messageId: m.id,
        conversationId,
        userId: me,
        displayName: user.displayName,
        avatar: user.avatar,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        attachments: processedAttachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: a.url,
          width: a.width,
          height: a.height,
          thumbnailUrl: a.thumbnailUrl,
          position: a.position,
        })),
      };
      emitDmMessageNew(conversationId, payload);
      // Bump conversation в sidebar обоих участников
      const preview = previewContent(m.content, processedAttachments.length);
      const bumpPayload = {
        conversationId,
        lastMessageAt: now.toISOString(),
        lastMessagePreview: preview,
        lastSenderUserId: me,
      };
      emitDmConversationBumped(convo.userAId, bumpPayload);
      emitDmConversationBumped(convo.userBId, bumpPayload);
      return { message: payload };
    },
  );

  /**
   * PATCH /api/dm/messages/:id — edit (author only).
   */
  app.patch(
    "/api/dm/messages/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: messageId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = editBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          userId: true,
          conversationId: true,
          deletedAt: true,
          conversation: { select: { userAId: true, userBId: true } },
        },
      });
      if (!m || !m.conversationId || !m.conversation) {
        return reply.status(404).send({ error: "DM message not found" });
      }
      // Доступ — только участник conversation. Edit — только автор.
      if (m.conversation.userAId !== me && m.conversation.userBId !== me) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      if (m.userId !== me) {
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
      emitDmMessageUpdated(m.conversationId, {
        messageId,
        conversationId: m.conversationId,
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
   * DELETE /api/dm/messages/:id — soft-delete. Author only (нет ролей в DM).
   */
  app.delete(
    "/api/dm/messages/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: messageId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          userId: true,
          conversationId: true,
          deletedAt: true,
          conversation: { select: { userAId: true, userBId: true } },
        },
      });
      if (!m || !m.conversationId || !m.conversation) {
        return reply.status(404).send({ error: "DM message not found" });
      }
      if (m.conversation.userAId !== me && m.conversation.userBId !== me) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      if (m.userId !== me) {
        return reply.status(403).send({ error: "Only author can delete own message" });
      }
      if (m.deletedAt) {
        return { ok: true, alreadyDeleted: true };
      }
      const deletedAt = new Date();
      await db.message.update({
        where: { id: messageId },
        data: { deletedAt },
      });
      // Cleanup attachments (best-effort fs)
      const attachments = await db.attachment.findMany({
        where: { messageId },
        select: { url: true, thumbnailUrl: true },
      });
      if (attachments.length > 0) {
        const urls = attachments.flatMap((a) => [a.url, a.thumbnailUrl]);
        await db.attachment.deleteMany({ where: { messageId } });
        void unlinkAttachmentFiles(urls);
      }
      emitDmMessageDeleted(m.conversationId, {
        messageId,
        conversationId: m.conversationId,
        deletedAt: deletedAt.toISOString(),
      });
      return { ok: true, deletedAt: deletedAt.toISOString() };
    },
  );
}
