-- v0.90 #10 phase 4: TableRow → ActionItem binding.
-- Additive nullable column. SetNull on task delete — row preserves history.

ALTER TABLE "TableRow" ADD COLUMN "actionItemId" TEXT;

CREATE INDEX "TableRow_actionItemId_idx" ON "TableRow"("actionItemId");

ALTER TABLE "TableRow" ADD CONSTRAINT "TableRow_actionItemId_fkey"
    FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
