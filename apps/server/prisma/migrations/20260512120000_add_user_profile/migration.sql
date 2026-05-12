-- AlterTable: добавляем nullable поля avatar + bio в User
-- Совместимо с существующими данными (NULL по умолчанию).
ALTER TABLE "User" ADD COLUMN "avatar" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
