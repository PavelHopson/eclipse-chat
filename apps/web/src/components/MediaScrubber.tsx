import { useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

/**
 * MediaScrubber (v1.1.84) — анимированная перематываемая дорожка для
 * медиа-плеера. Сейчас используется музыкой; видео-плеер переиспользует
 * её в слайсе 3 — это «ядро» единого плеера.
 *
 * Взаимодействие: click-to-seek + drag. Hover/drag → дорожка утолщается,
 * thumb проявляется и светится (hover-glow — язык дизайн-макета
 * eclipse-os-v1). Клавиатура: ←/→ перематывают на ±5 c.
 *
 * Во время drag показывается локальная позиция; коммит (`onSeek`) — один
 * раз на отпускании указателя. Для синхро-сессии это один запрос на
 * сервер, без спама во время перетаскивания.
 */

type Props = {
  /** Текущая позиция, мс. */
  positionMs: number;
  /** Длительность, мс. 0 — пока неизвестна (метаданные не загружены). */
  durationMs: number;
  /** Коммит перемотки. */
  onSeek: (positionMs: number) => void;
  disabled?: boolean;
  /** Ширина дорожки (px или CSS-значение). */
  width?: number | string;
};

export function MediaScrubber({
  positionMs,
  durationMs,
  onSeek,
  disabled,
  width = 96,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  const [hover, setHover] = useState(false);

  const seekable = !disabled && durationMs > 0;
  const baseFrac =
    durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  const frac = dragFrac != null ? dragFrac : baseFrac;
  const active = (hover || dragFrac != null) && seekable;
  const dragging = dragFrac != null;

  const fracFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragFrac(fracFromClientX(e.clientX));
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragFrac == null) return;
    setDragFrac(fracFromClientX(e.clientX));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragFrac == null) return;
    const committed = fracFromClientX(e.clientX);
    setDragFrac(null);
    onSeek(committed * durationMs);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!seekable) return;
    const step = 5000;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSeek(Math.max(0, positionMs - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onSeek(Math.min(durationMs, positionMs + step));
    }
  };

  const hitArea: CSSProperties = {
    width,
    flexShrink: 0,
    padding: "7px 0",
    cursor: seekable ? "pointer" : "default",
    touchAction: "none",
    outline: "none",
  };
  const motion = dragging ? "none" : "var(--ec-dur-fast) var(--ec-ease)";

  return (
    <div
      role="slider"
      aria-label="Перемотка"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs)}
      aria-valuenow={Math.round(frac * durationMs)}
      aria-disabled={!seekable}
      tabIndex={seekable ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragFrac(null)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={onKeyDown}
      style={hitArea}
    >
      <div
        ref={trackRef}
        style={{
          position: "relative",
          height: active ? 6 : 4,
          borderRadius: 999,
          background: "var(--ec-surface-3)",
          transition: `height ${motion}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            insetBlock: 0,
            left: 0,
            width: `${frac * 100}%`,
            background: "var(--ec-accent)",
            borderRadius: 999,
            boxShadow: active ? "0 0 8px hsl(258 90% 66% / 0.55)" : "none",
            transition: dragging
              ? "none"
              : `width 320ms linear, box-shadow ${motion}`,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: `${frac * 100}%`,
            width: 11,
            height: 11,
            borderRadius: "50%",
            background: "var(--ec-accent)",
            transform: `translate(-50%, -50%) scale(${active ? 1 : 0})`,
            opacity: active ? 1 : 0,
            boxShadow: active
              ? `0 0 0 3px hsl(258 90% 66% / 0.22), 0 0 12px hsl(258 90% 66% / 0.7)`
              : "none",
            transition: dragging
              ? "none"
              : `transform ${motion}, opacity ${motion}, left 320ms linear`,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
