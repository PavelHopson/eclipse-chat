-- v1.2.7 Platform Admin (trek P2) — расширение super-admin панели:
--   1. Server suspend (заморозка) — поля suspendedAt / Reason / By + FK.
--   2. User soft-delete — поля deletedAt / Reason / By + FK.
--   3. AuditEventType: + PLATFORM_USER_DELETED / SERVER_SUSPENDED / UNSUSPENDED.
--
-- Suspend-gating (блокировка write-операций в suspended server'е) —
-- в коде через assertServerActive (см. apps/server/src/lib/serverGating.ts).
-- Login-gate отклоняет deletedAt !== null так же как bannedAt (см. auth.ts).
--
-- Никаких data-step seed'ов — всё пустое (NULL) по умолчанию.

-- 1. Extend AuditEventType enum (idempotent)
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_USER_DELETED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_SERVER_SUSPENDED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_SERVER_UNSUSPENDED';

-- 2. User: soft-delete колонки + FK
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedReason" TEXT;
ALTER TABLE "User" ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_deletedByUserId_fkey"
  FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "User_deletedByUserId_idx" ON "User"("deletedByUserId");

-- 3. Server: suspend колонки + FK
ALTER TABLE "Server" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Server" ADD COLUMN "suspendedReason" TEXT;
ALTER TABLE "Server" ADD COLUMN "suspendedByUserId" TEXT;
ALTER TABLE "Server" ADD CONSTRAINT "Server_suspendedByUserId_fkey"
  FOREIGN KEY ("suspendedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Server_suspendedAt_idx" ON "Server"("suspendedAt");
CREATE INDEX "Server_suspendedByUserId_idx" ON "Server"("suspendedByUserId");
