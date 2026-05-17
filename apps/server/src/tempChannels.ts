import type { FastifyBaseLogger } from "fastify";
import { db } from "./db.js";
import { emitChannelDeleted } from "./realtime.js";

/**
 * v0.74 #29 phase 1: temporary rooms cleanup.
 *
 * Scan каждые SCAN_INTERVAL_MS на каналы где `expiresAt < now`. Hard-delete
 * через cascade — Message/ActionItem/etc. удалятся автоматически (см.
 * schema.prisma onDelete: Cascade). После delete — emit `channel:deleted`
 * в server-room, чтобы клиенты убрали из ChannelList и сбросили selection
 * если активный.
 *
 * Защита: PROCESS_LIMIT за один проход (если 1000 каналов истекли
 * одновременно — не вешаем сервер на одной транзакции).
 *
 * Interval 60s — баланс между responsiveness ("автоудаление через 1ч"
 * triggers ≤ 1 минута после deadline) и DB-нагрузкой.
 */

const SCAN_INTERVAL_MS = 60_000;
const PROCESS_LIMIT = 100;

let timer: NodeJS.Timeout | null = null;

export function startTempChannelCron(log: FastifyBaseLogger): void {
  if (timer) return;
  // Первый scan через 45s после boot — после миграций/recovery/escalation.
  timer = setTimeout(function tick() {
    runTempChannelScan(log)
      .catch((err) => log.error({ err }, "Temp channel scan failed"))
      .finally(() => {
        timer = setTimeout(tick, SCAN_INTERVAL_MS);
      });
  }, 45_000);
}

export function stopTempChannelCron(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

export async function runTempChannelScan(log: FastifyBaseLogger): Promise<{
  scanned: number;
  deleted: number;
}> {
  const now = new Date();
  const candidates = await db.channel.findMany({
    where: { expiresAt: { lt: now, not: null } },
    take: PROCESS_LIMIT,
    select: { id: true, serverId: true, name: true },
  });
  if (candidates.length === 0) {
    return { scanned: 0, deleted: 0 };
  }
  let deleted = 0;
  for (const ch of candidates) {
    try {
      await db.channel.delete({ where: { id: ch.id } });
      emitChannelDeleted(ch.serverId, {
        channelId: ch.id,
        serverId: ch.serverId,
      });
      deleted += 1;
    } catch (err) {
      log.warn({ err, channelId: ch.id }, "Temp channel cleanup failed");
    }
  }
  log.info(
    { scanned: candidates.length, deleted },
    "Temp channel scan complete",
  );
  return { scanned: candidates.length, deleted };
}
