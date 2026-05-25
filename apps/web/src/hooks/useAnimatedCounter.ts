import { useEffect, useRef, useState } from "react";

/**
 * v1.5.1 — smooth count-up animation для metrics.
 * Animates from current displayed value к target через cubic-out easing.
 * Respects prefers-reduced-motion (instant set без animation).
 */
export function useAnimatedCounter(
  target: number,
  options: { duration?: number; delay?: number } = {},
): number {
  const { duration = 800, delay = 0 } = options;
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }

    const start = () => {
      const from = fromRef.current;
      const to = target;
      if (from === to) return;
      const startTime = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        // cubic-out easing
        const eased = 1 - Math.pow(1 - t, 3);
        const current = from + (to - from) * eased;
        setValue(t === 1 ? to : Math.round(current));
        fromRef.current = t === 1 ? to : current;
        if (t < 1) {
          rafRef.current = window.requestAnimationFrame(tick);
        }
      };
      rafRef.current = window.requestAnimationFrame(tick);
    };

    if (delay > 0) {
      timeoutRef.current = window.setTimeout(start, delay);
    } else {
      start();
    }

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [target, duration, delay]);

  return value;
}
