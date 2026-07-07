-- v1.7.0 — исчезающие сообщения (privacy slice A).
--
-- Channel.messageTtlSeconds: дефолтный TTL канала (секунды; NULL = выкл).
-- Message.expiresAt: момент авто-удаления конкретного сообщения (NULL = постоянное),
-- вычисляется при отправке из TTL канала или пер-сообщение override. Cron
-- (expiredMessages.ts) сканит по индексу и hard-удаляет истёкшие.

ALTER TABLE "Channel" ADD COLUMN "messageTtlSeconds" INTEGER;
ALTER TABLE "Message" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "Message_expiresAt_idx" ON "Message"("expiresAt");
