BEGIN;

-- Run the compatibility preflight before any DDL. Prisma does not wrap
-- PostgreSQL migrations automatically, so the explicit transaction guarantees
-- a duplicate abort leaves no enum, column, table, or index half-applied.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "OfficeIngestNonce"
    GROUP BY "producerId", "nonce"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'OfficeIngestNonce contains duplicate producerId/nonce pairs; resolve before migration';
  END IF;
END $$;

ALTER TYPE "AuditEventType" ADD VALUE 'OFFICE_OUTBOX_REDRIVEN';

ALTER TABLE "GrowthRun"
  ADD COLUMN "executionLeaseId" TEXT,
  ADD COLUMN "executionLeaseUserId" TEXT,
  ADD COLUMN "executionLeaseStep" TEXT,
  ADD COLUMN "executionLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "executionCancelRequestedAt" TIMESTAMP(3);

CREATE INDEX "GrowthRun_executionLeaseUntil_idx"
  ON "GrowthRun"("executionLeaseUntil");

-- Preserve the previous replay horizon while binaries and HMAC keys roll.
-- This cannot resurrect receipts already deleted before the migration, so key
-- rotation must remain frozen until this migration is applied everywhere.
UPDATE "OfficeIngestNonce"
SET "expiresAt" = GREATEST(
  "expiresAt",
  CURRENT_TIMESTAMP + INTERVAL '30 days'
)
WHERE "expiresAt" < CURRENT_TIMESTAMP + INTERVAL '30 days';

-- Keep OfficeIngestNonce_keyId_nonce_key during the rolling compatibility window.
-- A later cleanup migration may drop it after every old server binary is drained.

CREATE UNIQUE INDEX "OfficeIngestNonce_producerId_nonce_key"
  ON "OfficeIngestNonce"("producerId", "nonce");

ALTER TABLE "OfficeEventOutbox"
  ADD COLUMN "claimToken" TEXT,
  ADD COLUMN "claimUntil" TIMESTAMP(3),
  ADD COLUMN "redriveCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastRedrivenAt" TIMESTAMP(3),
  ADD COLUMN "lastRedrivenByUserId" TEXT,
  ADD COLUMN "lastRedriveReason" TEXT,
  ADD COLUMN "lastDiscardedAt" TIMESTAMP(3),
  ADD COLUMN "lastDiscardErrorCode" TEXT,
  ADD COLUMN "lastDiscardAttempts" INTEGER;

CREATE INDEX "OfficeEventOutbox_deliveredAt_discardedAt_claimUntil_availableAt_createdAt_idx"
  ON "OfficeEventOutbox"("deliveredAt", "discardedAt", "claimUntil", "availableAt", "createdAt");

CREATE TABLE "OfficeEventOutboxRedriveReceipt" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "outboxId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "priorDiscardedAt" TIMESTAMP(3) NOT NULL,
  "priorErrorCode" TEXT NOT NULL,
  "priorAttempts" INTEGER NOT NULL,
  "redriveNumber" INTEGER NOT NULL,
  "redrivenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficeEventOutboxRedriveReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfficeEventOutboxRedriveReceipt_outboxId_redriveNumber_key"
  ON "OfficeEventOutboxRedriveReceipt"("outboxId", "redriveNumber");

CREATE INDEX "OfficeEventOutboxRedriveReceipt_batchId_idx"
  ON "OfficeEventOutboxRedriveReceipt"("batchId");

CREATE INDEX "OfficeEventOutboxRedriveReceipt_serverId_redrivenAt_idx"
  ON "OfficeEventOutboxRedriveReceipt"("serverId", "redrivenAt");

ALTER TABLE "OfficeEventOutboxRedriveReceipt"
  ADD CONSTRAINT "OfficeEventOutboxRedriveReceipt_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GrowthAiUsageCharge" (
  "executionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrowthAiUsageCharge_pkey" PRIMARY KEY ("executionId")
);

CREATE INDEX "GrowthAiUsageCharge_userId_day_idx"
  ON "GrowthAiUsageCharge"("userId", "day");

ALTER TABLE "GrowthAiUsageCharge"
  ADD CONSTRAINT "GrowthAiUsageCharge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;