-- v1.0 #11 AI controls: добавляем audit event типы для bot prompt
-- управления и test-run observability.
-- Postgres требует ALTER TYPE ... ADD VALUE снаружи transaction'а — каждый
-- ALTER в отдельном statement. IF NOT EXISTS делает migration idempotent.

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BOT_PROMPT_UPDATE';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BOT_PROMPT_RESET';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BOT_TEST_INVOKE';
