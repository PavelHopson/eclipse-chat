ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GROWTH_RUN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GROWTH_STEP_EXECUTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GROWTH_STEP_CANCELLED';

ALTER TABLE "GrowthRun"
  ADD COLUMN "lastExecutionKey" TEXT,
  ADD COLUMN "lastExecutedStep" TEXT;

CREATE TABLE "GrowthAiUsage" (
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "requests" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GrowthAiUsage_pkey" PRIMARY KEY ("userId", "day")
);

CREATE INDEX "GrowthAiUsage_day_idx" ON "GrowthAiUsage"("day");

ALTER TABLE "GrowthAiUsage"
  ADD CONSTRAINT "GrowthAiUsage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
