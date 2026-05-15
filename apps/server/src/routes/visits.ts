import type { FastifyInstance } from "fastify";
import { actionItemInclude, serializeActionItem } from "../actionItems.js";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";

/**
 * AI Memory «Since your last visit» — операционная сводка дельты по каналу
 * с момента последнего visit'а. Главный differentiator из vision: вместо
 * перечитывания всей ленты — «пока тебя не было: N сообщений, M решений,
 * K новых задач».
 *
 *   POST /api/channels/:id/visit
 *
 * Атомарно:
 *   1) фиксирует текущий visit (upsert ChannelLastVisit),
 *   2) возвращает priorVisitAt + delta-сводку от prior до now.
 *
 * Frontend сам решает показывать ли banner (порог времени отсутствия) —
 * сервер всегда возвращает данные, threshold = UX-решение.
 */
export async function registerVisitRoutes(app: FastifyInstance) {
  app.post(
    "/api/channels/:id/visit",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id: channelId } = req.params as { id: string };

      // Membership + channel type check.
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true, type: true },
      });
      if (!channel) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      // Visit tracking имеет смысл только для feed-каналов (не для VOICE).
      if (channel.type === "VOICE") {
        return reply.status(400).send({ error: "Voice channels have no message feed" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: channel.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      // Получаем предыдущий visit (если был) и обновляем на now атомарно.
      const now = new Date();
      const prior = await db.channelLastVisit.findUnique({
        where: { userId_channelId: { userId, channelId } },
        select: { visitedAt: true },
      });
      await db.channelLastVisit.upsert({
        where: { userId_channelId: { userId, channelId } },
        update: { visitedAt: now },
        create: { userId, channelId, visitedAt: now },
      });

      // Первый заход — никакой дельты нет, banner не показываем.
      if (!prior) {
        return {
          visitedAt: now.toISOString(),
          priorVisitAt: null,
          since: null,
        };
      }

      const priorAt = prior.visitedAt;

      // ── Дельта по сообщениям ────────────────────────────────────
      // Свои сообщения не считаем — banner про «что произошло пока тебя не было».
      const newMessages = await db.message.count({
        where: {
          channelId,
          createdAt: { gt: priorAt },
          userId: { not: userId },
          deletedAt: null,
        },
      });
      const distinctAuthors = await db.message.findMany({
        where: {
          channelId,
          createdAt: { gt: priorAt },
          userId: { not: userId },
          deletedAt: null,
        },
        distinct: ["userId"],
        select: { userId: true },
        take: 50,
      });
      const newAuthors = distinctAuthors.length;

      // ── Дельта по action items (созданные после prior visit) ────
      const newActions = await db.actionItem.findMany({
        where: { channelId, createdAt: { gt: priorAt } },
        include: actionItemInclude,
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      const counts = { TASK: 0, DECISION: 0, FOLLOW_UP: 0 } as Record<
        "TASK" | "DECISION" | "FOLLOW_UP",
        number
      >;
      for (const a of newActions) counts[a.type]++;

      // ── Дельта по pinned (закреплённое после prior visit) ──────
      const newPinned = await db.message.findMany({
        where: {
          channelId,
          pinnedAt: { gt: priorAt },
          deletedAt: null,
        },
        orderBy: { pinnedAt: "desc" },
        take: 5,
        select: {
          id: true,
          content: true,
          pinnedAt: true,
          user: { select: { id: true, displayName: true, avatar: true } },
        },
      });

      // ── Инцидент в этом канале (1-to-1) — если открыт после prior ─
      const incident = await db.incident.findFirst({
        where: { channelId, openedAt: { gt: priorAt } },
        select: { id: true, title: true, status: true, openedAt: true },
      });

      return {
        visitedAt: now.toISOString(),
        priorVisitAt: priorAt.toISOString(),
        since: {
          newMessages,
          newAuthors,
          newTasks: counts.TASK,
          newDecisions: counts.DECISION,
          newFollowUps: counts.FOLLOW_UP,
          recentActions: newActions.slice(0, 6).map(serializeActionItem),
          recentPinned: newPinned.map((m) => ({
            id: m.id,
            content: m.content,
            pinnedAt: m.pinnedAt!.toISOString(),
            user: m.user,
          })),
          incident: incident
            ? {
                id: incident.id,
                title: incident.title,
                status: incident.status,
                openedAt: incident.openedAt.toISOString(),
              }
            : null,
        },
      };
    },
  );
}
