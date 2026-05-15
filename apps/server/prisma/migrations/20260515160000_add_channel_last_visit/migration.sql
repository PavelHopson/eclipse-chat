-- ChannelLastVisit — AI Memory «Since your last visit». Last-visit per
-- (user, channel) для дельта-сводки «пока тебя не было». Composite PK,
-- onDelete:Cascade на оба внешних ключа.

CREATE TABLE "ChannelLastVisit" (
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelLastVisit_pkey" PRIMARY KEY ("userId","channelId")
);

CREATE INDEX "ChannelLastVisit_userId_idx" ON "ChannelLastVisit"("userId");

ALTER TABLE "ChannelLastVisit"
  ADD CONSTRAINT "ChannelLastVisit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelLastVisit"
  ADD CONSTRAINT "ChannelLastVisit_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
