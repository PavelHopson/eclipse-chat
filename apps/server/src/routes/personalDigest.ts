import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { memoryContextEligibilityWhere } from "../lib/memoryGovernance.js";
import {
  classifyDigestAction,
  digestImportanceRank,
  monotonicDigestCursor,
  personalDigestExcerpt,
  resolvePersonalDigestSince,
  type DigestImportance,
} from "../lib/personalDigest.js";
import { canAccessRealtimeChannel } from "../lib/realtimeAccess.js";

const acknowledgeBody = z.object({
  reviewedThrough: z.string().datetime(),
});

type DigestItem = {
  id: string;
  kind:
    | "INCIDENT"
    | "RISK"
    | "APPROVAL"
    | "DECISION"
    | "TASK"
    | "FOLLOW_UP"
    | "MEMORY"
    | "ROOM_ACTIVITY";
  importance: DigestImportance;
  title: string;
  detail: string | null;
  serverId: string;
  serverName: string;
  channelId: string | null;
  channelName: string | null;
  messageId: string | null;
  actionItemId: string | null;
  memoryEntryId: string | null;
  createdAt: string;
};

type ChannelDigest = {
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  messages: number;
  tasks: number;
  decisions: number;
  followUps: number;
  risks: number;
  latestAt: string | null;
  latestMessageId: string | null;
  latestMessage: string | null;
};

function emptyDigest(
  since: Date,
  generatedAt: Date,
  initialized: boolean,
  truncated: boolean,
) {
  return {
    since: since.toISOString(),
    generatedAt: generatedAt.toISOString(),
    initialized,
    truncated,
    totals: {
      messages: 0,
      tasks: 0,
      decisions: 0,
      followUps: 0,
      risks: 0,
      memory: 0,
      incidents: 0,
      approvals: 0,
    },
    priorityItems: [] as DigestItem[],
    channels: [] as ChannelDigest[],
  };
}

/**
 * Personal command digest. Reads never advance the cursor; only the explicit
 * acknowledge endpoint does, so opening or refreshing the app cannot lose work.
 */
export async function registerPersonalDigestRoutes(app: FastifyInstance) {
  app.get(
    "/api/me/digest",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 60, timeWindow: 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, digestAcknowledgedAt: true },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });

      const generatedAt = new Date();
      const window = resolvePersonalDigestSince(
        user.digestAcknowledgedAt,
        user.createdAt,
        generatedAt,
      );
      const base = emptyDigest(
        window.since,
        generatedAt,
        window.initialized,
        window.truncated,
      );

      const memberships = await db.member.findMany({
        where: { userId },
        select: {
          role: true,
          server: {
            select: {
              id: true,
              name: true,
              mode: true,
              channels: {
                where: { type: { not: "VOICE" } },
                select: { id: true, name: true, internal: true },
              },
            },
          },
        },
      });

      const channelById = new Map<
        string,
        { id: string; name: string; serverId: string; serverName: string }
      >();
      for (const membership of memberships) {
        for (const channel of membership.server.channels) {
          if (
            canAccessRealtimeChannel(
              membership.server.mode,
              channel.internal,
              membership.role,
            )
          ) {
            channelById.set(channel.id, {
              id: channel.id,
              name: channel.name,
              serverId: membership.server.id,
              serverName: membership.server.name,
            });
          }
        }
      }

      const channelIds = [...channelById.keys()];
      if (channelIds.length === 0) return base;
      const serverIds = [...new Set([...channelById.values()].map((c) => c.serverId))];

      const [
        messageCounts,
        recentMessages,
        actionCounts,
        recentActionRows,
        priorityActions,
        memoryCounts,
        recentMemory,
        incidents,
        approvalTotal,
        incidentTotal,
      ] = await Promise.all([
        db.message.groupBy({
          by: ["channelId"],
          where: {
            channelId: { in: channelIds },
            createdAt: { gt: window.since, lte: generatedAt },
            userId: { not: userId },
            deletedAt: null,
          },
          _count: { _all: true },
        }),
        db.message.findMany({
          where: {
            channelId: { in: channelIds },
            createdAt: { gt: window.since, lte: generatedAt },
            userId: { not: userId },
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: {
            id: true,
            channelId: true,
            content: true,
            createdAt: true,
            user: { select: { displayName: true } },
          },
        }),
        db.actionItem.groupBy({
          by: ["channelId", "type"],
          where: {
            channelId: { in: channelIds },
            updatedAt: { gt: window.since, lte: generatedAt },
          },
          _count: { _all: true },
        }),
        db.actionItem.findMany({
          where: {
            channelId: { in: channelIds },
            updatedAt: { gt: window.since, lte: generatedAt },
          },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: {
            id: true,
            channelId: true,
            sourceMessageId: true,
            title: true,
            description: true,
            type: true,
            status: true,
            priority: true,
            dueAt: true,
            createdAt: true,
            updatedAt: true,
            escalatedAt: true,
            approvalStatus: true,
            approverUserId: true,
            assigneeUserId: true,
          },
        }),
        db.actionItem.findMany({
          where: {
            channelId: { in: channelIds },
            OR: [
              {
                approvalStatus: "PENDING",
                approverUserId: userId,
              },
              {
                assigneeUserId: userId,
                status: { not: "DONE" },
              },
              {
                priority: { in: ["HIGH", "URGENT"] },
                status: { not: "DONE" },
              },
              {
                escalatedAt: { not: null },
                status: { not: "DONE" },
              },
              {
                dueAt: { lt: generatedAt },
                status: { not: "DONE" },
              },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            channelId: true,
            sourceMessageId: true,
            title: true,
            description: true,
            type: true,
            status: true,
            priority: true,
            dueAt: true,
            createdAt: true,
            updatedAt: true,
            escalatedAt: true,
            approvalStatus: true,
            approverUserId: true,
            assigneeUserId: true,
          },
        }),
        db.memoryEntry.groupBy({
          by: ["channelId", "kind"],
          where: {
            serverId: { in: serverIds },
            ...memoryContextEligibilityWhere(generatedAt),
            createdAt: { gt: window.since, lte: generatedAt },
            OR: [{ channelId: null }, { channelId: { in: channelIds } }],
          },
          _count: { _all: true },
        }),
        db.memoryEntry.findMany({
          where: {
            serverId: { in: serverIds },
            ...memoryContextEligibilityWhere(generatedAt),
            createdAt: { gt: window.since, lte: generatedAt },
            OR: [{ channelId: null }, { channelId: { in: channelIds } }],
          },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: {
            id: true,
            serverId: true,
            channelId: true,
            kind: true,
            title: true,
            content: true,
            sourceMessageId: true,
            actionItemId: true,
            createdAt: true,
          },
        }),
        db.incident.findMany({
          where: {
            channelId: { in: channelIds },
            openedAt: { gt: window.since, lte: generatedAt },
          },
          orderBy: { openedAt: "desc" },
          take: 30,
          select: {
            id: true,
            channelId: true,
            title: true,
            status: true,
            openedAt: true,
          },
        }),
        db.actionItem.count({
          where: {
            channelId: { in: channelIds },
            approvalStatus: "PENDING",
            approverUserId: userId,
          },
        }),
        db.incident.count({
          where: {
            channelId: { in: channelIds },
            openedAt: { gt: window.since, lte: generatedAt },
          },
        }),
      ]);

      const recentActions = [
        ...new Map(
          [...priorityActions, ...recentActionRows].map((action) => [
            action.id,
            action,
          ]),
        ).values(),
      ];

      const channels = new Map<string, ChannelDigest>();
      const ensureChannel = (channelId: string): ChannelDigest | null => {
        const meta = channelById.get(channelId);
        if (!meta) return null;
        const existing = channels.get(channelId);
        if (existing) return existing;
        const created: ChannelDigest = {
          serverId: meta.serverId,
          serverName: meta.serverName,
          channelId: meta.id,
          channelName: meta.name,
          messages: 0,
          tasks: 0,
          decisions: 0,
          followUps: 0,
          risks: 0,
          latestAt: null,
          latestMessageId: null,
          latestMessage: null,
        };
        channels.set(channelId, created);
        return created;
      };
      const touchChannel = (channel: ChannelDigest, at: Date) => {
        if (!channel.latestAt || new Date(channel.latestAt) < at) {
          channel.latestAt = at.toISOString();
        }
      };

      for (const row of messageCounts) {
        if (!row.channelId) continue;
        const channel = ensureChannel(row.channelId);
        if (channel) channel.messages = row._count._all;
      }
      for (const message of recentMessages) {
        if (!message.channelId) continue;
        const channel = ensureChannel(message.channelId);
        if (!channel) continue;
        touchChannel(channel, message.createdAt);
        if (!channel.latestMessageId) {
          channel.latestMessageId = message.id;
          channel.latestMessage = personalDigestExcerpt(
            `${message.user?.displayName ?? "Удалённый пользователь"}: ${message.content || "Вложение без текста"}`,
          );
        }
      }
      for (const row of actionCounts) {
        const channel = ensureChannel(row.channelId);
        if (!channel) continue;
        if (row.type === "TASK") channel.tasks = row._count._all;
        if (row.type === "DECISION") channel.decisions = row._count._all;
        if (row.type === "FOLLOW_UP") channel.followUps = row._count._all;
      }
      for (const action of recentActions) {
        const channel = ensureChannel(action.channelId);
        if (channel) touchChannel(channel, action.updatedAt);
      }
      for (const row of memoryCounts) {
        if (!row.channelId) continue;
        const channel = ensureChannel(row.channelId);
        if (channel && row.kind === "RISK") channel.risks = row._count._all;
      }
      for (const memory of recentMemory) {
        if (!memory.channelId) continue;
        const channel = ensureChannel(memory.channelId);
        if (channel) touchChannel(channel, memory.createdAt);
      }

      const items: DigestItem[] = [];
      for (const incident of incidents) {
        const channel = incident.channelId ? channelById.get(incident.channelId) : null;
        if (!channel) continue;
        items.push({
          id: `incident:${incident.id}`,
          kind: "INCIDENT",
          importance: incident.status === "OPEN" ? "CRITICAL" : "HIGH",
          title: incident.title,
          detail: incident.status === "OPEN" ? "Открыт новый инцидент" : "Инцидент закрыт",
          serverId: channel.serverId,
          serverName: channel.serverName,
          channelId: channel.id,
          channelName: channel.name,
          messageId: null,
          actionItemId: null,
          memoryEntryId: null,
          createdAt: incident.openedAt.toISOString(),
        });
        const digestChannel = ensureChannel(channel.id);
        if (digestChannel) touchChannel(digestChannel, incident.openedAt);
      }

      for (const action of recentActions) {
        const channel = channelById.get(action.channelId);
        if (!channel) continue;
        const importance = classifyDigestAction(action, userId, generatedAt);
        const awaitingMyApproval =
          action.approvalStatus === "PENDING" && action.approverUserId === userId;
        items.push({
          id: `action:${action.id}`,
          kind: awaitingMyApproval ? "APPROVAL" : action.type,
          importance,
          title: action.title,
          detail: personalDigestExcerpt(
            action.description ||
              (awaitingMyApproval
                ? "Ожидает вашего решения"
                : action.status === "DONE"
                  ? "Завершено"
                  : action.assigneeUserId === userId
                    ? "Назначено вам"
                    : "Изменено в рабочей очереди"),
          ),
          serverId: channel.serverId,
          serverName: channel.serverName,
          channelId: channel.id,
          channelName: channel.name,
          messageId: action.sourceMessageId,
          actionItemId: action.id,
          memoryEntryId: null,
          createdAt: action.updatedAt.toISOString(),
        });
      }

      for (const memory of recentMemory) {
        const channel = memory.channelId ? channelById.get(memory.channelId) : null;
        const membership = memberships.find((m) => m.server.id === memory.serverId);
        if (!membership || (memory.channelId && !channel)) continue;
        const kind = memory.kind === "RISK" ? "RISK" : memory.kind === "DECISION" ? "DECISION" : "MEMORY";
        items.push({
          id: `memory:${memory.id}`,
          kind,
          importance: memory.kind === "RISK" ? "HIGH" : "NORMAL",
          title: memory.title,
          detail: memory.content ? personalDigestExcerpt(memory.content) : "Добавлено в подтверждённую память",
          serverId: membership.server.id,
          serverName: membership.server.name,
          channelId: channel?.id ?? null,
          channelName: channel?.name ?? null,
          messageId: memory.sourceMessageId,
          actionItemId: memory.actionItemId,
          memoryEntryId: memory.id,
          createdAt: memory.createdAt.toISOString(),
        });
      }

      const channelRows = [...channels.values()]
        .filter((channel) =>
          channel.messages + channel.tasks + channel.decisions + channel.followUps + channel.risks > 0,
        )
        .sort((a, b) => (b.latestAt ?? "").localeCompare(a.latestAt ?? ""))
        .slice(0, 16);

      for (const channel of channelRows.slice(0, 8)) {
        if (channel.messages === 0) continue;
        items.push({
          id: `room:${channel.channelId}`,
          kind: "ROOM_ACTIVITY",
          importance: "NORMAL",
          title: `${channel.messages} новых сообщений`,
          detail: channel.latestMessage,
          serverId: channel.serverId,
          serverName: channel.serverName,
          channelId: channel.channelId,
          channelName: channel.channelName,
          messageId: channel.latestMessageId,
          actionItemId: null,
          memoryEntryId: null,
          createdAt: channel.latestAt ?? generatedAt.toISOString(),
        });
      }

      items.sort((a, b) => {
        const importance = digestImportanceRank(a.importance) - digestImportanceRank(b.importance);
        if (importance !== 0) return importance;
        return b.createdAt.localeCompare(a.createdAt);
      });

      const countByType = (type: "TASK" | "DECISION" | "FOLLOW_UP") =>
        actionCounts
          .filter((row) => row.type === type)
          .reduce((sum, row) => sum + row._count._all, 0);
      const memoryTotal = memoryCounts.reduce((sum, row) => sum + row._count._all, 0);
      const riskTotal = memoryCounts
        .filter((row) => row.kind === "RISK")
        .reduce((sum, row) => sum + row._count._all, 0);
      const messageTotal = messageCounts.reduce((sum, row) => sum + row._count._all, 0);
      return {
        ...base,
        totals: {
          messages: messageTotal,
          tasks: countByType("TASK"),
          decisions: countByType("DECISION"),
          followUps: countByType("FOLLOW_UP"),
          risks: riskTotal,
          memory: memoryTotal,
          incidents: incidentTotal,
          approvals: approvalTotal,
        },
        priorityItems: items.slice(0, 20),
        channels: channelRows,
      };
    },
  );

  app.post(
    "/api/me/digest/acknowledge",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 20, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = acknowledgeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });

      const now = new Date();
      const requested = new Date(parsed.data.reviewedThrough);
      const cursor = monotonicDigestCursor(null, requested, now);
      if (!cursor) {
        return reply.status(400).send({ error: "reviewedThrough cannot be in the future" });
      }

      // Atomic predicate prevents two concurrent acknowledgements from moving
      // the cursor backwards after both requests read the same old value.
      const updated = await db.user.updateMany({
        where: {
          id: userId,
          OR: [
            { digestAcknowledgedAt: null },
            { digestAcknowledgedAt: { lt: cursor } },
          ],
        },
        data: { digestAcknowledgedAt: cursor },
      });
      if (updated.count > 0) {
        return { acknowledgedAt: cursor.toISOString() };
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { digestAcknowledgedAt: true },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });
      return {
        acknowledgedAt: (user.digestAcknowledgedAt ?? cursor).toISOString(),
      };
    },
  );
}
