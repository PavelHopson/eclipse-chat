/**
 * v1.1.29 — parallax mouse-tilt для карточек.
 *
 * Классический 3D-tilt: курсор над элементом → `perspective rotateX/
 * rotateY` пропорционально смещению от центра. На mouseleave —
 * сброс. Desktop-only (на mobile нет mousemove — gracefully no-op).
 *
 * Использование:
 *   <div onMouseMove={onTiltMove} onMouseLeave={onTiltLeave} ...>
 *
 * Элементу нужен `transition: transform <150-180ms>` для плавного
 * сброса (см. .ec-tiltable в tokens.css или inline).
 */

import type { MouseEvent } from "react";

const MAX_DEG = 6;

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function onTiltMove(e: MouseEvent<HTMLElement>) {
  if (reducedMotion) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  el.style.transform =
    `perspective(720px) rotateX(${(-py * MAX_DEG).toFixed(2)}deg) ` +
    `rotateY(${(px * MAX_DEG).toFixed(2)}deg)`;
}

export function onTiltLeave(e: MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "";
}

/** Spreadable props-объект — `<div {...tiltProps}>`. */
export const tiltProps = {
  onMouseMove: onTiltMove,
  onMouseLeave: onTiltLeave,
} as const;
