import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import type { UserStatus } from "../hooks/useProfile";

type Props = {
  anchorRect: DOMRect;
  current: UserStatus;
  onSelect: (status: UserStatus) => void;
  onOpenProfile?: () => void;
  onClose: () => void;
};

const popover: CSSProperties = {
  position: "fixed",
  background: "var(--ec-overlay-bg)",
  backdropFilter: "saturate(180%) blur(14px)",
  WebkitBackdropFilter: "saturate(180%) blur(14px)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-md)",
  boxShadow: "var(--ec-shadow-md)",
  padding: 4,
  display: "flex",
  flexDirection: "column",
  gap: 0,
  minWidth: 180,
  zIndex: 80,
  animation: "ec-modal-zoom-in var(--ec-dur-fast) var(--ec-ease-out) both",
};

const item: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0.4rem 0.7rem 0.4rem 0.4rem",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  cursor: "pointer",
  textAlign: "left",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
  width: "100%",
};

const dotBase: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "var(--ec-radius-full)",
  flexShrink: 0,
};

type StatusOption = {
  value: UserStatus;
  label: string;
  description: string;
  dot: CSSProperties;
};

const OPTIONS: StatusOption[] = [
  {
    value: "ONLINE",
    label: "В сети",
    description: "Видна автоматическая активность",
    dot: { ...dotBase, background: "var(--ec-presence-online)", boxShadow: "0 0 6px hsl(150 50% 50% / 0.6)" },
  },
  {
    value: "IDLE",
    label: "Неактивен",
    description: "На месте, но отвлёкся",
    dot: { ...dotBase, background: "var(--ec-presence-idle)" },
  },
  {
    value: "DND",
    label: "Не беспокоить",
    description: "Уведомления глушатся (планируется)",
    dot: { ...dotBase, background: "var(--ec-presence-dnd)" },
  },
  {
    value: "INVISIBLE",
    label: "Невидим",
    description: "Другие видят как «не в сети»",
    dot: { ...dotBase, background: "var(--ec-presence-offline)" },
  },
];

export function StatusMenu({ anchorRect, current, onSelect, onOpenProfile, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay listener: чтобы initial click (открывший меню) сам не закрыл
    const t = setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Positioning: ниже-слева от anchor (user-chip), clamp в viewport
  const POP_W = 220;
  const POP_H = 220;
  const margin = 8;
  let left = anchorRect.left;
  let top = anchorRect.bottom + 6;
  if (left + POP_W > window.innerWidth - margin) {
    left = window.innerWidth - POP_W - margin;
  }
  if (top + POP_H > window.innerHeight - margin) {
    top = anchorRect.top - POP_H - 6;
  }
  if (left < margin) left = margin;

  return (
    <div ref={ref} style={{ ...popover, left, top, minWidth: POP_W }} role="menu" aria-label="Статус">
      {OPTIONS.map((o) => {
        const isActive = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            onClick={() => {
              onSelect(o.value);
              onClose();
            }}
            style={{
              ...item,
              background: isActive ? "var(--ec-surface-3)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--ec-surface-2)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={o.dot} aria-hidden />
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 600, color: isActive ? "var(--ec-text-strong)" : "var(--ec-text)" }}>
                {o.label}
              </span>
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                {o.description}
              </span>
            </span>
            {isActive && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        );
      })}
      {onOpenProfile && (
        <>
          <div style={{ height: 1, background: "var(--ec-border-subtle)", margin: "4px 0" }} aria-hidden />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenProfile();
              onClose();
            }}
            style={item}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ec-surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span aria-hidden style={{ width: 10, display: "grid", placeItems: "center", color: "var(--ec-text-muted)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span style={{ color: "var(--ec-text)" }}>Профиль…</span>
          </button>
        </>
      )}
    </div>
  );
}
