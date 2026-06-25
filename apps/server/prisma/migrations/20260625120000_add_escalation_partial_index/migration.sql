-- v1.6.98 — partial index под фоновой escalation-scan (escalation.ts).
--
-- Скан раз в час обходит ActionItem'ы где status ∈ (OPEN,IN_PROGRESS,REVIEW),
-- dueAt < now()-48h и (escalatedAt IS NULL OR < now()-7d), ORDER BY dueAt ASC
-- LIMIT 50. Запрос ГЛОБАЛЬНЫЙ (без serverId/channelId), поэтому существующие
-- индексы ActionItem (все ведут с channelId/serverId) его не покрывают —
-- раньше это был seq-scan всей таблицы каждый час.
--
-- Partial composite index: только открытые задачи с дедлайном (множество
-- кандидатов эскалации — крошечная доля таблицы; закрытые DONE и задачи без
-- dueAt исключены из индекса). Ведущая колонка dueAt → один forward
-- index-scan покрывает и фильтр `dueAt < X`, и `ORDER BY dueAt ASC LIMIT 50`
-- без отдельной сортировки; останавливается рано. Условие по escalatedAt
-- применяется фильтром на уже узком наборе кандидатов.
--
-- Partial-индекс НЕ выражается в schema.prisma (Prisma не поддерживает
-- WHERE-предикаты), поэтому raw SQL. `prisma migrate deploy` применяет его
-- как есть; `prisma generate` индексы не читает (типы клиента не меняются);
-- drift-проверки (`prisma migrate dev`) в этом проекте не используются
-- (прод = migrate deploy, локальной БД нет). Предикат immutable
-- (enum-литералы + IS NOT NULL) — валиден для partial index.

CREATE INDEX IF NOT EXISTS "ActionItem_escalation_scan_idx"
  ON "ActionItem" ("dueAt")
  WHERE "status" IN ('OPEN', 'IN_PROGRESS', 'REVIEW') AND "dueAt" IS NOT NULL;
