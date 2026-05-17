-- v0.75 #10 phase 2.5b: Operational Tables RELATION + FILE field types.
--
-- RELATION: cell.value = JSON array of rowIds; field.linkedTableId →
-- target Table (same server, validated в route). Frontend renders chip
-- list с display-value (первая колонка target table) + row picker.
--
-- FILE: cell.value = JSON array of `{url, filename, mimeType, size}`.
-- Файлы загружаются через POST /api/tables/:id/upload, сохраняются
-- standalone (без Attachment row). 50 MB cap per file, 5 файлов на cell.
--
-- Schema changes:
--   1. Enum extensions для RELATION + FILE.
--   2. TableField.linkedTableId nullable + FK SetNull (для RELATION).
-- Additive, zero-downtime. Existing fields/rows не затронуты.

ALTER TYPE "TableFieldType" ADD VALUE 'RELATION';
ALTER TYPE "TableFieldType" ADD VALUE 'FILE';

ALTER TABLE "TableField" ADD COLUMN "linkedTableId" TEXT;
CREATE INDEX "TableField_linkedTableId_idx" ON "TableField"("linkedTableId");
ALTER TABLE "TableField"
  ADD CONSTRAINT "TableField_linkedTableId_fkey"
  FOREIGN KEY ("linkedTableId") REFERENCES "Table"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
