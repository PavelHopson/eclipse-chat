import type { FastifyBaseLogger } from "fastify";
import { db } from "./db.js";
import { emitMessageDeleted } from "./realtime.js";

/**
 * v1.7.0 — исчезающие сообщения (privacy slice A), cron очистки.
 *
 * Scan каждые SCAN_INTERVAL_MS на сообщения где `expiresAt < now`. Hard-delete
 * (cascade удалит reactions/attachments/embeddings; thread-replies станут orphan
 * через SetNull — history-safe). После delete — emit `message:deleted` в
 * channel-room: фронт-обработчик убирает сообщение из ленты полностью (без
 * tombstone — см. useMessages onDeleted), что и есть нужное «исчезновение».
 *
 * Защита: PROCESS_LIMIT за проход. Интервал 30s — баланс между «исчезло вовремя»
 * (≤30s после deadline) и DB-нагрузкой. Индекс Message_expiresAt_idx покрывает scan.
 *
 * Аналог tempChannels.ts (temp-комнаты по Channel.expiresAt).
 */

const SCAN_INTERVAL_MS = 30_000;
const PROCESS_LIMIT = 200;

let timer: NodeJS.Timeout | null = null;

export function startExpiredMessageCron(log: FastifyBaseLogger): void {
  if (timer) return;
  // Первый scan через 50s после boot — после миграций/recovery/прочих кронов.
  timer = setTimeout(function tick() {
    runExpiredMessageScan(log)
      .catch((err) => log.error({ err }, "Expired message scan failed"))
      .finally(() => {
        timer = setTimeout(tick, SCAN_INTERVAL_MS);
      });
  }, 50_000);
}

export function stopExpiredMessageCron(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

export async function runExpiredMessageScan(log: FastifyBaseLogger): Promise<{
  scanned: number;
  deleted: number;
}> {
  const now = new Date();
  const candidates = await db.message.findMany({
    where: { expiresAt: { lt: now, not: null } },
    take: PROCESS_LIMIT,
    select: { id: true, channelId: true },
  });
  if (candidates.length === 0) {
    return { scanned: 0, deleted: 0 };
  }
  let deleted = 0;
  for (const msg of candidates) {
    try {
      await db.message.delete({ where: { id: msg.id } });
      if (msg.channelId) {
        emitMessageDeleted(msg.channelId, {
          messageId: msg.id,
          channelId: msg.channelId,
          deletedAt: now.toISOString(),
        });
      }
      deleted += 1;
    } catch (err) {
      log.warn({ err, messageId: msg.id }, "Expired message cleanup failed");
    }
  }
  log.info({ scanned: candidates.length, deleted }, "Expired message scan complete");
  return { scanned: candidates.length, deleted };
}
