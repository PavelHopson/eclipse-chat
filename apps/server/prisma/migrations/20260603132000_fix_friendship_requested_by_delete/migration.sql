-- requestedByUserId is required and always points to one side of the friendship.
-- SET NULL on a NOT NULL column is an impossible referential action; cascade
-- matches the userA/userB ownership lifecycle and removes the Prisma warning.
ALTER TABLE "Friendship" DROP CONSTRAINT IF EXISTS "Friendship_requestedByUserId_fkey";

ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
