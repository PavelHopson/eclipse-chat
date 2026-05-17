-- Approvals (v0.55.0) — formal request → approve/reject flow on ActionItem.
--
-- Подход: extend существующую ActionItem модель additive-полями вместо
-- создания отдельной Approval-таблицы. v1 ограничивается одним approver
-- per item; multi-approver / approval chains — будущее расширение
-- (когда client-portal flow потребует).
--
-- Lifecycle:
--   1) ActionItem создаётся обычно (approvalStatus = NONE).
--   2) Кто-то делает "request approval" — approvalStatus → PENDING,
--      approverUserId заполнен, requiresApproval = true.
--   3) Approver делает approve или reject — approvalStatus = APPROVED /
--      REJECTED, approvedAt заполнен, optional approvalNote.
--
-- Item остаётся в статусе OPEN/DONE независимо от approval state — это
-- два разных axis: status = "сделано или нет", approval = "одобрено или нет".

-- 1. ApprovalStatus enum
CREATE TYPE "ApprovalStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- 2. ActionItem fields — все nullable / с defaults для backward compat.
ALTER TABLE "ActionItem"
  ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approverUserId" TEXT,
  ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "approvalNote" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Approver — FK на User. SetNull если user удалён (история сохраняется).
ALTER TABLE "ActionItem"
  ADD CONSTRAINT "ActionItem_approverUserId_fkey"
  FOREIGN KEY ("approverUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ActionItem_approverUserId_approvalStatus_idx"
  ON "ActionItem"("approverUserId", "approvalStatus");

-- 3. Extend ActionItemActivityType с тремя новыми значениями.
-- PostgreSQL syntax для adding enum values — каждый ALTER TYPE в отдельной
-- транзакции (т.е. вне migrate transaction).
ALTER TYPE "ActionItemActivityType" ADD VALUE 'APPROVAL_REQUESTED';
ALTER TYPE "ActionItemActivityType" ADD VALUE 'APPROVAL_APPROVED';
ALTER TYPE "ActionItemActivityType" ADD VALUE 'APPROVAL_REJECTED';
