-- Bot.role — типология ботов, превращает их из generic shadow-users в
-- embedded role-aware participants:
--   GENERIC   — default, без специализации
--   MODERATOR — следит за каналом, помогает с этикетом/предупреждениями
--   PM        — отслеживает задачи / решения / follow-up
--   KNOWLEDGE — отвечает на вопросы по контексту сервера
--   SALES     — outreach / клиентские диалоги
-- Existing bots получают GENERIC по умолчанию (backward compat).

CREATE TYPE "BotRole" AS ENUM ('GENERIC', 'MODERATOR', 'PM', 'KNOWLEDGE', 'SALES');

ALTER TABLE "Bot"
  ADD COLUMN "role" "BotRole" NOT NULL DEFAULT 'GENERIC';
