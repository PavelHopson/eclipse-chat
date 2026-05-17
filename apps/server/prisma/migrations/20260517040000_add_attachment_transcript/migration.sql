-- Voice transcription (v0.58.0) — добавляет transcript fields на Attachment.
-- Background fire-and-forget после upload audio-attachment'а: backend
-- транскрибирует через OpenAI Whisper API (если OPENAI_API_KEY сетап),
-- обновляет row + emit event.
--
-- Если ключа нет — transcript остаётся null, status стоит NONE. UI
-- показывает hint "транскрипция не настроена" (либо просто ничего).
--
-- v2 — local Whisper.cpp / Ollama whisper / fallback provider chain.

-- 1. TranscriptStatus enum.
CREATE TYPE "TranscriptStatus" AS ENUM ('NONE', 'PENDING', 'READY', 'FAILED');

-- 2. Attachment fields — все nullable/defaults для backward compat.
ALTER TABLE "Attachment"
  ADD COLUMN "transcript" TEXT,
  ADD COLUMN "transcriptStatus" "TranscriptStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "transcriptError" TEXT;
