import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  emitThreadReplyNew,
  emitThreadMetaUpdate,
} from "../realtime.js";

const replyBody = z.object({
  content: z.string().min(1).max(8000),
});

/**
 * Threads — обсуждения ветвления от root-сообщения.
 *
 * Архитектура:
 *   - Message.parentMessageId self-relation: replies указывают на root message.
 *   - Root сообщение остаётся в main channel feed как обычно.
 *   - Replies НЕ показываются в main feed (отфильтровываются по WHERE parentMessageId IS NULL).
 *   - Replies показываются в Thread panel (открывается кликом на root).
 *
 * Routes:
 *   GET  /api/messages/:id/thread          — root + replies (sorted asc)
 *   POST /api/messages/:id/thread          — create reply
 *
 * Socket events:
 *   thread:reply:new  → room `thread:${rootId}`   — для open Thread panel
 *   thread:meta:update → room `channel:${channelId}` — для replies-counter badge
 *
 * Permissions:
 *   - Read: любой member канала root'а (или открытый GET для anon если main GET тоже открыт)
 *   - Write: любой member канала root'а
 */
export async function registerThreadRoutes(app: FastifyInstance) {
  /**
   * GET /api/messages/:id/thread?take=N — root + replies.
   * Возвращает root-сообщение и до 100 replies в chronological order.
   */
  app.get("/api/messages/:id/thread", async (req, reply) => {
    const { id: rootId } = req.params as { id: string };
    const take = Math.min(
      100,
      Math.max(1, Number((req.query as { take?: string }).take) || 50),
    );
    const root = await db.message.findUnique({
      where: { id: rootId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            botProfile: { select: { id: true } },
            email: true,
          },
        },
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
    if (!root) {
      return reply.status(404).send({ error: "Root message not found" });
    }
    if (!root.channelId) {
      return reply.status(400).send({
        error: "Threads пока поддерживаются только для канальных сообщений",
      });
    }

    // Optional user identification — для 'mine' aggregation на reactions
    let currentUserId: string | null = null;
    try {
      await req.jwtVerify();
      const payload = req.user as { sub?: string } | undefined;
      currentUserId = payload?.sub ?? null;
    } catch {
      /* anonymous */
    }

    const replies = await db.message.findMany({
      where: { parentMessageId: rootId },
      take,
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            botProfile: { select: { id: true } },
            email: true,
          },
        },
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

    const serializeMessage = (m: typeof root | (typeof replies)[number]) => {
      const grouped = new Map<string, { count: number; mine: boolean }>();
      for (const r of m.reactions) {
        const cur = grouped.get(r.emoji) ?? { count: 0, mine: false };
        cur.count += 1;
        if (currentUserId && r.userId === currentUserId) cur.mine = true;
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
        pinnedAt: m.pinnedAt?.toISOString() ?? null,
        parentMessageId: m.parentMessageId ?? null,
        user: {
          id: m.user.id,
          displayName: m.user.displayName,
          avatar: m.user.avatar,
          isBot:
            m.user.botProfile != null ||
            m.user.email === "system@eclipse-chat.local",
        },
        reactions,
        attachments: m.deletedAt ? [] : m.attachments,
      };
    };

    return {
      root: serializeMessage(root),
      replies: replies.map(serializeMessage),
      channelId: root.channelId,
    };
  });

  /**
   * POST /api/messages/:id/thread — создать reply в thread.
   */
  app.post(
    "/api/messages/:id/thread",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: rootId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = replyBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const root = await db.message.findUnique({
        where: { id: rootId },
        select: {
          id: true,
          channelId: true,
          deletedAt: true,
          parentMessageId: true,
        },
      });
      if (!root) {
        return reply.status(404).send({ error: "Root message not found" });
      }
      if (root.deletedAt) {
        return reply.status(410).send({ error: "Cannot reply to deleted message" });
      }
      if (!root.channelId) {
        return reply.status(400).send({
          error: "Threads пока поддерживаются только для канальных сообщений",
        });
      }
      // Не разрешаем «threads of threads» — replies всегда указывают на ROOT,
      // не на другой reply. Это упрощает UI (нет nested threads).
      if (root.parentMessageId) {
        return reply.status(400).send({
          error: "Нельзя reply на сообщение-внутри-треда, отвечай root'у",
        });
      }

      // Membership check (same as main message route)
      const ch = await db.channel.findUnique({
        where: { id: root.channelId },
        select: { serverId: true, type: true },
      });
      if (!ch) return reply.status(404).send({ error: "Channel not found" });
      if (ch.type !== "TEXT") {
        return reply.status(400).send({ error: "Thread replies allowed only in TEXT channels" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: ch.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      const m = await db.message.create({
        data: {
          content: parsed.data.content.trim(),
          userId,
          channelId: root.channelId,
          parentMessageId: rootId,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              botProfile: { select: { id: true } },
              email: true,
            },
          },
        },
      });

      const replyPayload = {
        messageId: m.id,
        rootId,
        channelId: root.channelId,
        userId: m.userId,
        displayName: m.user.displayName,
        avatar: m.user.avatar,
        content: m.content,
        isBot:
          m.user.botProfile != null ||
          m.user.email === "system@eclipse-chat.local",
        createdAt: m.createdAt.toISOString(),
      };
      emitThreadReplyNew(rootId, replyPayload);

      // Также emit meta-update для channel — чтобы badge replies-counter
      // обновился у всех в канале (не только в open Thread panel).
      const replyCount = await db.message.count({
        where: { parentMessageId: rootId },
      });
      const lastReplyAt = m.createdAt.toISOString();
      emitThreadMetaUpdate(root.channelId, {
        rootId,
        channelId: root.channelId,
        replyCount,
        lastReplyAt,
      });

      return { reply: replyPayload };
    },
  );
}
