CREATE TABLE "SpecGateReview" (
    "id" TEXT NOT NULL,
    "sourceSpecId" TEXT NOT NULL,
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
    CONSTRAINT "SpecGateReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpecGateReview_serverId_sourceSpecId_key" ON "SpecGateReview"("serverId", "sourceSpecId");
CREATE UNIQUE INDEX "SpecGateReview_serverId_idempotencyKey_key" ON "SpecGateReview"("serverId", "idempotencyKey");
CREATE INDEX "SpecGateReview_serverId_reviewStatus_createdAt_idx" ON "SpecGateReview"("serverId", "reviewStatus", "createdAt");
CREATE INDEX "SpecGateReview_serverId_importedByUserId_reviewStatus_idx" ON "SpecGateReview"("serverId", "importedByUserId", "reviewStatus");

ALTER TABLE "SpecGateReview" ADD CONSTRAINT "SpecGateReview_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecGateReview" ADD CONSTRAINT "SpecGateReview_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpecGateReview" ADD CONSTRAINT "SpecGateReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
