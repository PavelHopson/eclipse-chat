import { useEffect, useRef } from "react";
import { panelWidth } from "../lib/conversationNavigation";

export function PanelResizeHandle({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  const drag = useRef<{ x: number; width: number; value: number; shell: HTMLElement } | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);
  const maxWidth = () => Math.min(560, window.innerWidth - 76 - 218 - 340);
  return <div className="ec-panel-resize" role="separator" tabIndex={0} aria-label="Ширина обсуждения"
    aria-orientation="vertical" aria-valuemin={320} aria-valuemax={560} aria-valuenow={width}
    onKeyDown={event => {
      const next = event.key === "ArrowLeft" ? width + 16 : event.key === "ArrowRight" ? width - 16 : event.key === "Home" ? 320 : event.key === "End" ? maxWidth() : null;
      if (next !== null) { event.preventDefault(); onResize(panelWidth(next, maxWidth())); }
    }}
    onDoubleClick={() => onResize(400)}
    onPointerDown={event => {
      if (event.button !== 0) return;
      const shell = event.currentTarget.closest<HTMLElement>(".ec-shell");
      const panel = event.currentTarget.parentElement;
      if (!shell || !panel) return;
      event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, width: panel.clientWidth, value: panel.clientWidth, shell };
    }}
    onPointerMove={event => {
      const current = drag.current;
      if (!current) return;
      current.value = panelWidth(current.width + current.x - event.clientX, maxWidth());
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (drag.current) drag.current.shell.style.setProperty("--ec-discussion-width", drag.current.value + "px");
      });
    }}
    onLostPointerCapture={() => {
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = null;
      if (drag.current) onResize(drag.current.value);
      drag.current = null;
    }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
  />;
}
