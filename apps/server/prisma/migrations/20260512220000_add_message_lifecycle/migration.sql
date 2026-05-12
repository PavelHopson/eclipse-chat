-- AlterTable: добавляем lifecycle поля в Message
ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "pinnedAt" TIMESTAMP(3);

-- CreateIndex: ускоряет GET /api/channels/:id/pinned + фильтрацию pinned в общих лентах
CREATE INDEX "Message_channelId_pinnedAt_idx" ON "Message"("channelId", "pinnedAt");
