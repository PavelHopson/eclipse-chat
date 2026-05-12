-- Add DirectConversation table for 1-to-1 DMs
CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

-- Уникальная пара (нормализуем userA < userB на app-уровне)
CREATE UNIQUE INDEX "DirectConversation_userAId_userBId_key"
    ON "DirectConversation"("userAId", "userBId");

-- Индексы для GET /api/dm/conversations (sort by lastMessageAt desc для одной из сторон)
CREATE INDEX "DirectConversation_userAId_lastMessageAt_idx"
    ON "DirectConversation"("userAId", "lastMessageAt");
CREATE INDEX "DirectConversation_userBId_lastMessageAt_idx"
    ON "DirectConversation"("userBId", "lastMessageAt");

-- Foreign keys на User. CASCADE: если user удалён → все его DM удалены.
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_userAId_fkey"
    FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_userBId_fkey"
    FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Message: channelId становится NULL-разрешённым (DM-сообщения не имеют channel)
-- + добавляется conversationId.
ALTER TABLE "Message" DROP CONSTRAINT "Message_channelId_fkey";
ALTER TABLE "Message" ALTER COLUMN "channelId" DROP NOT NULL;
ALTER TABLE "Message" ADD COLUMN "conversationId" TEXT;

ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Индекс для GET DM messages (per conversation, sort by createdAt)
CREATE INDEX "Message_conversationId_createdAt_idx"
    ON "Message"("conversationId", "createdAt");

-- App-level invariant: ровно одно из (channelId, conversationId) NOT NULL.
-- Prisma не имеет check constraints в schema, но мы можем добавить
-- raw SQL constraint здесь для defense-in-depth (postgres support):
ALTER TABLE "Message" ADD CONSTRAINT "Message_channel_or_conversation"
    CHECK (
        ("channelId" IS NOT NULL AND "conversationId" IS NULL)
        OR ("channelId" IS NULL AND "conversationId" IS NOT NULL)
    );
