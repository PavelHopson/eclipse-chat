-- v1.7.3: curated room/project memory.
CREATE TYPE "MemoryEntryKind" AS ENUM ('NOTE', 'DECISION', 'RISK', 'FACT', 'LINK', 'ACTION');

CREATE TABLE "MemoryEntry" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "channelId" TEXT,
  "kind" "MemoryEntryKind" NOT NULL DEFAULT 'NOTE',
  "title" TEXT NOT NULL,
  "content" TEXT,
  "tags" TEXT,
  "sourceMessageId" TEXT,
  "actionItemId" TEXT,
  "createdByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemoryEntry_serverId_createdAt_idx" ON "MemoryEntry"("serverId", "createdAt");
CREATE INDEX "MemoryEntry_channelId_createdAt_idx" ON "MemoryEntry"("channelId", "createdAt");
CREATE INDEX "MemoryEntry_kind_createdAt_idx" ON "MemoryEntry"("kind", "createdAt");
CREATE INDEX "MemoryEntry_archivedAt_idx" ON "MemoryEntry"("archivedAt");

ALTER TABLE "MemoryEntry"
  ADD CONSTRAINT "MemoryEntry_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryEntry"
  ADD CONSTRAINT "MemoryEntry_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryEntry"
  ADD CONSTRAINT "MemoryEntry_sourceMessageId_fkey"
  FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemoryEntry"
  ADD CONSTRAINT "MemoryEntry_actionItemId_fkey"
  FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemoryEntry"
  ADD CONSTRAINT "MemoryEntry_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
