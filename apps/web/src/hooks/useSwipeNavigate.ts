import { useEffect, useRef } from "react";

/**
 * v0.81 #27 phase 2 PWA: touch swipe navigation между каналами.
 *
 * Mounts touch listeners на target (или window если null) и вызывает
 * onSwipeLeft / onSwipeRight когда финальное смещение > THRESHOLD pixels
 * на horizontal axis с vertical drift < DRIFT_TOLERANCE (чтобы не
 * конфликтовать со scroll'ом).
 *
 * UX: дает natural Telegram/Discord-like UI — pinch'ом перемещаться
 * между #каналами одного сервера без открытия drawer'а. Только когда
 * `enabled=true` (передаётся false на desktop / в open drawer / voice).
 */

const SWIPE_THRESHOLD = 60; // px минимум для регистрации
const DRIFT_TOLERANCE = 50; // px vertical drift — больше → ignore (scroll)
const TIME_LIMIT_MS = 700; // > → не считается swipe

export function useSwipeNavigate(opts: {
  enabled: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  target?: HTMLElement | null;
}) {
  const { enabled, onSwipeLeft, onSwipeRight, target } = opts;
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    // Если target явно передан null — слушаем на window (полный chat-area).
    const el: HTMLElement | Window = target ?? window;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0]!;
      startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };

    const onEnd = (e: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dt = Date.now() - start.t;
      if (dt > TIME_LIMIT_MS) return;
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      if (dy > DRIFT_TOLERANCE) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (dx > 0 && onSwipeRight) onSwipeRight();
      else if (dx < 0 && onSwipeLeft) onSwipeLeft();
    };

    // Pointer events: touchstart/touchend. Не блокируем дефолт — иначе
    // ломаем normal scrolling.
    (el as EventTarget).addEventListener("touchstart", onStart as EventListener, {
      passive: true,
    });
    (el as EventTarget).addEventListener("touchend", onEnd as EventListener, {
      passive: true,
    });
    return () => {
      (el as EventTarget).removeEventListener(
        "touchstart",
        onStart as EventListener,
      );
      (el as EventTarget).removeEventListener(
        "touchend",
        onEnd as EventListener,
      );
    };
  }, [enabled, onSwipeLeft, onSwipeRight, target]);
}
