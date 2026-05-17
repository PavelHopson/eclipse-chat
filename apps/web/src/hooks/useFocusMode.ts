import { useCallback, useEffect, useState } from "react";

/**
 * v0.74 #29 phase 1: Focus mode (per-user, persistent через localStorage).
 *
 * Когда включён — MessageList фильтрует feed:
 *   * direct-mentions (@user / @assignee текущего user'а)
 *   * pinned messages
 *   * system-сообщения (incident / bot)
 *   * сообщения автора = currentUserId
 *   * messages с action items, где currentUser в creator/assignee/approver
 *
 * Скрываются:
 *   * чужой smalltalk, обсуждения без mention'а, reactions-only активность.
 *
 * Цель: «hide noise» mode для глубокой работы. Тоггл — кнопка в topbar.
 * State не привязан к каналу/серверу — глобальный для всех views.
 */

const LS_KEY = "eclipse_chat_focus_mode";

function getStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

function setStored(value: boolean): void {
  try {
    localStorage.setItem(LS_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function useFocusMode() {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(getStored());
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setStored(next);
      return next;
    });
  }, []);

  return { enabled, toggle };
}
