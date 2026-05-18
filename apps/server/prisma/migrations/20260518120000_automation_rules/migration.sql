-- v0.80 #26 phase 1: Automation system — declarative trigger/action rules.
--
-- Storage approach: trigger + action как TEXT (JSON-string). Гибкость
-- без новых tables на каждый тип. Phase 2 — schema может расширяться
-- разными trigger/action discriminators (FILE_UPLOAD, NEW_TASK, etc).
--
-- Evaluation: async fire-and-forget на message:new — scan enabled
-- rules сервера, match keyword/channel filter, fire action. No new
-- DB queries в hot path message-create.
--
-- Additive, zero-downtime. Existing rows не задеты.

CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFiredAt" TIMESTAMP(3),
    "fireCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRule_serverId_enabled_idx"
    ON "AutomationRule"("serverId", "enabled");

ALTER TABLE "AutomationRule"
    ADD CONSTRAINT "AutomationRule_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRule"
    ADD CONSTRAINT "AutomationRule_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
