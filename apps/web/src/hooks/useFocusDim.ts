import { useCallback, useEffect, useState } from "react";

/**
 * v1.1.65 §11 — focus dimming kill-switch (per-user, localStorage).
 *
 * Сам эффект «Тихий фокус» (боковые панели гаснут, пока курсор в
 * composer'е) реализован pure-CSS через :has() в components.css — без
 * JS-трекинга фокуса. Этот хук — только выключатель: ставит
 * `data-focus-dim="off"` на <html>, CSS-гейт отключает эффект.
 * Default — включено (атрибут не ставится).
 *
 * Первичное применение (анти-FOUC) делает inline-скрипт в index.html.
 */

const LS_KEY = "eclipse_chat_focus_dim";

function getStored(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(LS_KEY) !== "0";
  } catch {
    return true;
  }
}

function apply(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.removeAttribute("data-focus-dim");
  } else {
    document.documentElement.setAttribute("data-focus-dim", "off");
  }
}

export function useFocusDim() {
  const [enabled, setEnabledState] = useState<boolean>(true);

  useEffect(() => {
    const stored = getStored();
    setEnabledState(stored);
    apply(stored);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    apply(next);
    try {
      localStorage.setItem(LS_KEY, next ? "1" : "0");
    } catch {
      /* ignore — приватный режим / квота */
    }
  }, []);

  return { enabled, setEnabled };
}
