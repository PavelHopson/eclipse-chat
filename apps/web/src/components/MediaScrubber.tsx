import { useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

/**
 * MediaScrubber (v1.2.0 «Signal Desk» redesign) — фирменная
 * перематываемая дорожка. Единое ядро таймлайна для аудио и видео.
 *
 * Что делает её НЕ браузерной полоской:
 *  - три слоя: buffered (загружено) / fill (сыграно) / playhead;
 *  - hover-предпросмотр — над курсором всплывает время точки, куда
 *    попадёшь при клике: плеер «подсказывает» до коммита;
 *  - drag с pointer-capture, thumb растёт, tooltip привязан к нему;
 *  - loading — дорожка идёт shimmer'ом, пока длительность неизвестна,
 *    а не висит мёртвой полоской.
 *
 * Компонент отдаёт только динамику через CSS-переменные
 * (--frac / --buffered / --preview) и data-атрибуты; весь визуальный
 * слой — `.ec-scrubber*` в player.css.
 */

type Props = {
  /** Текущая позиция, мс. */
  positionMs: number;
  /** Длительность, мс. 0 — пока неизвестна. */
  durationMs: number;
  /** Загружено (буфер), мс. Опционально — рисует buffered-слой. */
  bufferedMs?: number;
  /** Коммит перемотки. */
  onSeek: (positionMs: number) => void;
  disabled?: boolean;
  /** Метаданные/буфер ещё грузятся — дорожка в loading-состоянии. */
  loading?: boolean;
  /** Ширина дорожки (px или CSS-значение). */
  width?: number | string;
};

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function clockOf(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MediaScrubber({
  positionMs,
  durationMs,
  bufferedMs = 0,
  onSeek,
  disabled,
  loading,
  width = 96,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);

  const seekable = !disabled && durationMs > 0 && !loading;
  const baseFrac = durationMs > 0 ? clamp01(positionMs / durationMs) : 0;
  const frac = dragFrac != null ? dragFrac : baseFrac;
  const bufFrac = durationMs > 0 ? clamp01(bufferedMs / durationMs) : 0;
  const previewFrac = dragFrac != null ? dragFrac : hoverFrac;
  const dragging = dragFrac != null;
  const active = (dragging || hoverFrac != null) && seekable;

  const fracFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return clamp01((clientX - r.left) / r.width);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragFrac(fracFromClientX(e.clientX));
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    const f = fracFromClientX(e.clientX);
    if (dragFrac != null) setDragFrac(f);
    else setHoverFrac(f);
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
      aria-valuetext={clockOf(frac * durationMs)}
      aria-disabled={!seekable}
      data-active={active ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      data-loading={loading ? "true" : "false"}
      tabIndex={seekable ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragFrac(null)}
      onPointerLeave={() => setHoverFrac(null)}
      onKeyDown={onKeyDown}
      style={
        {
          width,
          "--frac": frac,
          "--buffered": bufFrac,
          "--preview": previewFrac ?? 0,
        } as CSSProperties
      }
    >
      <div ref={trackRef} className="ec-scrubber__track">
        <div className="ec-scrubber__buffered" aria-hidden />
        <div className="ec-scrubber__fill" aria-hidden />
      </div>
      <div className="ec-scrubber__ghost" aria-hidden />
      <div className="ec-scrubber__thumb" aria-hidden />
      {previewFrac != null && seekable && (
        <div className="ec-scrubber__preview" aria-hidden>
          {clockOf(previewFrac * durationMs)}
        </div>
      )}
    </div>
  );
}
