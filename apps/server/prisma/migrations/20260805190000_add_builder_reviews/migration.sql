ALTER TYPE "AuditEventType" ADD VALUE 'BUILDER_REVIEW_IMPORTED';
ALTER TYPE "AuditEventType" ADD VALUE 'BUILDER_REVIEW_DECIDED';

CREATE TABLE "BuilderReview" (
    "id" TEXT NOT NULL,
    "sourceProjectId" TEXT NOT NULL,
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

    CONSTRAINT "BuilderReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuilderReview_serverId_sourceProjectId_key" ON "BuilderReview"("serverId", "sourceProjectId");
CREATE UNIQUE INDEX "BuilderReview_serverId_idempotencyKey_key" ON "BuilderReview"("serverId", "idempotencyKey");
CREATE INDEX "BuilderReview_serverId_reviewStatus_createdAt_idx" ON "BuilderReview"("serverId", "reviewStatus", "createdAt");
CREATE INDEX "BuilderReview_serverId_importedByUserId_reviewStatus_idx" ON "BuilderReview"("serverId", "importedByUserId", "reviewStatus");

ALTER TABLE "BuilderReview" ADD CONSTRAINT "BuilderReview_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuilderReview" ADD CONSTRAINT "BuilderReview_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuilderReview" ADD CONSTRAINT "BuilderReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
