CREATE TYPE "MemoryVisibility" AS ENUM ('ROOM', 'WORKSPACE');

ALTER TABLE "MemoryEntry"
  ADD COLUMN "visibility" "MemoryVisibility" NOT NULL DEFAULT 'ROOM',
  ADD COLUMN "ownerUserId" TEXT,
  ADD COLUMN "reviewDueAt" TIMESTAMP(3),
  ADD COLUMN "lastReviewedAt" TIMESTAMP(3),
  ADD COLUMN "lastReviewedByUserId" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "archivedByUserId" TEXT;

-- Legacy server-level entries had no channel. Keep their original scope.
UPDATE "MemoryEntry"
SET "visibility" = 'WORKSPACE'
WHERE "channelId" IS NULL;

UPDATE "MemoryEntry"
SET
  "ownerUserId" = "createdByUserId",
  "lastReviewedAt" = "updatedAt",
  "lastReviewedByUserId" = "createdByUserId";

ALTER TABLE "MemoryEntry"
  ADD CONSTRAINT "MemoryEntry_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemoryEntry"
  ADD CONSTRAINT "MemoryEntry_lastReviewedByUserId_fkey"
  FOREIGN KEY ("lastReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemoryEntry"
  ADD CONSTRAINT "MemoryEntry_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MemoryEntry_serverId_visibility_archivedAt_idx"
  ON "MemoryEntry"("serverId", "visibility", "archivedAt");
CREATE INDEX "MemoryEntry_ownerUserId_archivedAt_idx"
  ON "MemoryEntry"("ownerUserId", "archivedAt");
CREATE INDEX "MemoryEntry_reviewDueAt_idx" ON "MemoryEntry"("reviewDueAt");
CREATE INDEX "MemoryEntry_expiresAt_idx" ON "MemoryEntry"("expiresAt");
