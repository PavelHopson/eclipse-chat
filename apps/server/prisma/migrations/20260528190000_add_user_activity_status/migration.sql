-- v1.5.45 Discord-parity A3 — Custom user status.
-- Два nullable текстовых поля на User: activityText (free-form до 128 символов,
-- Discord parity) и activityEmoji (unicode emoji + ZWJ sequences до 64 символов).
-- Оба NULL по умолчанию — отсутствие custom-сообщения = классическое поведение
-- (только presence dot). Дополнительных таблиц / enum'ов не требуется.
--
-- Length limits enforce'аются на app-layer (zod в PATCH /api/users/me/activity).
-- Постгрес VARCHAR без length-кепа = unlimited, не блокируем стратегически —
-- если когда-то нужно поднять до 256 char'ов, миграция не нужна.

ALTER TABLE "User"
    ADD COLUMN "activityText" TEXT,
    ADD COLUMN "activityEmoji" TEXT;
