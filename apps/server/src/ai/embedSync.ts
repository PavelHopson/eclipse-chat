import type { FastifyBaseLogger } from "fastify";
import { db } from "../db.js";
import {
  EmbeddingNotConfiguredError,
  embedText,
  isEmbeddingConfigured,
} from "./embeddings.js";

/**
 * v0.77 #21: fire-and-forget sync embedder.
 *
 * Caller (route POST message) запускает `void scheduleEmbed(...)` после
 * успешного create message + emit на channel. Если провайдер не сетап,
 * вызов silently no-op'ит — embeddings опциональная фича.
 *
 * Защиты:
 *   - Min length: только сообщения >= MIN_CHARS embed'им (короткие "ok",
 *     "+1" не дают сигнала и засоряют поиск).
 *   - Skip уже-embedded (unique index на messageId защитит, но избегаем
 *     лишний embedding-call).
 *   - Error logged через FastifyBaseLogger, никогда не reject'нет
 *     promise (caller обернёт void).
 *
 * Future: rate-limit per user / queue (Bull/BullMQ) для batched processing.
 * Сейчас — single fire-and-forget. Production load на воркспейсе Pavel'я
 * не критичный.
 */

const MIN_CHARS = 12;
const MAX_CHARS = 4000;

export function scheduleEmbed(
  messageId: string,
  content: string,
  log: FastifyBaseLogger,
): void {
  if (!isEmbeddingConfigured()) return;
  const text = (content ?? "").trim();
  if (text.length < MIN_CHARS) return;
  void doEmbed(messageId, text.slice(0, MAX_CHARS), log).catch((err) => {
    if (err instanceof EmbeddingNotConfiguredError) return;
    log.warn({ err, messageId }, "embed sync failed");
  });
}

async function doEmbed(
  messageId: string,
  text: string,
  _log: FastifyBaseLogger,
): Promise<void> {
  const existing = await db.messageEmbedding.findUnique({
    where: { messageId },
    select: { id: true },
  });
  if (existing) return;
  const result = await embedText(text);
  await db.messageEmbedding.create({
    data: {
      messageId,
      vector: result.vector,
      model: result.model,
    },
  });
}
