-- v0.77 #21 phase 1: MessageEmbedding для семантического поиска.
--
-- Storage approach: Float[] array (Postgres native `double precision[]`),
-- NOT pgvector. Reason: pgvector это apt-package, может не быть на проде
-- (cv6067007 native PG 16). Native arrays работают без extensions.
--
-- Cosine similarity вычисляется в Node при поиске — для small workspaces
-- (<30K сообщений) приемлемая latency. Future миграция на pgvector +
-- IVFFlat index — отдельный slice когда упрёмся в потолок.
--
-- Schema additive, zero-downtime. Sync writes идут fire-and-forget после
-- POST message — отказ embedding-провайдера не блокирует message create.

CREATE TABLE "MessageEmbedding" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "vector" DOUBLE PRECISION[],
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageEmbedding_messageId_key"
    ON "MessageEmbedding"("messageId");

CREATE INDEX "MessageEmbedding_model_createdAt_idx"
    ON "MessageEmbedding"("model", "createdAt");

ALTER TABLE "MessageEmbedding"
    ADD CONSTRAINT "MessageEmbedding_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
