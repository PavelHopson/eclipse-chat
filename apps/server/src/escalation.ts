import type { FastifyBaseLogger } from "fastify";
import { actionItemInclude, serializeActionItem } from "./actionItems.js";
import { db } from "./db.js";
import { notifyUsers } from "./lib/webPush.js";
import { emitActionItemEscalated, emitActionItemUpdated } from "./realtime.js";

/**
 * v0.73 #20 phase 3: Escalation scan.
 *
 * Каждый ESCALATION_INTERVAL_MS обходим ActionItem'ы которые:
 *   * не закрыты (status ∈ OPEN, IN_PROGRESS, REVIEW);
 *   * имеют dueAt и dueAt < now - 48h;
 *   * не эскалировались никогда ИЛИ escalatedAt < now - 7d (cooldown).
 *
 * Для каждой:
 *   1. Set escalatedAt = now.
 *   2. Insert activity-log (ESCALATED).
 *   3. Emit `action:item:escalated` socket event в server+channel rooms.
 *      Frontend (useNotifications) показывает desktop notification
 *      assignee и creator'у.
 *
 * Cron interval — раз в час; overdue 48h+ задачи редко добавляются партиями,
 * поэтому 60s sweep избыточен. PROCESS_LIMIT = 50 за один проход — защита
 * от runaway notifications (если кто-то bulk-импортировал просроченные).
 */

const ESCALATION_INTERVAL_MS = 60 * 60 * 1000; // 1 час
const OVERDUE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 часов
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней
const PROCESS_LIMIT = 50;

let timer: NodeJS.Timeout | null = null;

export function startEscalationCron(log: FastifyBaseLogger): void {
  if (timer) return;
  // Первый запуск через 30s после boot — чтобы дать миграциям/recovery
  // отработать. Дальше — раз в час.
  timer = setTimeout(function tick() {
    runEscalationScan(log)
      .catch((err) => log.error({ err }, "Escalation scan failed"))
      .finally(() => {
        timer = setTimeout(tick, ESCALATION_INTERVAL_MS);
      });
  }, 30_000);
}

export function stopEscalationCron(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

export async function runEscalationScan(log: FastifyBaseLogger): Promise<{
  scanned: number;
  escalated: number;
}> {
  const now = new Date();
  const overdueBefore = new Date(now.getTime() - OVERDUE_THRESHOLD_MS);
  const cooldownBefore = new Date(now.getTime() - COOLDOWN_MS);

  const candidates = await db.actionItem.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "REVIEW"] },
      dueAt: { lt: overdueBefore, not: null },
      OR: [{ escalatedAt: null }, { escalatedAt: { lt: cooldownBefore } }],
    },
    take: PROCESS_LIMIT,
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      serverId: true,
      channelId: true,
      title: true,
      dueAt: true,
      assigneeUserId: true,
      createdByUserId: true,
    },
  });

  if (candidates.length === 0) {
    return { scanned: 0, escalated: 0 };
  }

  let escalated = 0;
  for (const item of candidates) {
    try {
      await db.$transaction(async (tx) => {
        await tx.actionItem.update({
          where: { id: item.id },
          data: { escalatedAt: now },
        });
        await tx.actionItemActivity.create({
          data: {
            actionItemId: item.id,
            userId: null,
            type: "ESCALATED",
            payload: JSON.stringify({
              dueAt: item.dueAt?.toISOString() ?? null,
              overdueByHours: item.dueAt
                ? Math.floor((now.getTime() - item.dueAt.getTime()) / 3_600_000)
                : null,
            }),
          },
        });
      });

      // Эмитим обновлённый ActionItemPayload — клиенты увидят escalatedAt
      // и activity (когда reload'нут drawer).
      const after = await db.actionItem.findUnique({
        where: { id: item.id },
        include: actionItemInclude,
      });
      if (after) {
        emitActionItemUpdated(item.channelId, serializeActionItem(after));
      }

      emitActionItemEscalated(item.channelId, item.serverId, {
        actionItemId: item.id,
        title: item.title,
        serverId: item.serverId,
        channelId: item.channelId,
        dueAt: item.dueAt?.toISOString() ?? null,
        assigneeUserId: item.assigneeUserId,
        createdByUserId: item.createdByUserId,
        escalatedAt: now.toISOString(),
      });
      // v0.84 #27 phase 3: push assignee + creator (de-duped в notifyUsers).
      const recipients = [item.assigneeUserId, item.createdByUserId].filter(
        (id): id is string => Boolean(id),
      );
      void notifyUsers(
        recipients,
        "escalation",
        {
          title: `Эскалация: ${item.title}`,
          body: `Задача просрочена на 48+ часов и до сих пор открыта.`,
          url: `/eclipse-chat/`,
          tag: `escalation-${item.id}`,
          channelId: item.channelId,
        },
        log,
      );
      escalated += 1;
    } catch (err) {
      log.warn({ err, actionItemId: item.id }, "Failed to escalate action");
    }
  }

  log.info(
    { scanned: candidates.length, escalated },
    "Escalation scan complete",
  );
  return { scanned: candidates.length, escalated };
}
