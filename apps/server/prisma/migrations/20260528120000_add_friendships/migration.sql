-- v1.5.42 Discord-parity A1 — Friendship model.
-- Один row на пару user'ов, нормализованных userAId < userBId.
-- Жизненный цикл: PENDING → (accept) ACCEPTED, либо BLOCKED. Cancel/decline/
-- unfriend/unblock = DELETE row. requestedByUserId/blockedByUserId — кто кого.
-- Cascade на user'е (oбе стороны), SetNull на requestedBy/blockedBy чтобы
-- soft-delete user'а не падал FK constraint.

CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "blockedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- Unique pair: ровно один Friendship row на пару user'ов (любого статуса).
-- Защищает от race-condition'ов create при одновременных request'ах с двух сторон.
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");

-- Запросы «мои PENDING incoming / мои ACCEPTED friends / мои BLOCKED» —
-- compound index по (user, status) даёт быстрый scan без отдельного status
-- filter после initial seek.
CREATE INDEX "Friendship_userAId_status_idx" ON "Friendship"("userAId", "status");
CREATE INDEX "Friendship_userBId_status_idx" ON "Friendship"("userBId", "status");

-- Cascade-delete при удалении user'а — friendship пара исчезает с обеих сторон.
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey"
    FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey"
    FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull на requestedBy/blockedBy: row выживет soft-delete'а инициатора /
-- блокирующего user'а. Сама пара friendship удалится через cascade userA/userB
-- раньше — это safety net для audit-data integrity.
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_blockedByUserId_fkey"
    FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
