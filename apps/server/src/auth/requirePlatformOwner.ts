import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db.js";
import { getUserId } from "./requireJwt.js";

/**
 * v1.2.6 Platform Admin (trek P1) — preHandler для super-admin эндпоинтов.
 *
 * Доступ только если user.isPlatformOwner = true И не забанен. Делает
 * свежий DB-lookup на каждом запросе (а не доверяет JWT-claim) — это
 * нужно чтобы:
 *   - downgrade флага сразу действовал (без ожидания истечения JWT);
 *   - забаненный platform-owner (теоретически — другим platform-owner'ом)
 *     не мог использовать панель.
 *
 * Применять В ПАРЕ с requireJwt:
 *   { preHandler: [requireJwt, requirePlatformOwner] }
 *
 * Не путать с per-server OWNER/ADMIN ролями (MemberRole) — это
 * отдельная иерархия (см. apps/server/src/lib/permissions.ts).
 */
export async function requirePlatformOwner(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = getUserId(req);
  if (!userId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isPlatformOwner: true, bannedAt: true },
  });

  if (!user || !user.isPlatformOwner || user.bannedAt !== null) {
    return reply.status(403).send({ error: "Forbidden" });
  }
}
