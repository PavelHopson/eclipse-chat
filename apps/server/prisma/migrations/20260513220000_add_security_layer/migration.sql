-- v0.11.1 Security hardening:
-- 2FA TOTP support + audit log + brute-force lockout tracker.

-- User: 2FA fields + lockout tracker
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryCodes" TEXT;
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockoutUntil" TIMESTAMP(3);

-- AuditEventType enum
CREATE TYPE "AuditEventType" AS ENUM (
  'AUTH_LOGIN',
  'AUTH_LOGIN_FAILED',
  'AUTH_LOGIN_LOCKED',
  'AUTH_LOGOUT',
  'AUTH_REGISTER',
  'AUTH_PASSWORD_CHANGE',
  'TWOFA_ENABLED',
  'TWOFA_DISABLED',
  'TWOFA_VERIFIED',
  'TWOFA_RECOVERY_USED',
  'SERVER_CREATED',
  'SERVER_DELETED',
  'SERVER_BANNER_CHANGED',
  'SERVER_IDENTITY_CHANGED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_KICKED',
  'MESSAGE_DELETED_BY_MOD',
  'CHANNEL_CREATED',
  'CHANNEL_DELETED'
);

-- AuditLog table
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "type" "AuditEventType" NOT NULL,
  "userId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- FK на User с SetNull (если user удалён — log остаётся как «unknown user»)
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes для query: «все logs user'а», «все события типа X»
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_type_createdAt_idx" ON "AuditLog"("type", "createdAt");
