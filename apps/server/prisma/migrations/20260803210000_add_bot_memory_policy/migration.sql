CREATE TYPE "BotMemoryPolicy" AS ENUM ('OFF', 'ROOM', 'WORKSPACE');

ALTER TABLE "Bot"
ADD COLUMN "memoryPolicy" "BotMemoryPolicy" NOT NULL DEFAULT 'OFF';
