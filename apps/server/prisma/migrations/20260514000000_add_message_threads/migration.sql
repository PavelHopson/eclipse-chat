-- Message threads — добавляем self-relation parentMessageId.
-- Nullable: root-сообщения имеют parentMessageId=NULL, replies — id root'а.
-- onDelete SET NULL: если root удалён, replies остаются как orphan (не каскадим
-- чтобы не терять историю обсуждения; UI рендерит «root deleted» placeholder).

ALTER TABLE "Message" ADD COLUMN "parentMessageId" TEXT;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_parentMessageId_fkey"
  FOREIGN KEY ("parentMessageId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Message_parentMessageId_idx" ON "Message"("parentMessageId");
