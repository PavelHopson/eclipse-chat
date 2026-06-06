CREATE TABLE "TrainingSection" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingVideo" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "filename" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingSection_serverId_position_idx" ON "TrainingSection"("serverId", "position");
CREATE INDEX "TrainingVideo_serverId_createdAt_idx" ON "TrainingVideo"("serverId", "createdAt");
CREATE INDEX "TrainingVideo_sectionId_position_idx" ON "TrainingVideo"("sectionId", "position");

ALTER TABLE "TrainingSection"
  ADD CONSTRAINT "TrainingSection_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingVideo"
  ADD CONSTRAINT "TrainingVideo_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingVideo"
  ADD CONSTRAINT "TrainingVideo_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "TrainingSection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
