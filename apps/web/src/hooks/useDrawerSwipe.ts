import { useEffect, useRef } from "react";

/**
 * useDrawerSwipe (v1.6.84) — края-свайпы для мобильных drawer'ов:
 *   - свайп вправо от ЛЕВОГО края экрана → открыть канальный drawer;
 *   - свайп влево от ПРАВОГО края → открыть drawer участников (если есть);
 *   - когда drawer открыт, свайп в обратную сторону → закрыть.
 *
 * Слушатели на window (passive) ставятся ОДИН раз; актуальное состояние и
 * колбэки читаются через ref, поэтому хук не переподписывается на каждый рендер.
 * Срабатывает только при доминирующем ГОРИЗОНТАЛЬНОМ жесте (вертикальный скролл
 * сообщений не задеваем). Открытие — только от края экрана, чтобы не конфликтовать
 * с горизонтально-скроллимым контентом (код-блоки и т.п.).
 */

type DrawerSwipeCtx = {
  enabled: boolean;
  navOpen: boolean;
  membersOpen: boolean;
  membersAvailable: boolean;
  openNav: () => void;
  closeNav: () => void;
  openMembers: () => void;
  closeMembers: () => void;
};

export function useDrawerSwipe(ctx: DrawerSwipeCtx) {
  const ref = useRef(ctx);
  ref.current = ctx;

  useEffect(() => {
    const EDGE = 30; // зона старта от края, px
    const THRESH = 56; // минимальный горизонтальный сдвиг для срабатывания, px
    const VERTICAL_SLOP = 18; // если вертикаль ушла дальше — это скролл, отменяем

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let decided = false;
    let fromLeftEdge = false;
    let fromRightEdge = false;

    const onStart = (e: TouchEvent) => {
      const c = ref.current;
      if (!c.enabled || e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      decided = false;
      fromLeftEdge = startX <= EDGE;
      fromRightEdge = startX >= window.innerWidth - EDGE;
      // Отслеживаем, если открыт drawer (для закрытия) или старт у края (для открытия).
      tracking = c.navOpen || c.membersOpen || fromLeftEdge || fromRightEdge;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || decided) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > VERTICAL_SLOP) {
        tracking = false; // вертикальный жест — это скролл
        return;
      }
      if (Math.abs(dx) < THRESH) return;
      decided = true;
      const c = ref.current;
      if (c.navOpen) {
        if (dx < 0) c.closeNav();
      } else if (c.membersOpen) {
        if (dx > 0) c.closeMembers();
      } else if (fromLeftEdge && dx > 0) {
        c.openNav();
      } else if (fromRightEdge && dx < 0 && c.membersAvailable) {
        c.openMembers();
      }
    };

    const onEnd = () => {
      tracking = false;
      decided = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);
}
