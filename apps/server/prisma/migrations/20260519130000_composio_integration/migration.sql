-- v1.0.1 #11.5 Composio Automation Expansion.
-- Adds per-server connections к Composio (https://composio.dev) — proxy
-- к 500+ OAuth-managed apps (Gmail / Slack / Notion / Jira / Asana / etc).
--
-- Idempotent: ALTER TYPE ADD VALUE использует IF NOT EXISTS.
-- Schema: новая таблица ComposioConnection + 3 audit event типа.
-- Encrypted columns: encryptedAuth (AES-256-GCM с TWOFA_ENCRYPTION_KEY).

-- 1. Extend AuditEventType enum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'COMPOSIO_CONNECTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'COMPOSIO_DISCONNECTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'COMPOSIO_ACTION_EXECUTED';

-- 2. ComposioConnection table
CREATE TABLE "ComposioConnection" (
  "id"               TEXT NOT NULL,
  "serverId"         TEXT NOT NULL,
  "appName"          TEXT NOT NULL,
  "displayName"      TEXT NOT NULL,
  "composioConnId"   TEXT NOT NULL,
  "encryptedAuth"    TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"       TIMESTAMP(3),
  CONSTRAINT "ComposioConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ComposioConnection_serverId_idx" ON "ComposioConnection"("serverId");
CREATE UNIQUE INDEX "ComposioConnection_serverId_appName_key" ON "ComposioConnection"("serverId", "appName");

ALTER TABLE "ComposioConnection"
  ADD CONSTRAINT "ComposioConnection_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComposioConnection"
  ADD CONSTRAINT "ComposioConnection_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
