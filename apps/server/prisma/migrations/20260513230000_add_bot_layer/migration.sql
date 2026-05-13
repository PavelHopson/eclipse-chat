-- v0.12 Bot/Operator layer:
-- Bot model + shadow-user pattern + audit log enum extension.

-- AuditEventType: добавляем 3 новых значения
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BOT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BOT_DELETED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BOT_KEY_REGENERATED';

-- Bot table
CREATE TABLE "Bot" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "avatar"       TEXT,
  "description"  TEXT,
  "apiKeyHash"   TEXT NOT NULL,
  "apiKeyPrefix" TEXT NOT NULL,
  "serverId"     TEXT NOT NULL,
  "ownerUserId"  TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "capabilities" TEXT NOT NULL DEFAULT '["send_message","react"]',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"   TIMESTAMP(3),

  CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "Bot_apiKeyPrefix_key" ON "Bot"("apiKeyPrefix");
CREATE UNIQUE INDEX "Bot_userId_key" ON "Bot"("userId");

-- Indexes для query patterns
CREATE INDEX "Bot_serverId_idx" ON "Bot"("serverId");
CREATE INDEX "Bot_ownerUserId_idx" ON "Bot"("ownerUserId");

-- Foreign keys
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
