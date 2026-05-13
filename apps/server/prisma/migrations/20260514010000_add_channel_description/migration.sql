-- Channel.description: nullable text up to 1024 chars (validated в zod-routes).
-- Show'ится в chat header под #channel-name + в ChannelSettingsModal.

ALTER TABLE "Channel" ADD COLUMN "description" TEXT;
