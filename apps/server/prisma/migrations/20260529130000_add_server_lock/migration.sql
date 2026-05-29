-- v1.5.54 Discord-parity D3 — Server isolation (emergency join lock).
--
-- OWNER/ADMIN может временно «закрыть» сервер для новых joins во время
-- raid response. Existing members + writes продолжают работать —
-- параллельно с suspendedAt (platform-admin disable, read-only).
--
-- Три nullable поля на Server:
--   lockedAt        — timestamp lock event; NULL = open для joins
--   lockedReason    — audit message (optional)
--   lockedByUserId  — кто наложил lock; SetNull при удалении user'а
--
-- Gate: POST /api/servers/join/:code проверяет lockedAt; если NOT NULL →
-- 403 «Сервер временно закрыт для новых пользователей».

ALTER TABLE "Server"
    ADD COLUMN "lockedAt" TIMESTAMP(3),
    ADD COLUMN "lockedReason" TEXT,
    ADD COLUMN "lockedByUserId" TEXT;

ALTER TABLE "Server" ADD CONSTRAINT "Server_lockedByUserId_fkey"
    FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
