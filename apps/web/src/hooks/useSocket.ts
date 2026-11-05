import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { createSocket } from "../lib/socket";
import { assertDisplayedIdentity, captureDisplayedAuth, AuthCoordinationUnavailableError, AuthStateChangedError, type AuthIdentity } from "../lib/storage";
import { ClientUpdateRequiredError, isClientUpdateRequired, markClientUpdateRequired, refreshAccessToken } from "../lib/api";

/**
 * Создаёт Socket.io клиент и пересоздаёт его при `rev++` (после login,
 * logout, refresh-token rotation).
 *
 * Возвращает текущий socket или null если ещё не создан.
 *
 * Пересоздание — потому что Socket.io не позволяет менять `auth.token`
 * в существующем подключении: нужен новый handshake.
 */
const AUTO_REFRESH_COOLDOWN_MS = 30_000;
let lastAutoRefresh: { key: string; at: number } | null = null;

function allowAutoRefresh(identity: AuthIdentity): boolean {
  const key = JSON.stringify([identity.accountId, identity.revision, identity.generation]);
  const now = Date.now();
  if (lastAutoRefresh?.key === key && now - lastAutoRefresh.at < AUTO_REFRESH_COOLDOWN_MS) return false;
  lastAutoRefresh = { key, at: now };
  return true;
}
export function useSocket(rev: number): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  const prevRev = useRef(rev);

  useEffect(() => {
    let s: Socket;
    let identity: AuthIdentity;
    try {
      identity = captureDisplayedAuth().identity;
      s = createSocket();
    } catch (error) {
      if (error instanceof AuthStateChangedError || error instanceof AuthCoordinationUnavailableError) { setSocket(null); return; }
      throw error;
    }
    let disposed = false;
    let refreshStarted = false;
    const stillDisplayed = () => {
      if (disposed) return false;
      try { assertDisplayedIdentity(identity); return true; } catch { return false; }
    };
    const reportRefreshFailure = () => {
      if (stillDisplayed() && !isClientUpdateRequired()) window.dispatchEvent(new CustomEvent("ec:socket-auth-expired"));
    };
    const refreshOnce = () => {
      if (refreshStarted || !stillDisplayed()) return;
      refreshStarted = true;
      if (!allowAutoRefresh(identity)) { reportRefreshFailure(); return; }
      void refreshAccessToken().then((access) => {
        if (!access) { reportRefreshFailure(); return; }
        if (!stillDisplayed()) return;
        const reconnect = () => {
          if (!stillDisplayed()) return;
          s.auth = { token: access, protocol: 2 };
          s.connect();
        };
        // If expiry arrived before the server disconnect packet, reconnect
        // only after that packet. A concurrent refresh in another tab may
        // return the current token without firing this tab's refresh event.
        if (s.connected) s.once("disconnect", reconnect);
        else reconnect();
      }).catch((error: unknown) => {
        if (!(error instanceof ClientUpdateRequiredError)) reportRefreshFailure();
      });
    };
    s.on("connect_error", (error: Error & { data?: { code?: string } }) => {
      if (!stillDisplayed()) return;
      if (error.data?.code === "CLIENT_UPDATE_REQUIRED") markClientUpdateRequired();
      else if (error.data?.code === "TOKEN_EXPIRED" || error.data?.code === "SESSION_UPGRADE_REQUIRED") refreshOnce();
      else if (error.data?.code === "UNAUTHORIZED" || error.data?.code === "AUTH_UNAVAILABLE") reportRefreshFailure();
    });
    s.on("auth:expired", refreshOnce);
    setSocket(s);
    return () => {
      disposed = true;
      s.removeAllListeners();
      s.close();
    };
  }, [rev]);

  useEffect(() => {
    prevRev.current = rev;
  }, [rev]);

  return socket;
}
