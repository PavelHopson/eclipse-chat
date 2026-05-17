-- v0.67: LinkEmbed — кэш OG-preview карточек для URL в сообщениях.
--
-- Один URL может приходить от десятков юзеров (одна и та же статья
-- расшаривается) — не хотим fetch'ить каждый раз. TTL 7 дней:
-- статичные страницы редко меняют OG meta, для свежака приемлемо.
--
-- url @unique = upsert pattern. status: 'OK' / 'FAILED' (после неудачной
-- попытки тоже кэшируем чтобы не долбить bad URL). Старые FAILED через
-- 24h можно retry — frontend всё равно покажет fallback link.
--
-- size cap: каждое поле String с зодом max'ом в backend (title 300,
-- description 600, image URL 2048, siteName 100). Никаких unbounded
-- text-fields.

CREATE TYPE "LinkEmbedStatus" AS ENUM ('OK', 'FAILED');

CREATE TABLE "LinkEmbed" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "LinkEmbedStatus" NOT NULL DEFAULT 'OK',
    "title" TEXT,
    "description" TEXT,
    "image" TEXT,
    "siteName" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "error" TEXT,

    CONSTRAINT "LinkEmbed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkEmbed_url_key" ON "LinkEmbed"("url");
CREATE INDEX "LinkEmbed_expiresAt_idx" ON "LinkEmbed"("expiresAt");
