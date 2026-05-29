-- v1.5.52 Discord-parity B2 — Active sessions metadata.
-- RefreshToken получает три nullable поля для UX «5 устройств» в Settings:
--   userAgent  — UA header (truncated 512 chars в app-layer)
--   ipAddress  — IPv4/v6 origin string
--   lastSeenAt — bumped на каждый refresh hit, для «Активна сейчас» indicator
--
-- Legacy rows до этой migration получают NULL во всех трёх — UI отрисовывает
-- «Неизвестное устройство» fallback.
--
-- Index (userId, lastSeenAt) — для GET /api/auth/sessions sorted-by-activity
-- query без full-table scan.

ALTER TABLE "RefreshToken"
    ADD COLUMN "userAgent" TEXT,
    ADD COLUMN "ipAddress" TEXT,
    ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE INDEX "RefreshToken_userId_lastSeenAt_idx" ON "RefreshToken"("userId", "lastSeenAt");
