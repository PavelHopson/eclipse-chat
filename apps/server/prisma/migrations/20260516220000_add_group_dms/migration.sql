-- Group DMs (v0.52.0) — additive расширение DirectConversation на multi-participant.
--
-- Стратегия: 1-to-1 DMs остаются на legacy userAId/userBId fields (backward
-- compatible с существующими routes); group DMs идут через новую
-- ConversationParticipant join-таблицу + isGroup flag. Membership-check
-- унифицирован через helper isDmParticipant() в routes/dm.ts.
--
-- Zero-downtime: existing rows не трогаем (userAId/userBId не NULL у них),
-- только relax constraint так чтобы новые group rows могли быть с NULL.

-- 1. userAId/userBId становятся nullable. NOT NULL → DROP NOT NULL —
--    PostgreSQL делает это без table rewrite, держа existing data.
ALTER TABLE "DirectConversation" ALTER COLUMN "userAId" DROP NOT NULL;
ALTER TABLE "DirectConversation" ALTER COLUMN "userBId" DROP NOT NULL;

-- 2. Новые поля DirectConversation.
ALTER TABLE "DirectConversation"
  ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "createdByUserId" TEXT;

-- createdBy = host группы. Для legacy 1-to-1 NULL. SetNull чтобы при
-- удалении user-а group не каскадилась (host может уйти, чат остаётся).
ALTER TABLE "DirectConversation"
  ADD CONSTRAINT "DirectConversation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. ConversationParticipant — join-таблица для group DMs.
CREATE TABLE "ConversationParticipant" (
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId", "userId")
);

-- userId-индекс — для запросов «мои conversations» через participant lookup.
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
