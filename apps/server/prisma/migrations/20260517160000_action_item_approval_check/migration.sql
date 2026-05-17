-- ActionItem approval lifecycle CHECK constraint (v0.63.0).
--
-- Закрывает silent-corruption surface: схема ранее позволяла любое
-- сочетание (requiresApproval, approvalStatus), хотя в коде такие комбо
-- никогда не пишутся. Без CHECK ничто не мешает прямому psql'у или
-- бот-mutation сломать invariant.
--
-- Правило (single source of truth):
--   requiresApproval = false  ⟺  approvalStatus = 'NONE'
--   requiresApproval = true   ⟺  approvalStatus ∈ {PENDING, APPROVED, REJECTED}
--
-- Existing rows из 20260517020000_add_approvals migration все стартовали с
-- (false, NONE) — все compliant. CHECK добавляется без backfill.

ALTER TABLE "ActionItem"
  ADD CONSTRAINT "ActionItem_approval_lifecycle_chk"
  CHECK (
    ("requiresApproval" = false AND "approvalStatus" = 'NONE')
    OR
    ("requiresApproval" = true AND "approvalStatus" != 'NONE')
  );
