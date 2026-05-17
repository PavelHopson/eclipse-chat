-- v0.73 #20 phase 2: ActionItem dependencies graph.
--
-- Self-relation many-to-many: одна задача может быть blocked by несколькими
-- задачами (через `actionItemId`) и одновременно блокировать несколько
-- других (через `dependsOnActionItemId`).
--
-- Constraints:
--   * composite PK (actionItemId, dependsOnActionItemId) — нет дублей edges.
--   * CHECK constraint запрещает self-loop (A→A) на уровне БД.
--   * onDelete CASCADE с обеих сторон — удаление ActionItem чистит edges.
--   * Циклы (A→B→A) ловит backend BFS-проверка перед insert (не SQL).
--
-- Activity log enum: 2 новых значения DEPENDENCY_ADDED / DEPENDENCY_REMOVED.
-- ALTER TYPE требует separate transactions — Prisma migrate разведёт.

ALTER TYPE "ActionItemActivityType" ADD VALUE 'DEPENDENCY_ADDED';
ALTER TYPE "ActionItemActivityType" ADD VALUE 'DEPENDENCY_REMOVED';

CREATE TABLE "ActionItemDependency" (
    "actionItemId" TEXT NOT NULL,
    "dependsOnActionItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionItemDependency_pkey" PRIMARY KEY ("actionItemId", "dependsOnActionItemId"),
    CONSTRAINT "ActionItemDependency_no_self_loop"
        CHECK ("actionItemId" <> "dependsOnActionItemId")
);

CREATE INDEX "ActionItemDependency_dependsOnActionItemId_idx"
    ON "ActionItemDependency"("dependsOnActionItemId");

ALTER TABLE "ActionItemDependency"
    ADD CONSTRAINT "ActionItemDependency_actionItemId_fkey"
    FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItemDependency"
    ADD CONSTRAINT "ActionItemDependency_dependsOnActionItemId_fkey"
    FOREIGN KEY ("dependsOnActionItemId") REFERENCES "ActionItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
