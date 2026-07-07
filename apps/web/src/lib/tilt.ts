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

export function onDepthTiltMove(e: MouseEvent<HTMLElement>) {
  if (reducedMotion) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  const dx = px - 0.5;
  const dy = py - 0.5;

  el.style.setProperty("--ec-depth-glow-x", `${(px * 100).toFixed(0)}%`);
  el.style.setProperty("--ec-depth-glow-y", `${(py * 100).toFixed(0)}%`);
  el.style.setProperty("--ec-depth-active", "1");
  el.style.transform =
    `perspective(760px) rotateX(${(-dy * 4.5).toFixed(2)}deg) ` +
    `rotateY(${(dx * 4.5).toFixed(2)}deg) translateY(-1px)`;
}

export function onDepthTiltLeave(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.transform = "";
  el.style.setProperty("--ec-depth-active", "0");
  el.style.setProperty("--ec-depth-glow-x", "50%");
  el.style.setProperty("--ec-depth-glow-y", "50%");
}

/** Spreadable props-объект — `<div {...tiltProps}>`. */
export const tiltProps = {
  onMouseMove: onTiltMove,
  onMouseLeave: onTiltLeave,
} as const;

/** Premium depth card: tilt + cursor-following glow, no dependency. */
export const depthTiltProps = {
  onMouseMove: onDepthTiltMove,
  onMouseLeave: onDepthTiltLeave,
} as const;
