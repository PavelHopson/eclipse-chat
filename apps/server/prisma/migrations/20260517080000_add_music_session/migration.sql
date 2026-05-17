-- Shared channel playback / listening room (v0.61.0).
--
-- Один MusicSession per channel (channelId @unique). Когда любой member
-- жмёт ▶ на audio-attachment'е, создаётся session с этим треком; все
-- members в канале слышат одновременно с одной timeline-позиции.
--
-- Sync: server держит `startedAt` (момент когда track начал играть)
-- + `positionMs` (offset на момент последнего pause/resume). Frontend
-- считает текущую позицию как:
--   position = isPlaying ? (now - startedAt + positionMs) : positionMs
--
-- v1 — без late-join drift correction (клиент рассчитывает offset из
-- REST state). v2 — periodic position-sync emit + adaptive seek при
-- drift > 1.5s.

CREATE TABLE "MusicSession" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  -- Current track. Null = idle (queue был пуст после skip) или паузан.
  "currentTrackAttachmentId" TEXT,
  -- Server timestamp: момент когда track начал играть (или ресюм).
  -- Null когда paused/idle. Frontend: timeOffset = now - startedAt.
  "startedAt" TIMESTAMP(3),
  -- Saved position при pause. На resume: startedAt = now, position
  -- продолжается от этой точки.
  "positionMs" INTEGER NOT NULL DEFAULT 0,
  "isPlaying" BOOLEAN NOT NULL DEFAULT false,
  -- JSON-string array of attachmentIds в очереди (после current).
  -- Пустая очередь = "[]".
  "queue" TEXT NOT NULL DEFAULT '[]',
  -- Host — кто запустил сессию. Может pause / resume / skip / stop.
  -- MEMBER может добавлять в queue. MOD+ может override host actions.
  "hostUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MusicSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MusicSession_channelId_key" ON "MusicSession"("channelId");

ALTER TABLE "MusicSession"
  ADD CONSTRAINT "MusicSession_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Attachment может быть удалён — onDelete SetNull чтобы session-row
-- осталась, UI покажет "трек недоступен".
ALTER TABLE "MusicSession"
  ADD CONSTRAINT "MusicSession_currentTrackAttachmentId_fkey"
  FOREIGN KEY ("currentTrackAttachmentId") REFERENCES "Attachment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MusicSession"
  ADD CONSTRAINT "MusicSession_hostUserId_fkey"
  FOREIGN KEY ("hostUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
