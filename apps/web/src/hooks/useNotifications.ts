import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { resolveAssetUrl } from "../lib/assets";
import { SocketEvents, type MessageNewPayload } from "../lib/socket";

type Permission = "default" | "granted" | "denied" | "unsupported";

const LS_KEY = "eclipse_chat_notifications_enabled";
const ORIGINAL_TITLE = "Eclipse Chat";

function getStoredEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

function setStoredEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Browser Notification + tab title badge.
 *
 *   - permission: 'default' | 'granted' | 'denied' | 'unsupported'
 *   - enabled: user choice (LS-persistent). Default true когда granted.
 *   - request(): запросить разрешение (вызывать только из user gesture)
 *   - setEnabled(): toggle (без де-permission'а — браузер сам)
 *
 * Notification shows ТОЛЬКО когда:
 *   - permission granted + enabled + document.hidden = true ИЛИ
 *     channel != selectedChannelId (не активный канал)
 *   - не для своих сообщений
 *
 * Tab title: `(N) Eclipse Chat` где N = sum unread across channels.
 * Updates через unreadTotal параметр.
 */
export function useNotifications(
  socket: Socket | null,
  currentUserId: string | null,
  selectedChannelIdRef: { current: string | null },
  unreadTotal: number,
) {
  const [permission, setPermission] = useState<Permission>("default");
  const [enabled, setEnabled] = useState<boolean>(false);

  // initial perm + stored enabled
  useEffect(() => {
    if (!isSupported()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as Permission);
    setEnabled(getStoredEnabled());
  }, []);

  const request = useCallback(async (): Promise<Permission> => {
    if (!isSupported()) return "unsupported";
    try {
      const res = await Notification.requestPermission();
      setPermission(res as Permission);
      if (res === "granted") {
        setEnabled(true);
        setStoredEnabled(true);
      }
      return res as Permission;
    } catch {
      return "denied";
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setStoredEnabled(next);
      return next;
    });
  }, []);

  // Tab title — badge с unread count
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (unreadTotal > 0) {
      document.title = `(${unreadTotal > 99 ? "99+" : unreadTotal}) ${ORIGINAL_TITLE}`;
    } else {
      document.title = ORIGINAL_TITLE;
    }
    return () => {
      // restore when unmount
      if (typeof document !== "undefined") document.title = ORIGINAL_TITLE;
    };
  }, [unreadTotal]);

  // Anti-spam: ratelimit notifications (одно/2 секунды на user)
  const lastByUser = useRef<Map<string, number>>(new Map());

  // socket: message:new → может показать Notification
  useEffect(() => {
    if (!socket) return;
    if (!isSupported()) return;

    const handler = (p: MessageNewPayload) => {
      if (!enabled) return;
      if (permission !== "granted") return;
      if (currentUserId && p.userId === currentUserId) return;

      const isActiveChannel = p.channelId === selectedChannelIdRef.current;
      const tabHidden = typeof document !== "undefined" && document.hidden;
      // Уведомлять если tab скрыт ИЛИ канал не выбран
      if (isActiveChannel && !tabHidden) return;

      // Ratelimit per user (anti-spam)
      const now = Date.now();
      const last = lastByUser.current.get(p.userId) ?? 0;
      if (now - last < 2_000) return;
      lastByUser.current.set(p.userId, now);

      try {
        const notif = new Notification(p.displayName, {
          body: p.content.slice(0, 120),
          icon: resolveAssetUrl(p.avatar) ?? `${import.meta.env.BASE_URL}favicon.ico`,
          tag: `eclipse-chat-${p.channelId}`,
          silent: false,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch {
        /* ignore — некоторые browser'ы блокируют без permission scope */
      }
    };

    socket.on(SocketEvents.MessageNew, handler);
    return () => {
      socket.off(SocketEvents.MessageNew, handler);
    };
  }, [socket, enabled, permission, currentUserId, selectedChannelIdRef]);

  return {
    permission,
    enabled,
    supported: permission !== "unsupported",
    request,
    toggle,
  };
}
