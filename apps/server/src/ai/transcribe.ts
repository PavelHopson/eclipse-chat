/**
 * Voice transcription (v0.58).
 *
 * v1: только OpenAI Whisper API (через native fetch — без `openai` SDK dep,
 * Pavel anti-pattern: НЕ добавлять npm пакеты бездумно). Если ключа нет —
 * возвращаем null, caller помечает attachment как NONE и UI показывает hint.
 *
 * v2 — local Whisper.cpp через subprocess, Ollama если добавит audio
 * model, fallback chain аналогично chat provider'у.
 *
 * Limits:
 *   - OpenAI Whisper API максимум 25 MB на запрос. Большие файлы — skip.
 *   - Поддерживаемые форматы: mp3 / mp4 / mpeg / mpga / m4a / wav / webm.
 *
 * Background-friendly: fire-and-forget из processAttachment. Не throw'ает
 * наружу; caller получает либо string transcript либо null + причину в
 * `reason` поле для FAILED status'а.
 */

const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const WHISPER_TIMEOUT_MS = 90_000;
const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";

const SUPPORTED_AUDIO_MIME = new Set<string>([
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
]);

export type TranscribeOutcome =
  | { status: "READY"; text: string }
  | { status: "FAILED"; reason: string }
  | { status: "NONE"; reason: string };

export function isTranscribableMime(mime: string): boolean {
  return SUPPORTED_AUDIO_MIME.has(mime);
}

/**
 * Запрашивает транскрипцию у OpenAI Whisper. Возвращает structured outcome —
 * caller сам решает что писать в БД (READY/FAILED/NONE).
 *
 * Параметры:
 *   - buffer: исходные байты аудио (не больше WHISPER_MAX_BYTES).
 *   - mimeType: для Content-Type части multipart.
 *   - filename: используется в multipart filename + помогает OpenAI с
 *     детектом формата (расширение).
 *   - language: optional ISO-639-1 hint ("ru", "en"). Опускается — Whisper
 *     auto-detect.
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  language?: string,
): Promise<TranscribeOutcome> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      status: "NONE",
      reason: "OPENAI_API_KEY not configured — транскрипция не настроена",
    };
  }
  if (!isTranscribableMime(mimeType)) {
    return { status: "NONE", reason: `mime ${mimeType} не поддерживается` };
  }
  if (buffer.length > WHISPER_MAX_BYTES) {
    return {
      status: "FAILED",
      reason: `файл больше ${Math.round(WHISPER_MAX_BYTES / 1024 / 1024)} MB — лимит Whisper API`,
    };
  }

  try {
    const form = new FormData();
    // `new Blob([buffer])` triggers TS error on Node 20: Buffer's underlying
    // ArrayBufferLike isn't narrow-typed to ArrayBuffer. Wrap explicit
    // Uint8Array slice — same bytes, satisfies BlobPart.
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append("file", blob, filename);
    form.append("model", "whisper-1");
    form.append("response_format", "json");
    if (language) form.append("language", language);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);
    try {
      const response = await fetch(WHISPER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return {
          status: "FAILED",
          reason: `Whisper API ${response.status}: ${errText.slice(0, 200) || "no body"}`,
        };
      }
      const data = (await response.json()) as { text?: string };
      const text = data.text?.trim();
      if (!text) {
        return { status: "FAILED", reason: "Whisper вернул пустой текст" };
      }
      return { status: "READY", text };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? `таймаут ${WHISPER_TIMEOUT_MS / 1000}s`
          : err.message
        : String(err);
    return { status: "FAILED", reason: `Whisper error: ${message}` };
  }
}
