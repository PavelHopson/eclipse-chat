import { useRef, useState, type ReactNode } from "react";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
import { MagnifyingGlassPlusIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlassPlus";

/** Intrinsic-size inspection without remounting the playing media element. */
export function MediaViewport({ width, height, children, enabled = true }: {
  width: number; height: number; children: ReactNode; enabled?: boolean;
}) {
  const [actual, setActual] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const zoomed = enabled && actual && width > 0 && height > 0;
  const select = (next: boolean) => {
    setActual(next); drag.current = null;
    viewport.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };
  return <div className="ec-media-viewport" data-zoomed={zoomed || undefined}>
    <div ref={viewport} className="ec-media-viewport__scroll" role="region"
      aria-label={zoomed ? "Изображение в масштабе 100%, можно прокручивать" : "Изображение целиком"}
      tabIndex={zoomed ? 0 : -1} data-native-cursor
      onPointerDown={event => {
        if (!zoomed || event.button !== 0 || event.pointerType !== "mouse") return;
        drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current) return;
        event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
        event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY;
      }}
      onPointerUp={event => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}>
      <div className="ec-media-viewport__content" style={zoomed ? { width: Math.min(width, 16384), height: Math.min(height, 16384) } : undefined}>
        {children}
      </div>
    </div>
    {enabled && <div className="ec-media-viewport__modes" role="group" aria-label="Масштаб изображения">
      <button type="button" aria-pressed={!zoomed} onClick={() => select(false)}><ArrowsOutSimpleIcon size={14} aria-hidden />Вписать</button>
      <button type="button" aria-pressed={zoomed} disabled={!width || !height} onClick={() => select(true)}><MagnifyingGlassPlusIcon size={14} aria-hidden />100%</button>
    </div>}
  </div>;
}
