CREATE TYPE "ActionItemType" AS ENUM ('TASK', 'DECISION', 'FOLLOW_UP');
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'DONE');

CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ActionItemType" NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "assigneeUserId" TEXT,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionItem_sourceMessageId_type_key"
    ON "ActionItem"("sourceMessageId", "type");

CREATE INDEX "ActionItem_channelId_status_createdAt_idx"
    ON "ActionItem"("channelId", "status", "createdAt");

CREATE INDEX "ActionItem_serverId_status_createdAt_idx"
    ON "ActionItem"("serverId", "status", "createdAt");

CREATE INDEX "ActionItem_assigneeUserId_status_idx"
    ON "ActionItem"("assigneeUserId", "status");

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_sourceMessageId_fkey"
    FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_assigneeUserId_fkey"
    FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
