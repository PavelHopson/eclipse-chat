-- ActionItemComment.userId Cascade -> SetNull (v0.63.0 cascade policy B).
--
-- Аналогично Message.userId: при удалении автора комментарий не исчезает,
-- остаётся как анонимный с пометкой «Удалённый пользователь». Audit trail
-- task discussion preserves.
--
-- Note: ActionItem.createdByUserId всё ещё Cascade — это намеренно, т.к.
-- ActionItem без creator теряет business meaning (нет sourceMessage author).
-- ActionItemActivity.userId уже SetNull + nullable (см. оригинальную
-- 20260517000000_add_action_item_drawer migration).

ALTER TABLE "ActionItemComment" DROP CONSTRAINT "ActionItemComment_userId_fkey";

ALTER TABLE "ActionItemComment" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "ActionItemComment" ADD CONSTRAINT "ActionItemComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
