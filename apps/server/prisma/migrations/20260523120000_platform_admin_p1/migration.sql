-- v1.2.6 Platform Admin (trek P1) — глобальный super-admin для владельца платформы.
--
-- Добавляет:
--   1. User flags: isPlatformOwner / bannedAt / bannedReason / bannedByUserId
--      + self-relation FK UserBannedBy.
--   2. AuditEventType: 3 новых события (PLATFORM_USER_BANNED/UNBANNED/PASSWORD_RESET).
--   3. Data step: seed isPlatformOwner=true для Pavel'я (man773608@gmail.com).
--      Idempotent — UPDATE с WHERE; 0 rows affected если email не найден.
--
-- Login-gate (banned → reject) + WS-gate реализованы в коде
-- (auth.ts, socketAuth.ts). Reset-password: backend генерит crypto-random
-- temp pw, bcrypt-hash, возвращает raw один раз; UI показывает в модалке.

-- 1. Extend AuditEventType enum (idempotent)
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_USER_BANNED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_USER_UNBANNED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_USER_PASSWORD_RESET';

-- 2. User: новые колонки
ALTER TABLE "User" ADD COLUMN "isPlatformOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "bannedReason" TEXT;
ALTER TABLE "User" ADD COLUMN "bannedByUserId" TEXT;

-- 3. Self-relation FK (bannedBy → User.id, SetNull при удалении админа)
ALTER TABLE "User" ADD CONSTRAINT "User_bannedByUserId_fkey"
  FOREIGN KEY ("bannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Индексы для фильтров "banned users" и "users I banned"
CREATE INDEX "User_bannedAt_idx" ON "User"("bannedAt");
CREATE INDEX "User_bannedByUserId_idx" ON "User"("bannedByUserId");

-- 5. Data step: seed Pavel как platform-owner. Idempotent.
-- Если email не существует в БД (например, на свежем проде) — 0 rows
-- affected, миграция не ломается. В этом случае запустить вручную после
-- первой регистрации (или на нужного user'а):
--   UPDATE "User" SET "isPlatformOwner" = true WHERE email = '<your-email>';
UPDATE "User" SET "isPlatformOwner" = true WHERE email = 'man773608@gmail.com';
