-- Operational Tables phase 1 (v0.59.0) — spike: schema + CRUD только.
--
-- Цель: первая итерация HUGE-feature §4 NEXT-GEN — встроенные таблицы
-- внутри пространства (task tables, CRM, leads, etc). Phase 1 — узкий
-- срез: 4 типа полей (TEXT/NUMBER/STATUS/DATE), inline editable cells,
-- никаких relations / formulas / AI-fill. Это foundation; phase 2 добавит
-- realtime, relations к ActionItem, advanced types; phase 3 — AI fill +
-- table types templates.

-- 1. TableFieldType enum.
CREATE TYPE "TableFieldType" AS ENUM ('TEXT', 'NUMBER', 'STATUS', 'DATE');

-- 2. Table — корневая сущность. serverId обязателен, channelId optional
--    (null = server-wide table, доступна со Context Tree).
CREATE TABLE "Table" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "channelId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Table_serverId_updatedAt_idx" ON "Table"("serverId", "updatedAt");
CREATE INDEX "Table_channelId_idx" ON "Table"("channelId");

ALTER TABLE "Table"
  ADD CONSTRAINT "Table_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Table"
  ADD CONSTRAINT "Table_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Table"
  ADD CONSTRAINT "Table_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. TableField — определение колонки.
CREATE TABLE "TableField" (
  "id" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TableFieldType" NOT NULL,
  -- Для STATUS — JSON-string array допустимых значений ["TODO", "DONE"].
  -- Null для других типов.
  "options" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TableField_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TableField_tableId_position_idx" ON "TableField"("tableId", "position");

ALTER TABLE "TableField"
  ADD CONSTRAINT "TableField_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "Table"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. TableRow — строка таблицы.
CREATE TABLE "TableRow" (
  "id" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TableRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TableRow_tableId_position_idx" ON "TableRow"("tableId", "position");

ALTER TABLE "TableRow"
  ADD CONSTRAINT "TableRow_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "Table"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. TableCell — значение ячейки. PK на (rowId, fieldId) — одна ячейка
--    на пересечение строка-колонка.
CREATE TABLE "TableCell" (
  "rowId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  -- Stored as plain string. Frontend coerces per field.type:
  --   TEXT — as is, NUMBER — Number(value), STATUS — string из options,
  --   DATE — ISO 8601.
  "value" TEXT NOT NULL,
  CONSTRAINT "TableCell_pkey" PRIMARY KEY ("rowId", "fieldId")
);

CREATE INDEX "TableCell_fieldId_idx" ON "TableCell"("fieldId");

ALTER TABLE "TableCell"
  ADD CONSTRAINT "TableCell_rowId_fkey"
  FOREIGN KEY ("rowId") REFERENCES "TableRow"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableCell"
  ADD CONSTRAINT "TableCell_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "TableField"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
