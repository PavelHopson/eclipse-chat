ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CREATIVE_JOB_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CREATIVE_JOB_REVIEWED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CREATIVE_JOB_EXECUTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CREATIVE_PACKAGE_DOWNLOADED';

CREATE TABLE "CreativeJob" (
  "id" TEXT NOT NULL,
  "sourceJobId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "lastExecutionKey" TEXT,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreativeJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreativeJob_serverId_sourceJobId_key"
  ON "CreativeJob"("serverId", "sourceJobId");
CREATE UNIQUE INDEX "CreativeJob_serverId_idempotencyKey_key"
  ON "CreativeJob"("serverId", "idempotencyKey");
CREATE INDEX "CreativeJob_serverId_status_createdAt_idx"
  ON "CreativeJob"("serverId", "status", "createdAt");
CREATE INDEX "CreativeJob_serverId_createdByUserId_status_idx"
  ON "CreativeJob"("serverId", "createdByUserId", "status");

ALTER TABLE "CreativeJob"
  ADD CONSTRAINT "CreativeJob_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
