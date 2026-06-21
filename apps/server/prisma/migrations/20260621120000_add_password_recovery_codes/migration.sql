-- v1.6.68 — self-serve password recovery codes (forgot-password без email/SMTP).
-- Одно nullable TEXT поле на User: JSON-array bcrypt-хэшей одноразовых кодов.
-- NULL = коды ещё не сгенерированы. Тот же формат/хелперы что у 2FA recovery
-- codes (security/twoFactor.ts generateRecoveryCodes/verifyRecoveryCode),
-- но отдельный набор. App-layer (auth routes) генерит/верифицирует/consume'ит.

ALTER TABLE "User" ADD COLUMN "passwordRecoveryCodes" TEXT;
