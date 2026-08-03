CREATE TYPE "BotActionApprovalStatus" AS ENUM (
  'PENDING',
  'EXECUTING',
  'SUCCEEDED',
  'REJECTED',
  'EXPIRED',
  'FAILED'
);

CREATE TABLE "BotActionApproval" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "sourceChannelId" TEXT,
  "tool" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "preview" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "BotActionApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "failureCode" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BotActionApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BotActionApproval_serverId_status_createdAt_idx"
  ON "BotActionApproval"("serverId", "status", "createdAt");
CREATE INDEX "BotActionApproval_botId_status_requestHash_idx"
  ON "BotActionApproval"("botId", "status", "requestHash");
CREATE INDEX "BotActionApproval_status_expiresAt_idx"
  ON "BotActionApproval"("status", "expiresAt");

ALTER TABLE "BotActionApproval"
  ADD CONSTRAINT "BotActionApproval_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotActionApproval"
  ADD CONSTRAINT "BotActionApproval_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotActionApproval"
  ADD CONSTRAINT "BotActionApproval_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
