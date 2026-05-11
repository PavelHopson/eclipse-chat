import type { Server } from "socket.io";
import jwt from "jsonwebtoken";

type JwtSub = { sub: string; email: string; iat?: number; exp?: number };

/**
 * Сохраняет userId в `socket.data.userId` (или null) по JWT из handshake.auth.token.
 * Невалидные / истекшие токены трактуем как неавторизованное подключение (клиент обновит access).
 */
export function registerSocketAuth(io: Server, secret: string) {
  io.use((socket, next) => {
    const t = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (!t) {
      (socket.data as { userId: string | null }).userId = null;
      return next();
    }
    try {
      const payload = jwt.verify(t, secret) as JwtSub;
      (socket.data as { userId: string | null }).userId = payload.sub ?? null;
    } catch {
      (socket.data as { userId: string | null }).userId = null;
    }
    return next();
  });
}
