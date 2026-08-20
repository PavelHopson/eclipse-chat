ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTOMATION_AUDIT_IMPORTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTOMATION_AUDIT_DECIDED';

CREATE TABLE "AutomationAuditReview" (
  "id" TEXT NOT NULL,
  "sourceAuditId" TEXT NOT NULL,
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
  CONSTRAINT "AutomationAuditReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomationAuditReview_serverId_sourceAuditId_key" ON "AutomationAuditReview"("serverId", "sourceAuditId");
CREATE UNIQUE INDEX "AutomationAuditReview_serverId_idempotencyKey_key" ON "AutomationAuditReview"("serverId", "idempotencyKey");
CREATE INDEX "AutomationAuditReview_serverId_reviewStatus_createdAt_idx" ON "AutomationAuditReview"("serverId", "reviewStatus", "createdAt");
CREATE INDEX "AutomationAuditReview_serverId_importedByUserId_reviewStatus_idx" ON "AutomationAuditReview"("serverId", "importedByUserId", "reviewStatus");
ALTER TABLE "AutomationAuditReview" ADD CONSTRAINT "AutomationAuditReview_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationAuditReview" ADD CONSTRAINT "AutomationAuditReview_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationAuditReview" ADD CONSTRAINT "AutomationAuditReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
