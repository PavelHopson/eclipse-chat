ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DECK_REVIEW_IMPORTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DECK_REVIEW_DECIDED';

CREATE TABLE "DeckReview" (
  "id" TEXT NOT NULL,
  "sourceJobId" TEXT NOT NULL,
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

  CONSTRAINT "DeckReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeckReview_serverId_sourceJobId_key"
  ON "DeckReview"("serverId", "sourceJobId");
CREATE UNIQUE INDEX "DeckReview_serverId_idempotencyKey_key"
  ON "DeckReview"("serverId", "idempotencyKey");
CREATE INDEX "DeckReview_serverId_reviewStatus_createdAt_idx"
  ON "DeckReview"("serverId", "reviewStatus", "createdAt");
CREATE INDEX "DeckReview_serverId_importedByUserId_reviewStatus_idx"
  ON "DeckReview"("serverId", "importedByUserId", "reviewStatus");

ALTER TABLE "DeckReview"
  ADD CONSTRAINT "DeckReview_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckReview"
  ADD CONSTRAINT "DeckReview_importedByUserId_fkey"
  FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeckReview"
  ADD CONSTRAINT "DeckReview_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
