-- v0.88 #23 phase 1a: shared voice-room notepad.
-- Phase 1a — plain text + version counter (last-writer-wins).
-- Phase 1b — мигрируем content на BYTEA для Yjs CRDT binary state.

CREATE TABLE "VoiceNote" (
    "id"               TEXT NOT NULL,
    "channelId"        TEXT NOT NULL,
    "content"          TEXT NOT NULL DEFAULT '',
    "version"          INTEGER NOT NULL DEFAULT 0,
    "lastEditorUserId" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoiceNote_channelId_key" ON "VoiceNote"("channelId");
CREATE INDEX "VoiceNote_channelId_idx" ON "VoiceNote"("channelId");

ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_lastEditorUserId_fkey"
    FOREIGN KEY ("lastEditorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
