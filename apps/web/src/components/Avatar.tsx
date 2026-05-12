import type { CSSProperties } from "react";

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

/** Стабильный цвет фона из имени — чтобы placeholder не "прыгал" между перерендерами. */
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue}, 30%, 32%)`;
}

export function Avatar({ url, name, size = 32 }: Props) {
  const fontSize = Math.round(size * 0.42);
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    background: url ? "#2a2a32" : colorFor(name),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#e8e8ed",
    fontWeight: 600,
    fontSize,
    letterSpacing: 0,
    userSelect: "none",
  };
  if (url) {
    return (
      <span style={style} aria-hidden>
        <img
          src={resolveAvatarUrl(url)}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return (
    <span style={style} aria-hidden>
      {initials(name)}
    </span>
  );
}
