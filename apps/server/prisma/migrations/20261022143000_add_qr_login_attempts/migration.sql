ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTH_QR_STARTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTH_QR_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTH_QR_DENIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTH_QR_EXCHANGED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTH_QR_CANCELLED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTH_QR_EXPIRED';
CREATE TYPE "QrLoginStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CONSUMED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "QrLoginAttempt" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "verifierHash" TEXT NOT NULL,
    "status" "QrLoginStatus" NOT NULL DEFAULT 'PENDING',
    "targetUserId" TEXT,
    "approvedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "deniedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "targetUserAgent" TEXT,
    "targetIpAddress" TEXT,
    "claimUserAgent" TEXT,
    "claimIpAddress" TEXT,
    "approverUserAgent" TEXT,
    "approverIpAddress" TEXT,

    CONSTRAINT "QrLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QrLoginAttempt_codeHash_key" ON "QrLoginAttempt"("codeHash");
CREATE UNIQUE INDEX "QrLoginAttempt_verifierHash_key" ON "QrLoginAttempt"("verifierHash");
CREATE INDEX "QrLoginAttempt_status_expiresAt_idx" ON "QrLoginAttempt"("status", "expiresAt");
CREATE INDEX "QrLoginAttempt_targetUserId_status_idx" ON "QrLoginAttempt"("targetUserId", "status");
CREATE INDEX "QrLoginAttempt_approvedByUserId_status_idx" ON "QrLoginAttempt"("approvedByUserId", "status");

ALTER TABLE "QrLoginAttempt" ADD CONSTRAINT "QrLoginAttempt_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QrLoginAttempt" ADD CONSTRAINT "QrLoginAttempt_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

