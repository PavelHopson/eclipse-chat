-- v0.10.1 Server Identity:
-- per-server banner image, brand color override, описание и welcome-message.
-- Все nullable — для backward compat существующих серверов.

ALTER TABLE "Server" ADD COLUMN "banner" TEXT;
ALTER TABLE "Server" ADD COLUMN "brandColor" TEXT;
ALTER TABLE "Server" ADD COLUMN "description" TEXT;
ALTER TABLE "Server" ADD COLUMN "welcomeMessage" TEXT;
