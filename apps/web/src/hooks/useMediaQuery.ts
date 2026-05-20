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
 *  v1.1.20: mobile breakpoint 900 → 1024 — устройства в 901-1024px
 *  CSS-ширине (large phones, low-DPI / MIUI display-density) получали
 *  cramped планшетный 3-колоночный layout. Убран промежуточный режим:
 *  всё ≤1024 = single-column + drawers. useIsMobile теперь совпадает
 *  с useIsTabletOrSmaller (намеренно — «non-desktop» = единый режим). */
export const useIsMobile = () => useMediaQuery("(max-width: 1024px)");
export const useIsTabletOrSmaller = () => useMediaQuery("(max-width: 1024px)");
