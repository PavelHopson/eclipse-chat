-- Execution entity drawer (v0.54.0) — превращает ActionItem из inline-chip
-- в first-class объект с priority / description / comments / activity feed.
--
-- Additive migration: новые fields nullable / с defaults; новые таблицы
-- пустые. Existing routes продолжают работать без модификации.

-- 1. ActionItemPriority enum
CREATE TYPE "ActionItemPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- 2. ActionItem.priority + description
ALTER TABLE "ActionItem"
  ADD COLUMN "priority" "ActionItemPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "description" TEXT;

-- 3. ActionItemActivityType enum — для audit log записей.
CREATE TYPE "ActionItemActivityType" AS ENUM (
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNEE_CHANGED',
  'DUE_CHANGED',
  'PRIORITY_CHANGED',
  'TITLE_CHANGED',
  'DESCRIPTION_CHANGED',
  'COMMENT_ADDED',
  'COMMENT_DELETED'
);

-- 4. ActionItemComment — comments thread на каждом ActionItem.
CREATE TABLE "ActionItemComment" (
  "id" TEXT NOT NULL,
  "actionItemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3),
  CONSTRAINT "ActionItemComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionItemComment_actionItemId_createdAt_idx"
  ON "ActionItemComment"("actionItemId", "createdAt");
CREATE INDEX "ActionItemComment_userId_idx"
  ON "ActionItemComment"("userId");

ALTER TABLE "ActionItemComment"
  ADD CONSTRAINT "ActionItemComment_actionItemId_fkey"
  FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItemComment"
  ADD CONSTRAINT "ActionItemComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. ActionItemActivity — audit log of property changes + comments lifecycle.
-- userId nullable: для system events (например AI auto-created из incident).
CREATE TABLE "ActionItemActivity" (
  "id" TEXT NOT NULL,
  "actionItemId" TEXT NOT NULL,
  "userId" TEXT,
  "type" "ActionItemActivityType" NOT NULL,
  "payload" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionItemActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionItemActivity_actionItemId_createdAt_idx"
  ON "ActionItemActivity"("actionItemId", "createdAt");

ALTER TABLE "ActionItemActivity"
  ADD CONSTRAINT "ActionItemActivity_actionItemId_fkey"
  FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItemActivity"
  ADD CONSTRAINT "ActionItemActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
