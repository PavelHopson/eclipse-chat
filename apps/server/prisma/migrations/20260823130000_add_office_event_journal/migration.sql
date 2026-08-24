CREATE TABLE "OfficeEventCursor" (
  "serverId" TEXT NOT NULL,
  "lastSequence" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficeEventCursor_pkey" PRIMARY KEY ("serverId")
);

CREATE TABLE "OfficeEvent" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "sequence" BIGINT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subjectKind" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" TEXT NOT NULL,
  "producerId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficeIngestNonce" (
  "id" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "producerId" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "firstSequence" BIGINT,
  "lastSequence" BIGINT,
  "acceptedCount" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficeIngestNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfficeEvent_serverId_sequence_key" ON "OfficeEvent"("serverId", "sequence");
CREATE INDEX "OfficeEvent_serverId_occurredAt_idx" ON "OfficeEvent"("serverId", "occurredAt");
CREATE UNIQUE INDEX "OfficeIngestNonce_keyId_nonce_key" ON "OfficeIngestNonce"("keyId", "nonce");
CREATE INDEX "OfficeIngestNonce_expiresAt_idx" ON "OfficeIngestNonce"("expiresAt");
CREATE INDEX "OfficeIngestNonce_serverId_createdAt_idx" ON "OfficeIngestNonce"("serverId", "createdAt");

ALTER TABLE "OfficeEventCursor" ADD CONSTRAINT "OfficeEventCursor_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficeEvent" ADD CONSTRAINT "OfficeEvent_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficeIngestNonce" ADD CONSTRAINT "OfficeIngestNonce_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
