/**
 * v1.7.0 — исчезающие сообщения (privacy slice A). Чистая логика TTL — без БД,
 * чтобы юнит-тестить (CI = vitest без PG). Используется отправкой сообщения
 * (routes/channels.ts), PATCH канала (routes/servers.ts), cron'ом
 * (expiredMessages.ts).
 *
 * Гранулярность «Оба» (выбор Pavel): дефолтный TTL канала
 * (`Channel.messageTtlSeconds`) + пер-сообщение override при отправке.
 */

export const MESSAGE_TTL_MIN_SECONDS = 60; // 1 минута
export const MESSAGE_TTL_MAX_SECONDS = 30 * 24 * 3600; // 30 дней

// Пресеты для UI канала: null = выкл + дискретные значения.
export const MESSAGE_TTL_PRESETS: ReadonlyArray<number | null> = [null, 3600, 86400, 604800];

/**
 * Нормализует TTL канала: null/≤0/невалид → null (выкл); иначе клампится в
 * [MESSAGE_TTL_MIN_SECONDS, MESSAGE_TTL_MAX_SECONDS].
 */
export function normalizeMessageTtl(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined) return null;
  const n = Math.floor(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.max(n, MESSAGE_TTL_MIN_SECONDS), MESSAGE_TTL_MAX_SECONDS);
}

/**
 * Срок исчезновения сообщения. Приоритет:
 *   - override === undefined → дефолт канала (channelTtlSeconds);
 *   - override === null      → сообщение НЕ исчезает (явный opt-out);
 *   - override > 0           → нормализованный override.
 * null = постоянное сообщение.
 */
export function computeMessageExpiry(
  channelTtlSeconds: number | null,
  overrideSeconds: number | null | undefined,
  now: Date,
): Date | null {
  const ttl =
    overrideSeconds !== undefined
      ? normalizeMessageTtl(overrideSeconds)
      : normalizeMessageTtl(channelTtlSeconds);
  if (ttl === null) return null;
  return new Date(now.getTime() + ttl * 1000);
}
