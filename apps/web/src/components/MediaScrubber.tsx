import { useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

/**
 * MediaScrubber (v1.1.91 redesign) — фирменная перематываемая дорожка
 * медиа-плеера. Единое «ядро» таймлайна для аудио и видео.
 *
 * Взаимодействие: click-to-seek + drag. Hover/drag утолщают дорожку,
 * thumb проявляется и зажигается. Клавиши ←/→ — перемотка на ±5 c.
 *
 * Во время drag показывается локальная позиция; коммит (`onSeek`) —
 * один раз на отпускании указателя. Визуальный слой — `.ec-scrubber*`
 * в player.css; компонент отдаёт только динамику: `--frac` (0..1) и
 * data-active / data-dragging.
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

  return (
    <div
      className="ec-scrubber"
      role="slider"
      aria-label="Перемотка"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs)}
      aria-valuenow={Math.round(frac * durationMs)}
      aria-disabled={!seekable}
      data-active={active ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      tabIndex={seekable ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragFrac(null)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={onKeyDown}
      style={{ width, "--frac": frac } as CSSProperties}
    >
      <div ref={trackRef} className="ec-scrubber__track">
        <div className="ec-scrubber__fill" />
        <div className="ec-scrubber__thumb" aria-hidden />
      </div>
    </div>
  );
}
