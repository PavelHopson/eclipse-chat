-- v0.85 #27 phase 4: per-event-type push preferences + per-channel mute.
-- Additive — нет existing rows; default behavior для всех users неизменна
-- (отсутствие prefs row = все типы enabled).

CREATE TABLE "NotificationPreferences" (
    "userId"      TEXT NOT NULL,
    "mentions"    BOOLEAN NOT NULL DEFAULT true,
    "dms"         BOOLEAN NOT NULL DEFAULT true,
    "assignments" BOOLEAN NOT NULL DEFAULT true,
    "approvals"   BOOLEAN NOT NULL DEFAULT true,
    "escalations" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MutedChannel" (
    "userId"    TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "mutedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutedChannel_pkey" PRIMARY KEY ("userId", "channelId")
);

CREATE INDEX "MutedChannel_channelId_idx" ON "MutedChannel"("channelId");

ALTER TABLE "MutedChannel" ADD CONSTRAINT "MutedChannel_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MutedChannel" ADD CONSTRAINT "MutedChannel_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
