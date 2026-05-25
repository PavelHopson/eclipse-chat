import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { Avatar } from "./Avatar";

type Props = {
  identity: string;
  name: string;
  avatar: string | null;
  /** 0..2 — текущий volume (default 1.0). */
  volume: number;
  isMuted: boolean;
  /** Координаты от document — fixed positioning. */
  anchorX: number;
  anchorY: number;
  onVolumeChange: (v: number) => void;
  onResetVolume: () => void;
  onToggleMute: () => void;
  onClose: () => void;
};

// v1.5.7 — cinematic frame теперь приходит из .ec-popover-surface
// (accent border, holo rail, multi-shadow, entry-anim). Inline остаётся
// только positioning + layout-specific.
const menu: CSSProperties = {
  position: "fixed",
  padding: "var(--ec-space-3)",
  minWidth: 240,
  zIndex: 200,
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
};

const volRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
};

const muteRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  paddingTop: "var(--ec-space-2)",
  borderTop: "1px solid var(--ec-border-subtle)",
};

export function ParticipantContextMenu({
  identity: _identity,
  name,
  avatar,
  volume,
  isMuted,
  anchorX,
  anchorY,
  onVolumeChange,
  onResetVolume,
  onToggleMute,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Clamp position в viewport
  const w = 260;
  const h = 160;
  const left = Math.min(anchorX, window.innerWidth - w - 8);
  const top = Math.min(anchorY, window.innerHeight - h - 8);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="ec-popover-surface" style={{ ...menu, left, top }} role="menu" aria-label={`Действия с ${name}`}>
      <div style={headerRow}>
        <Avatar url={avatar} name={name} size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "var(--ec-text-sm)", fontWeight: 600, color: "var(--ec-text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </div>
          <div style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
            Только для тебя — другие участники не увидят
          </div>
        </div>
      </div>

      <div>
        <label
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-muted)",
            marginBottom: 4,
          }}
        >
          <span>Громкость</span>
          <span style={{ fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>
            {Math.round(volume * 100)}%
          </span>
        </label>
        <div style={volRow}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: "var(--ec-text-dim)" }}>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            style={{ flex: 1, accentColor: "var(--ec-accent)" }}
            aria-label={`Громкость ${name}`}
          />
          <button
            type="button"
            onClick={onResetVolume}
            className="ec-btn ec-btn--ghost ec-btn--sm"
            title="Сброс к 100%"
            style={{ minWidth: 36, fontSize: "0.6rem", padding: "0.2rem 0.4rem" }}
          >
            100%
          </button>
        </div>
      </div>

      <div style={muteRow}>
        <button
          type="button"
          onClick={onToggleMute}
          className={isMuted ? "ec-btn ec-btn--danger ec-btn--sm" : "ec-btn ec-btn--sm"}
          style={{ flex: 1 }}
        >
          {isMuted ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginRight: 6 }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
              </svg>
              Включить звук
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginRight: 6 }}>
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              </svg>
              Заглушить для меня
            </>
          )}
        </button>
      </div>
    </div>
  );
}
