import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { INTERACTION_EVENT, readInteractionPreferences } from "../lib/interactionPreferences";

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
    let previousX = 0, previousY = 0, previousAt = performance.now();
    const root = document.documentElement;
    let preferences = readInteractionPreferences();
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
      if (!preferences.pointer || !preferences.motion || motion.matches || !pointer.matches || event.pointerType !== "mouse" || !(target instanceof Element)
        || !target.closest(".ec-workspace-v2, .ec-server-actions-menu, .ec-modal-backdrop")
        || target.closest("input, textarea, select, [contenteditable=true], video, iframe, :disabled, [data-native-cursor], [role=separator]")) {
        hide();
        return;
      }
      x = event.clientX; y = event.clientY;
      const now = performance.now();
      const elapsed = Math.max(8, now - previousAt);
      const dx = x - previousX;
      const dy = y - previousY;
      const velocity = Math.min(1, Math.hypot(dx, dy) / elapsed / 1.6);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      previousX = x; previousY = y; previousAt = now;
      if (!visible) {
        ringX = x; ringY = y;
        visible = true;
        root.classList.add("ec-pointer-active");
        ringRef.current?.setAttribute("data-visible", "true");
        coreRef.current?.setAttribute("data-visible", "true");
      }
      const actionable = target.closest("button:not(:disabled), a[href], summary, [role=tab], [role=menuitem]");
      const destructive = target.closest(".ec-btn--danger, .ec-settings-category-item--danger, [data-cursor='danger']");
      const drag = target.closest("[draggable=true], [data-cursor='drag']");
      const mode = destructive ? "danger" : drag ? "drag" : actionable ? "action" : "precision";
      if (ringRef.current) {
        ringRef.current.dataset.mode = mode;
        ringRef.current.style.setProperty("--ec-pointer-velocity", velocity.toFixed(3));
        ringRef.current.style.setProperty("--ec-pointer-angle", `${angle.toFixed(1)}deg`);
      }
      ringRef.current?.setAttribute("data-interactive", String(Boolean(actionable)));
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const press = () => ringRef.current?.setAttribute("data-pressed", "true");
    const release = () => ringRef.current?.removeAttribute("data-pressed");
    const updatePreferences = () => {
      preferences = readInteractionPreferences();
      root.dataset.ecMotion = preferences.motion ? "full" : "quiet";
      hide();
    };
    updatePreferences();
    window.addEventListener(INTERACTION_EVENT, updatePreferences);
    window.addEventListener("storage", updatePreferences);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", press, { passive: true });
    document.addEventListener("pointerup", release, { passive: true });
    document.addEventListener("pointerleave", hide);
    document.addEventListener("visibilitychange", hide);
    document.addEventListener("keydown", hide);
    window.addEventListener("blur", hide);
    motion.addEventListener("change", hide);
    pointer.addEventListener("change", hide);
    return () => {
      hide();
      window.removeEventListener(INTERACTION_EVENT, updatePreferences);
      window.removeEventListener("storage", updatePreferences);
      delete root.dataset.ecMotion;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("pointerup", release);
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
