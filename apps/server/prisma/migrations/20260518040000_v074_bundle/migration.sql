-- v0.74 bundle: #16 EXECUTION channel type + #18 SUPPORT/ARCHITECT bot
-- roles + #29 phase 1 temporary rooms (Channel.expiresAt).
--
-- Все изменения additive, zero-downtime. Existing rows безопасны
-- (defaults preserve old behavior).
--
-- ALTER TYPE ADD VALUE требует отдельных транзакций — Prisma migrate
-- разводит их автоматически.

-- #16: новый channel type для execution rooms (kanban as room mode).
ALTER TYPE "ChannelType" ADD VALUE 'EXECUTION';

-- #18 phase 1: расширяем bot-taxonomy на SUPPORT (helpdesk / FAQ /
-- triage) и ARCHITECT (technical summaries / architecture diagrams).
ALTER TYPE "BotRole" ADD VALUE 'SUPPORT';
ALTER TYPE "BotRole" ADD VALUE 'ARCHITECT';

-- #29 phase 1: temporary rooms. expiresAt — timestamp авто-удаления.
-- NULL = постоянный канал. Cron каждую минуту чистит overdue +
-- emit'ит channel:deleted клиентам в server-room.
ALTER TABLE "Channel" ADD COLUMN "expiresAt" TIMESTAMP(3);
CREATE INDEX "Channel_expiresAt_idx" ON "Channel"("expiresAt");
