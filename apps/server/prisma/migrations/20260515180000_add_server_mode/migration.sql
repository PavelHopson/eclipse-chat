-- Server.mode — ENGINEERING (default) | CLIENT. CLIENT-режим прячет
-- operator-инструменты (Status Board / Execution tab / slash-command hint
-- strip / BOT badges) — для портала клиентов агентств и дев-студий.
-- Существующие серверы получают ENGINEERING по умолчанию, backward compat.

CREATE TYPE "ServerMode" AS ENUM ('ENGINEERING', 'CLIENT');

ALTER TABLE "Server"
  ADD COLUMN "mode" "ServerMode" NOT NULL DEFAULT 'ENGINEERING';
