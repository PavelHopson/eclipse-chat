-- v1.2.20 — Custom emoji per-server (Pavel'я handoff: "Custom emoji давний open").
-- Additive. Cascade на server delete; SetNull на uploader delete.

CREATE TABLE "Emoji" (
    "id"         TEXT NOT NULL,
    "serverId"   TEXT NOT NULL,
    "shortcode"  TEXT NOT NULL,
    "url"        TEXT NOT NULL,
    "uploaderId" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Emoji_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Emoji_serverId_shortcode_key" ON "Emoji"("serverId", "shortcode");
CREATE INDEX "Emoji_serverId_idx" ON "Emoji"("serverId");

ALTER TABLE "Emoji" ADD CONSTRAINT "Emoji_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Emoji" ADD CONSTRAINT "Emoji_uploaderId_fkey"
    FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
