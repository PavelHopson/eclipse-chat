-- v0.66: Attachment.waveformPeaks — pre-computed audio waveform peaks
-- для Telegram-style визуализации.
--
-- Frontend (Web Audio API) декодирует audio file при upload, считает
-- N=64 normalized peaks (0-100), отправляет в attachment payload.
-- Backend просто хранит JSON — никаких CLI deps (audiowaveform, ffmpeg)
-- на проде не требуется. Pavel anti-pattern «не плодить npm/apt deps»
-- учтён.
--
-- Json в Postgres = jsonb на самом деле (Prisma maps Json → jsonb).
-- Размер: 64 чисел * ~3 bytes = ~200 bytes на attachment. Negligible.
-- Зачем jsonb а не Int[] PG array: Prisma не имеет нативного Int[]
-- support, Json — best portable choice.
--
-- Existing rows: NULL для всех текущих audio attachments. Frontend
-- fallback'нется на linear progress bar если peaks нет.

ALTER TABLE "Attachment" ADD COLUMN "waveformPeaks" JSONB;
