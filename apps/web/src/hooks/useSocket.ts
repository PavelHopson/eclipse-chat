import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { createSocket } from "../lib/socket";

/**
 * Создаёт Socket.io клиент и пересоздаёт его при `rev++` (после login,
 * logout, refresh-token rotation).
 *
 * Возвращает текущий socket или null если ещё не создан.
 *
 * Пересоздание — потому что Socket.io не позволяет менять `auth.token`
 * в существующем подключении: нужен новый handshake.
 */
export function useSocket(rev: number): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  const prevRev = useRef(rev);

  useEffect(() => {
    const s = createSocket();
    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.close();
    };
  }, [rev]);

  useEffect(() => {
    prevRev.current = rev;
  }, [rev]);

  return socket;
}
