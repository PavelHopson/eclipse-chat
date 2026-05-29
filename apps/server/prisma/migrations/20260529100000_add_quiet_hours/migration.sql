-- v1.5.49 Discord-parity B5 — Quiet hours.
-- Три nullable String поля на User для silencing push notifications в выбранное
-- временное окно. HH:MM формат (24-hour). timezone — IANA name (e.g.
-- "Europe/Moscow"); NULL fallback'ит на server timezone в runtime.
--
-- Semantics:
--   - оба или одно NULL → quiet hours disabled, push send always
--   - quietFrom == quietTo → effectively disabled (zero-width window)
--   - quietFrom < quietTo → same-day window (e.g. "13:00"-"14:00" lunch)
--   - quietFrom > quietTo → midnight-spanning window ("22:00"-"08:00")
--
-- Length validation на app-layer (zod в PATCH /api/users/me/quiet-hours):
-- HH:MM regex для time-strings, Intl.DateTimeFormat constructor для timezone
-- (throws на invalid IANA name).

ALTER TABLE "User"
    ADD COLUMN "quietFrom" TEXT,
    ADD COLUMN "quietTo" TEXT,
    ADD COLUMN "timezone" TEXT;
