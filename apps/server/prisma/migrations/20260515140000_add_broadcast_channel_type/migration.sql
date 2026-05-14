-- BROADCAST channel type — каналы-вещание (news/blogger, Discord×Telegram).
-- Читают все участники сервера, публикуют только OWNER/ADMIN/MODERATOR.
-- Permission gate в POST /api/channels/:id/messages.
--
-- PG12+: ALTER TYPE ... ADD VALUE допустим внутри транзакции (новое
-- значение нельзя ИСПОЛЬЗОВАТЬ в той же транзакции, но мы только добавляем).

ALTER TYPE "ChannelType" ADD VALUE 'BROADCAST';
