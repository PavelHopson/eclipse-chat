-- Bot v3: auto-respond in server TEXT channels + per-bot custom system prompt.
ALTER TABLE "Bot" ADD COLUMN "autoRespond" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bot" ADD COLUMN "systemPromptOverride" TEXT;
