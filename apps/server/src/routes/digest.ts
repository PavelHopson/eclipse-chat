import type { FastifyInstance } from "fastify";
import { actionItemInclude, serializeActionItem } from "../actionItems.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  AINotConfiguredError,
  AIProviderError,
  chat,
  isAiConfigured,
} from "../ai/provider.js";
import { digestSummaryPrompt } from "../ai/prompts.js";

/**
 * Channel Digest — компактная сводка состояния канала.
 *
 * Отвечает на «что прямо сейчас требует внимания» без чтения всей переписки:
 *   - какие задачи открыты, какие просрочены / срочны / без ответственного,
 *   - что решено за последнее окно (decisions),
 *   - запланированные follow-up'ы,
 *   - закреплённые сообщения (как «постоянный» якорь канала),
 *   - сухая статистика активности.
 *
 * Это фундамент под будущий AI-summary слой: структурированный snapshot,
 * который потом можно скармливать LLM для нативного резюме. Сейчас — pure-SQL
 * digest, без LLM.
 *
 *   GET /api/channels/:id/digest?windowDays=N
 *
 * Membership-only. Окно для статистики/decisions/follow-ups регулируется
 * `windowDays` (1..30, default 7).
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function endOfDayUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

async function requireChannelMember(userId: string, channelId: string) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, name: true, serverId: true, type: true },
  });
  if (!channel) return { error: "Channel not found" as const };
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId: channel.serverId } },
    select: { id: true },
  });
  if (!member) return { error: "Not a member of this server" as const };
  return { channel };
}

export async function registerDigestRoutes(app: FastifyInstance) {
  app.get(
    "/api/channels/:id/digest",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id: channelId } = req.params as { id: string };
      const windowDaysRaw = Number(
        (req.query as { windowDays?: string }).windowDays ?? 7,
      );
      const windowDays = Number.isFinite(windowDaysRaw)
        ? Math.min(30, Math.max(1, Math.round(windowDaysRaw)))
        : 7;

      const membership = await requireChannelMember(userId, channelId);
      if ("error" in membership) {
        return reply
          .status(membership.error === "Channel not found" ? 404 : 403)
          .send({ error: membership.error });
      }
      const channel = membership.channel;

      const now = new Date();
      const windowStart = new Date(now.getTime() - windowDays * ONE_DAY_MS);
      const todayEnd = endOfDayUTC(now);
      const tomorrowStart = startOfDayUTC(new Date(now.getTime() + ONE_DAY_MS));
      const tomorrowEnd = endOfDayUTC(new Date(now.getTime() + ONE_DAY_MS));

      // -----------------------------------------------------------------
      // Open actions: by type counts + due-status buckets + unassigned
      // -----------------------------------------------------------------
      const openActions = await db.actionItem.findMany({
        where: { channelId, status: "OPEN" },
        include: actionItemInclude,
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 100, // digest cap — channel с 100+ open actions редкость, иначе digest пере-объёмен
      });

      const byType = { TASK: 0, DECISION: 0, FOLLOW_UP: 0 } as Record<string, number>;
      for (const a of openActions) byType[a.type] = (byType[a.type] ?? 0) + 1;

      const overdue: typeof openActions = [];
      const dueToday: typeof openActions = [];
      const dueTomorrow: typeof openActions = [];
      const unassigned: typeof openActions = [];
      for (const a of openActions) {
        if (a.dueAt) {
          const due = a.dueAt.getTime();
          if (due < now.getTime() && a.status === "OPEN") {
            overdue.push(a);
          } else if (due <= todayEnd.getTime()) {
            dueToday.push(a);
          } else if (
            due >= tomorrowStart.getTime() &&
            due <= tomorrowEnd.getTime()
          ) {
            dueTomorrow.push(a);
          }
        }
        if (!a.assigneeUserId) unassigned.push(a);
      }

      // -----------------------------------------------------------------
      // Decisions (recent, both OPEN and DONE) в окне
      // -----------------------------------------------------------------
      const recentDecisions = await db.actionItem.findMany({
        where: {
          channelId,
          type: "DECISION",
          updatedAt: { gte: windowStart },
        },
        include: actionItemInclude,
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      // -----------------------------------------------------------------
      // Follow-ups: всё что type=FOLLOW_UP, open или recently done
      // -----------------------------------------------------------------
      const followUps = await db.actionItem.findMany({
        where: {
          channelId,
          type: "FOLLOW_UP",
          OR: [
            { status: "OPEN" },
            { status: "DONE", updatedAt: { gte: windowStart } },
          ],
        },
        include: actionItemInclude,
        orderBy: [
          { status: "asc" },
          { dueAt: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        take: 10,
      });

      // -----------------------------------------------------------------
      // Pinned messages — постоянный якорь канала, не зависит от окна.
      // -----------------------------------------------------------------
      const pinned = await db.message.findMany({
        where: { channelId, pinnedAt: { not: null }, deletedAt: null },
        orderBy: { pinnedAt: "desc" },
        take: 5,
        select: {
          id: true,
          content: true,
          pinnedAt: true,
          createdAt: true,
          user: { select: { id: true, displayName: true, avatar: true } },
        },
      });

      // -----------------------------------------------------------------
      // Activity stats — light SQL, чтобы UI мог показать «N сообщений / M авторов»
      // -----------------------------------------------------------------
      const messagesInWindow = await db.message.findMany({
        where: { channelId, createdAt: { gte: windowStart }, deletedAt: null },
        select: { userId: true },
      });
      const messages7d = messagesInWindow.length;
      const uniqueAuthors7d = new Set(messagesInWindow.map((m) => m.userId)).size;

      return {
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
        },
        generatedAt: now.toISOString(),
        windowDays,
        openActions: {
          total: openActions.length,
          byType: {
            TASK: byType.TASK ?? 0,
            DECISION: byType.DECISION ?? 0,
            FOLLOW_UP: byType.FOLLOW_UP ?? 0,
          },
          overdue: overdue.map(serializeActionItem),
          dueToday: dueToday.map(serializeActionItem),
          dueTomorrow: dueTomorrow.map(serializeActionItem),
          unassigned: unassigned.map(serializeActionItem),
        },
        decisions: recentDecisions.map(serializeActionItem),
        followUps: followUps.map(serializeActionItem),
        pinned: pinned.map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          pinnedAt: m.pinnedAt?.toISOString() ?? null,
          user: m.user,
        })),
        stats: {
          messages: messages7d,
          uniqueAuthors: uniqueAuthors7d,
        },
      };
    },
  );

  /**
   * POST /api/channels/:id/digest/summary
   *
   * Запрашивает natural-language резюме у LLM на базе digest snapshot'а.
   * Сейчас не кешируем — каждый запрос свежий (digest часто меняется,
   * кэш быстро устаревает). Будущая v0.11.1 может класть в Redis с TTL=60s.
   *
   * Возвращает: { summary, provider, model, latencyMs }.
   * 503 если AI не сконфигурирован (env OPENROUTER_API_KEY / OPENAI_API_KEY).
   * 502 если все провайдеры упали.
   */
  app.post(
    "/api/channels/:id/digest/summary",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id: channelId } = req.params as { id: string };
      const membership = await requireChannelMember(userId, channelId);
      if ("error" in membership) {
        return reply
          .status(membership.error === "Channel not found" ? 404 : 403)
          .send({ error: membership.error });
      }
      if (!isAiConfigured()) {
        return reply.status(503).send({
          error: "AI не настроен на сервере",
          hint: "Admin: set OPENROUTER_API_KEY или OPENAI_API_KEY в apps/server/.env",
        });
      }
      const channel = membership.channel;
      const windowDaysRaw = Number(
        (req.body as { windowDays?: string | number } | null | undefined)?.windowDays ?? 7,
      );
      const windowDays = Number.isFinite(windowDaysRaw)
        ? Math.min(30, Math.max(1, Math.round(windowDaysRaw)))
        : 7;
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowDays * ONE_DAY_MS);
      const todayEnd = endOfDayUTC(now);
      const tomorrowStart = startOfDayUTC(new Date(now.getTime() + ONE_DAY_MS));
      const tomorrowEnd = endOfDayUTC(new Date(now.getTime() + ONE_DAY_MS));

      // Та же сборка digest что в GET /digest — extract в helper при росте.
      const openActions = await db.actionItem.findMany({
        where: { channelId, status: "OPEN" },
        include: actionItemInclude,
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 100,
      });
      const recentDecisions = await db.actionItem.findMany({
        where: { channelId, type: "DECISION", updatedAt: { gte: windowStart } },
        include: actionItemInclude,
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      const followUps = await db.actionItem.findMany({
        where: {
          channelId,
          type: "FOLLOW_UP",
          OR: [
            { status: "OPEN" },
            { status: "DONE", updatedAt: { gte: windowStart } },
          ],
        },
        include: actionItemInclude,
        orderBy: [
          { status: "asc" },
          { dueAt: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        take: 10,
      });
      const pinned = await db.message.findMany({
        where: { channelId, pinnedAt: { not: null }, deletedAt: null },
        orderBy: { pinnedAt: "desc" },
        take: 5,
        select: {
          id: true,
          content: true,
          user: { select: { displayName: true } },
        },
      });
      const messagesInWindow = await db.message.findMany({
        where: { channelId, createdAt: { gte: windowStart }, deletedAt: null },
        select: { userId: true },
      });

      const overdue: typeof openActions = [];
      const dueToday: typeof openActions = [];
      const dueTomorrow: typeof openActions = [];
      const unassigned: typeof openActions = [];
      for (const a of openActions) {
        if (a.dueAt) {
          const due = a.dueAt.getTime();
          if (due < now.getTime()) overdue.push(a);
          else if (due <= todayEnd.getTime()) dueToday.push(a);
          else if (due >= tomorrowStart.getTime() && due <= tomorrowEnd.getTime()) dueTomorrow.push(a);
        }
        if (!a.assigneeUserId) unassigned.push(a);
      }

      const adapt = (a: (typeof openActions)[number]) => ({
        type: a.type,
        title: a.title,
        dueAt: a.dueAt?.toISOString() ?? null,
        assignee: a.assignee ? { displayName: a.assignee.displayName } : null,
        status: a.status,
      });

      const prompt = digestSummaryPrompt({
        channelName: channel.name,
        windowDays,
        openActions: {
          total: openActions.length,
          overdue: overdue.map(adapt),
          dueToday: dueToday.map(adapt),
          dueTomorrow: dueTomorrow.map(adapt),
          unassigned: unassigned.map(adapt),
        },
        decisions: recentDecisions.map(adapt),
        followUps: followUps.map(adapt),
        pinned: pinned.map((p) => ({
          content: p.content,
          user: { displayName: p.user.displayName },
        })),
        stats: {
          messages: messagesInWindow.length,
          uniqueAuthors: new Set(messagesInWindow.map((m) => m.userId)).size,
        },
      });

      try {
        const result = await chat(
          [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          { temperature: 0.4, maxTokens: 350 },
        );
        return {
          summary: result.text,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        if (err instanceof AINotConfiguredError) {
          return reply.status(503).send({ error: "AI не настроен" });
        }
        if (err instanceof AIProviderError) {
          app.log.warn(
            { provider: err.provider, status: err.status, msg: err.message },
            "AI digest summary failed",
          );
          return reply.status(502).send({
            error: "AI провайдер недоступен. Попробуй позже.",
            details: `${err.provider} ${err.status ?? ""}`.trim(),
          });
        }
        throw err;
      }
    },
  );
}
