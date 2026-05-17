-- Message.userId Cascade -> SetNull (v0.63.0 cascade policy B).
--
-- Раньше: User delete → cascade удалял все Messages этого юзера. История
-- bot'а исчезала вместе с shadow user, ручное удаление пользователя
-- стирало переписку без следа.
--
-- Теперь: nullable + SetNull. После удаления юзера Messages остаются,
-- автор = NULL, frontend рендерит «Удалённый пользователь». Стандартный
-- chat-app паттерн (Slack/Discord/Telegram-style preservation).
--
-- Existing rows backward-compat: все текущие Message.userId заполнены,
-- migration просто меняет nullability + cascade policy. Никаких backfill'ов
-- или data-mutation. Zero downtime.

ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

ALTER TABLE "Message" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
