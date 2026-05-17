-- Operational Tables phase 2 (v0.62.0) — расширение TableFieldType.
--
-- USER     = pointer на member workspace (TableCell.value хранит userId).
-- CHECKBOX = boolean ("true"/"false" в value, frontend coerces).
--
-- Existing rows не задеваются — это additive enum extension. PostgreSQL
-- ALTER TYPE ADD VALUE — каждое значение в отдельной транзакции (Prisma
-- migrate автоматически разводит их).

ALTER TYPE "TableFieldType" ADD VALUE 'USER';
ALTER TYPE "TableFieldType" ADD VALUE 'CHECKBOX';
