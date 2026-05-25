-- v1.5.24 — Message edit history.
-- Each PATCH /api/messages/:id (или DM equivalent) сохраняет previous
-- content + previous editedAt в MessageEdit перед перезаписью Message.content.
-- Frontend lazy-fetches history через GET /api/messages/:id/edits.
-- Cascade-delete: при удалении Message все snapshots исчезают.

CREATE TABLE "MessageEdit" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "previousContent" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEdit_pkey" PRIMARY KEY ("id")
);

-- Index для быстрого fetch'а history по messageId, сортировка by editedAt desc.
CREATE INDEX "MessageEdit_messageId_editedAt_idx" ON "MessageEdit"("messageId", "editedAt");

ALTER TABLE "MessageEdit" ADD CONSTRAINT "MessageEdit_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
