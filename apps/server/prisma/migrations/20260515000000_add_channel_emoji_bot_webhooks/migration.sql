-- v0.14.0: batched migration для channel customization + bot webhooks

-- Channel.emoji: nullable string (single emoji char, валидация в zod).
-- Заменяет # / 🔊 prefix в UI если задан. Не trim'им, оставляем raw —
-- чтобы поддержать compound emoji вроде 👨‍💻 без mangling.
ALTER TABLE "Channel" ADD COLUMN "emoji" TEXT;

-- Bot webhooks: outbound HTTP POST на новые сообщения в каналах
-- того же server'а где живёт bot. Bot подписывается на event-types
-- через webhookEvents (JSON массив).
--
-- webhookUrl: HTTPS URL куда POST'ить (max 512 chars в zod).
-- webhookSecret: shared secret для HMAC-SHA256 signing (header X-Eclipse-Bot-Signature).
--   Если задан — каждый webhook POST включает signature header для verify.
-- webhookEvents: JSON массив subscribed event'ов, default '["message.created"]'.
--   Currently supported: "message.created". В будущем — "reaction.added",
--   "thread.reply", etc.
ALTER TABLE "Bot" ADD COLUMN "webhookUrl" TEXT;
ALTER TABLE "Bot" ADD COLUMN "webhookSecret" TEXT;
ALTER TABLE "Bot" ADD COLUMN "webhookEvents" TEXT NOT NULL DEFAULT '["message.created"]';
