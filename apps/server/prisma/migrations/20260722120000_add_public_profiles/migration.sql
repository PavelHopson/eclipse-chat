-- Public profile media is explicitly curated by the account owner. It is
-- intentionally separate from message attachments so private room content
-- never becomes profile media by accident.
ALTER TABLE "User" ADD COLUMN "profileBanner" TEXT;

CREATE TABLE "UserProfileImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfileImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserProfileImage_userId_position_idx"
    ON "UserProfileImage"("userId", "position");

ALTER TABLE "UserProfileImage"
    ADD CONSTRAINT "UserProfileImage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
