import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/** A precise core and a trailing corona. Text and native media keep their cursors. */
export function EclipsePointer() {
  const ringRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(pointer: fine)");
    let frame = 0;
    let visible = false;
    let x = 0, y = 0, ringX = 0, ringY = 0;
    const root = document.documentElement;
    const hide = () => {
      visible = false;
      root.classList.remove("ec-pointer-active");
      ringRef.current?.setAttribute("data-visible", "false");
      coreRef.current?.setAttribute("data-visible", "false");
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const draw = () => {
      frame = 0;
      if (!visible) return;
      ringX += (x - ringX) * 0.24;
      ringY += (y - ringY) * 0.24;
      if (ringRef.current) ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      if (coreRef.current) coreRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (Math.abs(x - ringX) + Math.abs(y - ringY) > 0.2) frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      const target = event.target;
      if (motion.matches || !pointer.matches || event.pointerType !== "mouse" || !(target instanceof Element)
        || !target.closest(".ec-workspace-v2, .ec-server-actions-menu")
        || target.closest("input, textarea, [contenteditable=true], video, iframe, :disabled, [data-native-cursor]")) {
        hide();
        return;
      }
      x = event.clientX; y = event.clientY;
      if (!visible) {
        ringX = x; ringY = y;
        visible = true;
        root.classList.add("ec-pointer-active");
        ringRef.current?.setAttribute("data-visible", "true");
        coreRef.current?.setAttribute("data-visible", "true");
      }
      ringRef.current?.setAttribute("data-interactive", String(Boolean(target.closest("button:not(:disabled), a[href], summary, [role=tab]"))));
      if (!frame) frame = requestAnimationFrame(draw);
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", hide);
    document.addEventListener("visibilitychange", hide);
    document.addEventListener("keydown", hide);
    window.addEventListener("blur", hide);
    motion.addEventListener("change", hide);
    pointer.addEventListener("change", hide);
    return () => {
      hide();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", hide);
      document.removeEventListener("visibilitychange", hide);
      document.removeEventListener("keydown", hide);
      window.removeEventListener("blur", hide);
      motion.removeEventListener("change", hide);
      pointer.removeEventListener("change", hide);
    };
  }, []);
  return createPortal(<>
    <div ref={ringRef} className="ec-eclipse-pointer" aria-hidden="true"><span /></div>
    <div ref={coreRef} className="ec-eclipse-pointer-core" aria-hidden="true" />
  </>, document.body);
}
