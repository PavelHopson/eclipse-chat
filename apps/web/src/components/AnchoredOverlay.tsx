import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function overlayPosition(anchor: { left: number; right: number; top: number; bottom: number },
  width: number, height: number, viewport: { left: number; top: number; width: number; height: number }) {
  const margin = 12;
  const left = Math.max(viewport.left + margin, Math.min(anchor.right - width, viewport.left + viewport.width - width - margin));
  const bottom = viewport.top + viewport.height - margin;
  const top = anchor.bottom + 8 + height <= bottom ? anchor.bottom + 8
    : Math.max(viewport.top + margin, anchor.top - height - 8);
  return { left, top };
}

/** Portal + viewport collision handling shared by interactive header previews. */
export function AnchoredOverlay({ anchor, label, children, onClose, onEnter, onLeave, autoFocus = false, focusTarget }: {
  anchor: RefObject<HTMLElement | null>; label: string; children: ReactNode;
  focusTarget?: RefObject<HTMLElement | null>; autoFocus?: boolean; onClose: () => void; onEnter?: () => void; onLeave?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, ready: false });
  useLayoutEffect(() => {
    const update = () => {
      if (!anchor.current || !panel.current) return;
      const a = anchor.current.getBoundingClientRect(), p = panel.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      setPosition({ ...overlayPosition(a, p.width, p.height, {
        left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? innerWidth, height: viewport?.height ?? innerHeight,
      }), ready: true });
    };
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !anchor.current?.contains(event.target)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); (focusTarget?.current ?? anchor.current?.querySelector<HTMLElement>("button"))?.focus(); }
    };
    update();
    const focusFrame = autoFocus ? requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("select, input, button, [tabindex='0']")?.focus()) : null;
    const observer = new ResizeObserver(update);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key, true);
    return () => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      observer.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", key, true);
    };
  }, [anchor, onClose, autoFocus, focusTarget]);
  return createPortal(<div ref={panel} className="ec-anchored-overlay" role="dialog" aria-label={label}
    data-native-cursor style={{ left: position.left, top: position.top, visibility: position.ready ? "visible" : "hidden" }}
    onMouseEnter={onEnter} onMouseLeave={onLeave} onFocusCapture={onEnter}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        onLeave?.();
        if (autoFocus && event.relatedTarget && !anchor.current?.contains(event.relatedTarget as Node)) onClose();
      }
    }}>
    {children}
  </div>, document.body);
}
