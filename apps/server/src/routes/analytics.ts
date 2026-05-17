import type { FastifyInstance } from "fastify";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";

/**
 * Execution Analytics — Team Health.
 *
 *   GET /api/servers/:id/analytics/team-health
 *
 * Server-wide aggregate поверх ActionItem'ов. Membership-gated. Calm
 * operator dashboard.
 *
 * Возвращаемые метрики:
 *   v0.30 base:
 *     - overdueTotal      — number of OPEN ActionItem'ов с dueAt < now
 *     - unassignedTotal   — number of OPEN без assignee
 *     - openTotal         — total OPEN (для контекста)
 *     - avgResolutionDays — среднее время (createdAt → updatedAt) для
 *                            DONE actions за окно. Null если < 3 closures.
 *     - topOverloaded     — top 3 members по числу assigned-open
 *     - blockedMembers    — members с >= 3 open assigned
 *
 *   v0.60 (#12 Team Health v3):
 *     - trends            — current week vs previous week deltas для
 *                            createdInWeek + closedInWeek (sliding 7-day window).
 *     - perChannel        — breakdown open + overdue + resolvedInWindow per
 *                            channelId (отсортирован по open desc).
 *     - responseTime      — median(first thread reply latency) в ms, sample
 *                            size в окне. Null если < 5 thread-conversations.
 *
 * Snapshot'ы исторических данных не нужны — current vs prev week вычисляется
 * on-the-fly из ActionItem.createdAt / updatedAt.
 */
const RESOLUTION_WINDOW_DAYS = 30;
const RESOLUTION_MIN_SAMPLE = 3;
const TOP_OVERLOADED_LIMIT = 3;
const BLOCKED_THRESHOLD = 3;
const RESPONSE_MIN_SAMPLE = 5;
const RESPONSE_WINDOW_DAYS = 30;
const WEEK_MS = 7 * 86_400_000;

/**
 * Pure aggregation — separated для unit-test'абельности.
 * Input — минимальные shape'ы из БД, output — finalized метрики.
 *
 * Exported для тестов, не должен использоваться в hot paths без route layer'а
 * (membership-gating живёт там).
 */
export type OpenActionInput = {
  assigneeUserId: string | null;
  dueAt: Date | null;
};
export type DoneActionInput = {
  createdAt: Date;
  updatedAt: Date;
};
export type UserInput = {
  id: string;
  displayName: string;
  avatar: string | null;
};
export type AggregatedHealth = {
  overdueTotal: number;
  unassignedTotal: number;
  openTotal: number;
  resolvedInWindow: number;
  avgResolutionDays: number | null;
  topOverloaded: Array<{
    userId: string;
    displayName: string;
    avatar: string | null;
    openCount: number;
  }>;
  blockedMembers: Array<{
    userId: string;
    displayName: string;
    avatar: string | null;
    openCount: number;
  }>;
};

export function aggregateTeamHealth(
  openActions: OpenActionInput[],
  recentDone: DoneActionInput[],
  users: UserInput[],
  now: Date = new Date(),
): AggregatedHealth {
  let overdueTotal = 0;
  let unassignedTotal = 0;
  const openByAssignee = new Map<string, number>();
  for (const a of openActions) {
    if (a.dueAt && a.dueAt.getTime() < now.getTime()) overdueTotal++;
    if (!a.assigneeUserId) {
      unassignedTotal++;
    } else {
      openByAssignee.set(
        a.assigneeUserId,
        (openByAssignee.get(a.assigneeUserId) ?? 0) + 1,
      );
    }
  }

  const sortedAssignees = [...openByAssignee.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const userMap = new Map(users.map((u) => [u.id, u]));

  const topOverloaded = sortedAssignees
    .slice(0, TOP_OVERLOADED_LIMIT)
    .map(([id, openCount]) => {
      const u = userMap.get(id);
      if (!u) return null;
      return {
        userId: u.id,
        displayName: u.displayName,
        avatar: u.avatar,
        openCount,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const blockedMembers = sortedAssignees
    .filter(([, count]) => count >= BLOCKED_THRESHOLD)
    .map(([id, openCount]) => {
      const u = userMap.get(id);
      if (!u) return null;
      return {
        userId: u.id,
        displayName: u.displayName,
        avatar: u.avatar,
        openCount,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  let avgResolutionDays: number | null = null;
  if (recentDone.length >= RESOLUTION_MIN_SAMPLE) {
    const totalMs = recentDone.reduce(
      (sum, a) => sum + (a.updatedAt.getTime() - a.createdAt.getTime()),
      0,
    );
    const avgMs = totalMs / recentDone.length;
    avgResolutionDays = Math.round((avgMs / 86_400_000) * 10) / 10;
  }

  return {
    overdueTotal,
    unassignedTotal,
    openTotal: openActions.length,
    resolvedInWindow: recentDone.length,
    avgResolutionDays,
    topOverloaded,
    blockedMembers,
  };
}

/**
 * Median of numeric array. Pure helper для unit-tests + main route.
 * Возвращает null если массив пуст.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function registerAnalyticsRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/analytics/team-health",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id: serverId } = req.params as { id: string };

      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      const now = new Date();
      const since = new Date(now.getTime() - RESOLUTION_WINDOW_DAYS * 86_400_000);
      const weekStart = new Date(now.getTime() - WEEK_MS);
      const prevWeekStart = new Date(now.getTime() - 2 * WEEK_MS);
      const responseSince = new Date(now.getTime() - RESPONSE_WINDOW_DAYS * 86_400_000);

      // 1. OPEN actions — для overdue/unassigned/topOverloaded.
      const openActions = await db.actionItem.findMany({
        where: { serverId, status: "OPEN" },
        select: {
          assigneeUserId: true,
          dueAt: true,
          channelId: true,
        },
      });

      // 2. DONE actions за окно — avg resolution + closedInWindow per channel.
      const recentDone = await db.actionItem.findMany({
        where: { serverId, status: "DONE", updatedAt: { gte: since } },
        select: {
          createdAt: true,
          updatedAt: true,
          channelId: true,
        },
        take: 1000,
      });

      // 3. Trend: всё созданное за 2 недели (для current/prev week split).
      const trendActions = await db.actionItem.findMany({
        where: {
          serverId,
          createdAt: { gte: prevWeekStart },
        },
        select: {
          createdAt: true,
          status: true,
          updatedAt: true,
        },
        take: 2000,
      });

      // 4. Channels на сервере — для hydration имён в perChannel breakdown.
      const channels = await db.channel.findMany({
        where: { serverId },
        select: { id: true, name: true, type: true },
      });

      // 5. Response time: thread roots за окно с первым reply.
      // Берём messages у которых есть threadReplies, JOIN с минимальной первой.
      const threadRoots = await db.message.findMany({
        where: {
          channel: { serverId, type: "TEXT" },
          deletedAt: null,
          createdAt: { gte: responseSince },
          // hasSome не работает с pivots; делаем `some` через threadReplies.
          threadReplies: {
            some: { createdAt: { gte: responseSince } },
          },
        },
        select: {
          id: true,
          createdAt: true,
          channelId: true,
          threadReplies: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { createdAt: true },
          },
        },
        take: 800,
      });

      const assigneeIds = Array.from(
        new Set(
          openActions
            .map((a) => a.assigneeUserId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const users = assigneeIds.length
        ? await db.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, displayName: true, avatar: true },
          })
        : [];

      const result = aggregateTeamHealth(openActions, recentDone, users, now);

      // ── Trends (week-over-week)
      const thisWeek = {
        created: 0,
        closed: 0,
      };
      const prevWeek = {
        created: 0,
        closed: 0,
      };
      for (const a of trendActions) {
        const createdMs = a.createdAt.getTime();
        if (createdMs >= weekStart.getTime()) thisWeek.created++;
        else if (createdMs >= prevWeekStart.getTime()) prevWeek.created++;
        if (a.status === "DONE") {
          const closedMs = a.updatedAt.getTime();
          if (closedMs >= weekStart.getTime()) thisWeek.closed++;
          else if (closedMs >= prevWeekStart.getTime()) prevWeek.closed++;
        }
      }

      // ── Per-channel breakdown.
      const channelMeta = new Map(
        channels.map((c) => [c.id, { name: c.name, type: c.type }]),
      );
      const perChannelMap = new Map<
        string,
        { open: number; overdue: number; closed: number }
      >();
      const ensureChannelEntry = (cid: string) => {
        if (!perChannelMap.has(cid)) {
          perChannelMap.set(cid, { open: 0, overdue: 0, closed: 0 });
        }
        return perChannelMap.get(cid)!;
      };
      for (const a of openActions) {
        const entry = ensureChannelEntry(a.channelId);
        entry.open++;
        if (a.dueAt && a.dueAt.getTime() < now.getTime()) entry.overdue++;
      }
      for (const a of recentDone) {
        ensureChannelEntry(a.channelId).closed++;
      }
      const perChannel = Array.from(perChannelMap.entries())
        .map(([channelId, counts]) => {
          const meta = channelMeta.get(channelId);
          return {
            channelId,
            channelName: meta?.name ?? null,
            channelType: meta?.type ?? null,
            open: counts.open,
            overdue: counts.overdue,
            closed: counts.closed,
          };
        })
        // Фильтруем deleted channels (нет meta + 0 activity) — оставляем
        // активные либо те где meta есть.
        .filter((c) => c.channelName !== null || c.open + c.closed > 0)
        .sort((a, b) => b.open - a.open || b.closed - a.closed);

      // ── Response time (median).
      const deltas: number[] = [];
      for (const root of threadRoots) {
        const firstReply = root.threadReplies[0];
        if (!firstReply) continue;
        const delta = firstReply.createdAt.getTime() - root.createdAt.getTime();
        if (delta >= 0) deltas.push(delta);
      }
      const responseMedianMs =
        deltas.length >= RESPONSE_MIN_SAMPLE ? median(deltas) : null;

      return {
        serverId,
        generatedAt: now.toISOString(),
        windowDays: RESOLUTION_WINDOW_DAYS,
        counts: {
          openTotal: result.openTotal,
          overdueTotal: result.overdueTotal,
          unassignedTotal: result.unassignedTotal,
          resolvedInWindow: result.resolvedInWindow,
        },
        avgResolutionDays: result.avgResolutionDays,
        topOverloaded: result.topOverloaded,
        blockedMembers: result.blockedMembers,
        trends: {
          thisWeek,
          prevWeek,
        },
        perChannel,
        responseTime: {
          medianMs: responseMedianMs,
          sampleSize: deltas.length,
          windowDays: RESPONSE_WINDOW_DAYS,
        },
      };
    },
  );
}
