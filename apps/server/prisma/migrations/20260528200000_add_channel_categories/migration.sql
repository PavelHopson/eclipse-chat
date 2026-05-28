-- v1.5.46 Discord-parity C1 — Channel categories.
--
-- Новая модель ChannelCategory: группировка каналов внутри сервера
-- ("Underground", "Clubhouse" в Discord). Channel получает nullable
-- categoryId FK; NULL = uncategorized (рендерится наверху списка).
--
-- Cascade:
--   ChannelCategory.serverId -> Server: Cascade (удаление server'а чистит)
--   Channel.categoryId -> ChannelCategory: SetNull (удаление категории
--     не теряет каналы — они переходят в uncategorized).
--
-- Position invariants enforce'аются на app-layer:
--   - Категории per-server: ordered by position
--   - Каналы per-(categoryId | null): ordered by Channel.position
--
-- Channel.position existing semantics остаётся (per-category index, не
-- global per-server). Migration не сбрасывает существующие позиции,
-- existing channels получают categoryId = NULL → все попадают в
-- uncategorized список со своими existing position'ами.

CREATE TABLE "ChannelCategory" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChannelCategory_serverId_position_idx" ON "ChannelCategory"("serverId", "position");

ALTER TABLE "ChannelCategory" ADD CONSTRAINT "ChannelCategory_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Channel.categoryId — nullable FK.
ALTER TABLE "Channel" ADD COLUMN "categoryId" TEXT;

CREATE INDEX "Channel_categoryId_position_idx" ON "Channel"("categoryId", "position");

ALTER TABLE "Channel" ADD CONSTRAINT "Channel_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ChannelCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
