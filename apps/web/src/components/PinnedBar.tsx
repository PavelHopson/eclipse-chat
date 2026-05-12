import type { CSSProperties } from "react";
import { useState } from "react";
import { Avatar } from "./Avatar";
import type { MessageRow } from "../hooks/useMessages";

type Props = {
  messages: MessageRow[];
};

const bar: CSSProperties = {
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "hsl(40 70% 60% / 0.04)",
};

const triggerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-2) var(--ec-space-5)",
  width: "100%",
  background: "transparent",
  border: 0,
  color: "var(--ec-text-muted)",
  cursor: "pointer",
  fontSize: "var(--ec-text-sm)",
  transition: "color var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
};

const listWrap: CSSProperties = {
  maxHeight: 260,
  overflowY: "auto",
  padding: "var(--ec-space-2) var(--ec-space-3) var(--ec-space-3)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
  borderTop: "1px solid var(--ec-border-subtle)",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px 1fr",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-2)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  fontSize: "var(--ec-text-sm)",
};

function formatPinned(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  if (sameDay) {
    return `Сегодня, ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function PinnedBar({ messages }: Props) {
  const pinned = messages.filter((m) => m.pinnedAt && !m.deletedAt);
  const [open, setOpen] = useState(false);

  if (pinned.length === 0) return null;

  return (
    <div style={bar}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={triggerStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--ec-text)";
          e.currentTarget.style.background = "hsl(40 70% 60% / 0.07)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--ec-text-muted)";
          e.currentTarget.style.background = "transparent";
        }}
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ec-warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14V5l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
        </svg>
        <span>
          <strong style={{ color: "var(--ec-text)" }}>Закреплённые:</strong> {pinned.length}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
          {open ? "скрыть" : "показать"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--ec-dur-fast) var(--ec-ease)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={listWrap}>
          {pinned.map((m) => (
            <article key={m.id} style={cardStyle}>
              <Avatar url={m.user.avatar} name={m.user.displayName} size={28} />
              <div style={{ minWidth: 0 }}>
                <header style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                  <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)" }}>
                    {m.user.displayName}
                  </strong>
                  <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                    {m.pinnedAt ? formatPinned(m.pinnedAt) : ""}
                  </span>
                </header>
                <p
                  style={{
                    margin: 0,
                    color: "var(--ec-text-muted)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {m.content}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
