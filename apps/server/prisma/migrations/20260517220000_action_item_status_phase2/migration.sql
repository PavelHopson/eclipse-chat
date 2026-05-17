-- v0.71: ActionItemStatus enum extension — phase 1 execution kanban.
--
-- Раньше: OPEN / DONE (2 столбца). Теперь добавляем промежуточные
-- IN_PROGRESS / REVIEW. Получается kanban:
--   OPEN          — создана, не начата
--   IN_PROGRESS   — assignee в работе
--   REVIEW        — готова, ждёт проверки
--   DONE          — закрыта
--
-- Existing rows: все OPEN/DONE остаются — defaults не задеты.
-- PostgreSQL ALTER TYPE ADD VALUE — каждое value в отдельной транзакции
-- (Prisma migrate разводит их).
--
-- UI: StatusBoard rewrite на 4-column drag-and-drop. Existing quick toggle
-- (OPEN ↔ DONE) в MessageList / IntelligencePanel / ActionQueueBar
-- сохраняется — это shortcut "mark done"; полный transition через drawer
-- select или drag-and-drop в kanban.

ALTER TYPE "ActionItemStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "ActionItemStatus" ADD VALUE 'REVIEW';
