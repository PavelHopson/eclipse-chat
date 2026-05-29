-- v1.5.58 Discord-parity E3 — Server feature chips.
--
-- Nullable JSON-encoded String[] на Server: до 5 элементов, каждый
-- ≤40 chars (validate'ится в app-layer zod на PATCH /api/servers/:id).
-- NULL = no chips configured (default). Frontend парсит JSON, рендерит
-- chips в WelcomeHero для onboarding'а новых member'ов.
--
-- Hex storage: TEXT поле, value = JSON.stringify(["chip1", "chip2", ...]).
-- Никаких database-level constraints на shape — всё на app-layer.

ALTER TABLE "Server"
    ADD COLUMN "features" TEXT;
