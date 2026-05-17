-- v0.73 #20 phase 3 + 4: escalation cron + AI summary per-task.
--
-- Phase 3 — escalation:
--   * `escalatedAt` timestamp фиксирует последнюю эскалацию.
--   * Cron каждый час scan'ит overdue 48h+ задачи где
--     (escalatedAt IS NULL OR escalatedAt < now() - 7 days)
--     и status ∈ (OPEN, IN_PROGRESS, REVIEW).
--   * Эскалация: emit socket `action:item:escalated` + activity-log
--     (ESCALATED). UI показывает badge + toast notification.
--
-- Phase 4 — AI summary:
--   * `aiSummary` + `aiSummaryUpdatedAt` — кэш 2-3 строчной сводки.
--   * POST /api/actions/:id/ai-summary генерит через AI provider chain
--     (description + recent comments → краткое резюме). Любой member.
--   * Активность ESCALATED / AI_SUMMARY_GENERATED — новые типы.
--
-- Schema additive, zero-downtime. Existing rows: escalatedAt=NULL,
-- aiSummary=NULL — UI безопасно их не показывает.

ALTER TYPE "ActionItemActivityType" ADD VALUE 'ESCALATED';
ALTER TYPE "ActionItemActivityType" ADD VALUE 'AI_SUMMARY_GENERATED';

ALTER TABLE "ActionItem"
  ADD COLUMN "escalatedAt" TIMESTAMP(3),
  ADD COLUMN "aiSummary" TEXT,
  ADD COLUMN "aiSummaryUpdatedAt" TIMESTAMP(3);

-- Индекс по (status, dueAt) для быстрого scan'а в cron'е.
CREATE INDEX "ActionItem_status_dueAt_idx" ON "ActionItem"("status", "dueAt");
