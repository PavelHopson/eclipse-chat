import type { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { db } from "../db.js";

type JwtSub = { sub: string; email: string; iat?: number; exp?: number };

/**
 * Сохраняет userId в `socket.data.userId` (или null) по JWT из handshake.auth.token.
 * Невалидные / истекшие токены трактуем как неавторизованное подключение (клиент обновит access).
 *
 * v1.2.6 Platform Admin (trek P1) — banned-юзеры отбиваются на connect-
 * стадии (next с ошибкой → client получит connect_error). Активные
 * сокеты при бане сервер дисконнектит отдельно из роута
 * /api/platform/users/:id/ban (см. routes/platform.ts).
 */
export function registerSocketAuth(io: Server, secret: string) {
  io.use(async (socket, next) => {
    const t = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (!t) {
      (socket.data as { userId: string | null }).userId = null;
      return next();
    }
    try {
      const payload = jwt.verify(t, secret) as JwtSub;
      const userId = payload.sub ?? null;
      if (userId) {
        const u = await db.user.findUnique({
          where: { id: userId },
          select: { bannedAt: true, deletedAt: true },
        });
        if (u) {
          if (u.deletedAt !== null) return next(new Error("deleted"));
          if (u.bannedAt !== null) return next(new Error("banned"));
        }
      }
      (socket.data as { userId: string | null }).userId = userId;
    } catch {
      (socket.data as { userId: string | null }).userId = null;
    }
    return next();
  });
}
