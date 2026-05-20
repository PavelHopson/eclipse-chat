import { useEffect, useState } from "react";

/**
 * SSR-safe matchMedia hook. Используется ТОЛЬКО для logic-decisions
 * (например auto-close drawer при resize в desktop). Все layout-rules
 * — через CSS media queries в `responsive.css`, не через JS.
 *
 * Это правильный подход: layout всегда быстрый (CSS), state derives
 * только когда нужно (например «закрыть drawer когда переключились
 * на desktop, чтобы при следующем mobile-view drawer не был open»).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Convenience-хуки под breakpoints из tokens.css.
 *  v1.1.17: mobile breakpoint 640 → 900 — телефоны Pavel'я попадали
 *  в диапазон 640-1024 и получали cramped 3-колоночный «планшетный»
 *  layout (rail+channels+chat squeeze). 900px надёжно покрывает все
 *  телефоны (даже large / landscape / low-DPI режимы). */
export const useIsMobile = () => useMediaQuery("(max-width: 900px)");
export const useIsTabletOrSmaller = () => useMediaQuery("(max-width: 1024px)");
