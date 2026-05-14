-- v0.15.0: Incident Mode — операторский workflow для разбора инцидентов.
--
-- Incident — временный «контур разбора»: создаёт dedicated channel,
-- собирает timeline (ActionItems + decisions + pinned), при resolve
-- генерит post-mortem через Ollama.

-- Enum статуса инцидента
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    -- channelId: dedicated TEXT-канал инцидента. onDelete SET NULL —
    -- если канал удалят руками, Incident-запись остаётся (history).
    "channelId" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    -- post-mortem markdown — генерится Ollama при resolve, nullable пока OPEN
    "postMortem" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Incident_serverId_status_idx" ON "Incident"("serverId", "status");
-- channelId UNIQUE — Incident ↔ Channel строго 1-to-1
CREATE UNIQUE INDEX "Incident_channelId_key" ON "Incident"("channelId");

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_openedByUserId_fkey"
  FOREIGN KEY ("openedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Channel.incidentId — back-reference: channel знает что он incident-канал.
-- Nullable: обычные каналы имеют NULL. UI рисует incident badge если set.
ALTER TABLE "Channel" ADD COLUMN "incidentId" TEXT;
CREATE UNIQUE INDEX "Channel_incidentId_key" ON "Channel"("incidentId");
ALTER TABLE "Channel"
  ADD CONSTRAINT "Channel_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
