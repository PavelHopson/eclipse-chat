import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { resolveAssetUrl } from "../lib/assets";
import {
  SocketEvents,
  type ActionItemEscalatedPayload,
  type MessageNewPayload,
} from "../lib/socket";

type Permission = "default" | "granted" | "denied" | "unsupported";

const LS_KEY = "eclipse_chat_notifications_enabled";
const ORIGINAL_TITLE = "Eclipse Chat";
const NOTIFICATION_ICON = `${import.meta.env.BASE_URL}icon-192.png`;

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
  // v1.5.30 — App Badging API: для installed PWA (Chrome desktop, Edge,
  // Android Chrome) ставим numeric badge на icon в taskbar / launcher.
  // navigator.setAppBadge / clearAppBadge поддерживаются через feature-
  // detect (iOS Safari, Firefox — нет, безопасно ignored).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (unreadTotal > 0) {
      document.title = `(${unreadTotal > 99 ? "99+" : unreadTotal}) ${ORIGINAL_TITLE}`;
    } else {
      document.title = ORIGINAL_TITLE;
    }
    const nav = typeof navigator !== "undefined"
      ? (navigator as Navigator & {
          setAppBadge?: (n?: number) => Promise<void>;
          clearAppBadge?: () => Promise<void>;
        })
      : null;
    if (nav) {
      if (unreadTotal > 0 && typeof nav.setAppBadge === "function") {
        void nav.setAppBadge(unreadTotal).catch(() => undefined);
      } else if (typeof nav.clearAppBadge === "function") {
        void nav.clearAppBadge().catch(() => undefined);
      }
    }
    return () => {
      // restore when unmount
      if (typeof document !== "undefined") document.title = ORIGINAL_TITLE;
      if (nav && typeof nav.clearAppBadge === "function") {
        void nav.clearAppBadge().catch(() => undefined);
      }
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
          icon: resolveAssetUrl(p.avatar) ?? NOTIFICATION_ICON,
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

  // v0.73 #20 phase 3: escalation events. Когда фон ставит task'е
  // escalatedAt=now (overdue 48h+), backend эмитит payload — мы шлём
  // desktop-notification только тем, кому это relevant: assignee или
  // creator. Без anti-spam ratelimit — escalation редкое событие, 1
  // на задачу раз в 7 дней.
  useEffect(() => {
    if (!socket) return;
    if (!isSupported()) return;
    const handler = (p: ActionItemEscalatedPayload) => {
      if (!enabled) return;
      if (permission !== "granted") return;
      if (!currentUserId) return;
      const isMine =
        p.assigneeUserId === currentUserId ||
        p.createdByUserId === currentUserId;
      if (!isMine) return;
      const overdueHours = p.dueAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(p.dueAt).getTime()) / 3_600_000,
            ),
          )
        : null;
      const body =
        overdueHours !== null
          ? `Просрочено ${overdueHours} ч: ${p.title}`
          : `Просрочена задача: ${p.title}`;
      try {
        const notif = new Notification("Эскалация", {
          body,
          icon: NOTIFICATION_ICON,
          tag: `eclipse-chat-escalate-${p.actionItemId}`,
          silent: false,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch {
        /* ignore */
      }
    };
    socket.on(SocketEvents.ActionItemEscalated, handler);
    return () => {
      socket.off(SocketEvents.ActionItemEscalated, handler);
    };
  }, [socket, enabled, permission, currentUserId]);

  return {
    permission,
    enabled,
    supported: permission !== "unsupported",
    request,
    toggle,
  };
}
