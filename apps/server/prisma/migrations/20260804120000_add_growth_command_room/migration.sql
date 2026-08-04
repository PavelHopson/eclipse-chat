CREATE TYPE "GrowthRunReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GROWTH_RUN_IMPORTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GROWTH_RUN_REVIEWED';

CREATE TABLE "GrowthRun" (
  "id" TEXT NOT NULL,
  "sourceRunId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "importedByUserId" TEXT,
  "schemaVersion" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reviewStatus" "GrowthRunReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GrowthRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GrowthRun_serverId_sourceRunId_key"
  ON "GrowthRun"("serverId", "sourceRunId");
CREATE UNIQUE INDEX "GrowthRun_serverId_idempotencyKey_key"
  ON "GrowthRun"("serverId", "idempotencyKey");
CREATE INDEX "GrowthRun_serverId_reviewStatus_createdAt_idx"
  ON "GrowthRun"("serverId", "reviewStatus", "createdAt");
CREATE INDEX "GrowthRun_serverId_importedByUserId_reviewStatus_idx"
  ON "GrowthRun"("serverId", "importedByUserId", "reviewStatus");

ALTER TABLE "GrowthRun"
  ADD CONSTRAINT "GrowthRun_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthRun"
  ADD CONSTRAINT "GrowthRun_importedByUserId_fkey"
  FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrowthRun"
  ADD CONSTRAINT "GrowthRun_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
