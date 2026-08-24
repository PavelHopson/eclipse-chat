CREATE TABLE "OfficeEventOutbox" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "producerId" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "discardedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficeEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfficeEventOutbox_deliveredAt_discardedAt_availableAt_createdAt_idx"
  ON "OfficeEventOutbox"("deliveredAt", "discardedAt", "availableAt", "createdAt");
CREATE INDEX "OfficeEventOutbox_serverId_deliveredAt_discardedAt_createdAt_idx"
  ON "OfficeEventOutbox"("serverId", "deliveredAt", "discardedAt", "createdAt");

ALTER TABLE "OfficeEventOutbox"
  ADD CONSTRAINT "OfficeEventOutbox_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;