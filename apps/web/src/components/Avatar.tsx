import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type Props = {
  url: string | null | undefined;
  name: string;
  size?: number;
};

/**
 * Avatar с fallback на инициалы. URL приходит с backend как
 * `/uploads/avatars/...` — относительный путь без BASE_URL prefix.
 * Здесь префиксируем `import.meta.env.BASE_URL` (минус trailing slash),
 * чтобы работало под dev (`/uploads/...`) и под path-based prod
 * (`/eclipse-chat/uploads/...`).
 */
function resolveAvatarUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return letters || "??";
}

/**
 * Стабильный цвет фона из имени — детерминированный hash → HSL, чтобы
 * placeholder не прыгал между рендерами.
 *
 * v0.34: saturation bumped 30→45 + lightness 32→34 — для visual interest
 * на dark theme. Hue по hash, saturation/lightness constant — calm range,
 * никаких "neon"-сэтуплов.
 */
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue}, 45%, 34%)`;
}

export function Avatar({ url, name, size = 32 }: Props) {
  const fontSize = Math.round(size * 0.42);
  const [errored, setErrored] = useState(false);

  // Сбрасываем error-state при смене url — например после re-upload аватара.
  useEffect(() => {
    setErrored(false);
  }, [url]);

  const useFallback = !url || errored;
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    background: useFallback ? colorFor(name) : "var(--ec-surface-3, #2a2a32)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--ec-text, #e8e8ed)",
    fontWeight: 600,
    fontSize,
    letterSpacing: 0,
    userSelect: "none",
    // Border тонкий — отделяет avatar от фона при темной теме.
    boxShadow: "inset 0 0 0 1px var(--ec-border-subtle, rgba(255,255,255,0.05))",
  };
  if (useFallback) {
    return (
      <span style={style} aria-hidden>
        {initials(name)}
      </span>
    );
  }
  return (
    <span style={style} aria-hidden>
      <img
        src={resolveAvatarUrl(url!)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => {
          // Image broken (corrupt webp / 404 / wrong path) → swap на initials.
          // Не show «broken image» icon на UI — это ломает визуал.
          setErrored(true);
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
        }}
      />
    </span>
  );
}
