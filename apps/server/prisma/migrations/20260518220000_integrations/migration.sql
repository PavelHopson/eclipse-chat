-- v0.89 #26 phase 2: external integrations (Telegram outgoing, GitHub webhook).
-- Additive. Cascade на server delete; SetNull при удалении создателя.

CREATE TYPE "IntegrationType" AS ENUM ('TELEGRAM_OUTGOING', 'GITHUB_WEBHOOK');

CREATE TABLE "Integration" (
    "id"              TEXT NOT NULL,
    "serverId"        TEXT NOT NULL,
    "type"            "IntegrationType" NOT NULL,
    "name"            TEXT NOT NULL,
    "config"          TEXT NOT NULL,
    "channelId"       TEXT,
    "webhookPath"     TEXT,
    "webhookSecret"   TEXT,
    "enabled"         BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "lastEventAt"     TIMESTAMP(3),
    "eventCount"      INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Integration_webhookPath_key" ON "Integration"("webhookPath");
CREATE INDEX "Integration_serverId_enabled_idx" ON "Integration"("serverId", "enabled");
CREATE INDEX "Integration_type_idx" ON "Integration"("type");

ALTER TABLE "Integration" ADD CONSTRAINT "Integration_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
