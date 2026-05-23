-- v1.2.27 — Bot personality overlay (character / humor / tone).
-- Additive nullable column. Не ломает существующих ботов: NULL = роль-prompt
-- работает как раньше.

ALTER TABLE "Bot" ADD COLUMN "personality" TEXT;
