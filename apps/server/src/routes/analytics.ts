import type { FastifyInstance } from "fastify";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";

/**
 * Execution Analytics — Team Health.
 *
 *   GET /api/servers/:id/analytics/team-health
 *
 * Server-wide aggregate поверх ActionItem'ов. Membership-gated. Calm
 * operator dashboard: не chart-perversion, а 4 числа + top-overloaded
 * (top-3) + blocked members (3+ assigned-open).
 *
 * Возвращаемые метрики:
 *   - overdueTotal      — number of OPEN ActionItem'ов с dueAt < now
 *   - unassignedTotal   — number of OPEN без assignee
 *   - openTotal         — total OPEN (для контекста)
 *   - avgResolutionDays — среднее время (createdAt → updatedAt) для
 *                          DONE actions за последние 30 дней (null если
 *                          выборка < 3 closures — слишком мало для signal)
 *   - topOverloaded     — top 3 members по числу assigned-open
 *                          (avatar, displayName, openCount), excludes
 *                          members с openCount === 0
 *   - blockedMembers    — members с >= 3 open assigned (subset topOverloaded)
 *
 * Scope cuts (v0.30+):
 *   - response time per channel (требует expensive median computation)
 *   - trend vs prev week (нужны snapshot'ы исторических данных)
 *   - per-channel breakdown (сейчас только server-wide)
 */
const RESOLUTION_WINDOW_DAYS = 30;
const RESOLUTION_MIN_SAMPLE = 3;
const TOP_OVERLOADED_LIMIT = 3;
const BLOCKED_THRESHOLD = 3;

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

      // Membership-only — server-wide aggregate не должен утекать non-членам.
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      const now = new Date();
      const since = new Date(now.getTime() - RESOLUTION_WINDOW_DAYS * 86_400_000);

      // 1. OPEN actions (минимальные поля)
      const openActions = await db.actionItem.findMany({
        where: { serverId, status: "OPEN" },
        select: { assigneeUserId: true, dueAt: true },
      });

      // 2. DONE actions за окно (для avg resolution)
      const recentDone = await db.actionItem.findMany({
        where: { serverId, status: "DONE", updatedAt: { gte: since } },
        select: { createdAt: true, updatedAt: true },
        take: 500,
      });

      // 3. Hydrate ВСЕХ unique assignee'ев в одном запросе (избегаем 2 round-trip'а)
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
      };
    },
  );
}
