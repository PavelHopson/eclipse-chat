-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ONLINE', 'IDLE', 'DND', 'INVISIBLE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ONLINE';
