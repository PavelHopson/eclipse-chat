-- v1.6.99 — одноразовые / истекающие server-invites (privacy slice B).
--
-- Параллельно legacy Server.inviteCode (вечный, многоразовый). Отдельные коды
-- с лимитом использований (maxUses) и/или сроком (expiresAt), отзываемые
-- (revokedAt). Принимаются тем же POST /api/servers/join/:code.
--
-- FK на Server — cascade (инвайты живут со своим сервером). createdByUserId —
-- scalar в schema.prisma БЕЗ Prisma-relation (чтобы не расширять большую модель
-- User); FK + ON DELETE SET NULL задаётся здесь вручную, как partial-индексы
-- проекта. prisma migrate deploy применяет как есть; prisma generate FK не
-- читает (типы клиента не зависят).

-- Новые типы аудит-событий для инвайтов (PG 12+: ADD VALUE в транзакции ОК,
-- значение в этой же миграции не используется).
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SERVER_INVITE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SERVER_INVITE_REVOKED';

CREATE TABLE "ServerInvite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServerInvite_code_key" ON "ServerInvite"("code");
CREATE INDEX "ServerInvite_serverId_idx" ON "ServerInvite"("serverId");
CREATE INDEX "ServerInvite_expiresAt_idx" ON "ServerInvite"("expiresAt");

ALTER TABLE "ServerInvite" ADD CONSTRAINT "ServerInvite_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServerInvite" ADD CONSTRAINT "ServerInvite_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
