import type { FastifyReply } from "fastify";
import { db } from "../db.js";

/**
 * v1.2.7 Platform Admin (trek P2) — suspend-gating для server-scoped
 * write-операций. Platform-owner может заморозить сервер через
 * /api/platform/servers/:id/suspend; пока suspendedAt !== null
 * write-операции в этом сервере должны отбиваться 403.
 *
 * Применяется в роутах ДО мутации:
 *   const ok = await ensureServerActive(serverId, reply);
 *   if (!ok) return;
 *
 * Чтение (список каналов, история сообщений, member-list и т.д.)
 * НЕ блокируется — история не пропадает, никаких «исчезновений».
 * Заморожен → write-режим выключен; read-режим жив.
 *
 * Если server не найден — helper НЕ возвращает 404 сам (это
 * ответственность роута). Просто пропускает (returns true) — пусть
 * последующая логика обнаружит missing-server и ответит штатно.
 */

export class ServerSuspendedError extends Error {
  constructor(public reason: string | null) {
    super(
      reason
        ? `Сервер заморожен администратором: ${reason}`
        : "Сервер заморожен администратором.",
    );
    this.name = "ServerSuspendedError";
  }
}

/**
 * Проверяет статус сервера; throws ServerSuspendedError если заморожен.
 * Низкоуровневый — используйте ensureServerActive для штатного 403.
 */
export async function assertServerActive(serverId: string): Promise<void> {
  const s = await db.server.findUnique({
    where: { id: serverId },
    select: { suspendedAt: true, suspendedReason: true },
  });
  if (!s) return;
  if (s.suspendedAt !== null) {
    throw new ServerSuspendedError(s.suspendedReason);
  }
}

/**
 * Высокоуровневый helper: проверяет server активен. Если заморожен —
 * отвечает 403 и возвращает false (caller должен сразу return).
 * Иначе возвращает true.
 */
export async function ensureServerActive(
  serverId: string,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await assertServerActive(serverId);
    return true;
  } catch (e) {
    if (e instanceof ServerSuspendedError) {
      await reply.status(403).send({ error: e.message });
      return false;
    }
    throw e;
  }
}
