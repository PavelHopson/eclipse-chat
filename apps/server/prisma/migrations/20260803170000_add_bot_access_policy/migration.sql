ALTER TABLE "Bot" ADD COLUMN "allowedChannelIds" TEXT;

ALTER TYPE "AuditEventType" ADD VALUE 'BOT_ACCESS_POLICY_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE 'BOT_TOOL_CALL';

-- Existing agent-mode bots keep the tools they had before granular ACL.
UPDATE "Bot"
SET "capabilities" = (
  COALESCE("capabilities", '[]')::jsonb
  || '["create_task", "update_table_row"]'::jsonb
)::text
WHERE COALESCE("capabilities", '[]')::jsonb ? 'agent';
