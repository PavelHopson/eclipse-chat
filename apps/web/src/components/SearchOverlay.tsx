import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { Avatar } from "./Avatar";
import type { SearchHit } from "../hooks/useSearch";

type Props = {
  query: string;
  setQuery: (q: string) => void;
  results: SearchHit[];
  loading: boolean;
  error: string | null;
  onSelect: (hit: SearchHit) => void;
  onClose: () => void;
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "saturate(140%) blur(10px)",
  WebkitBackdropFilter: "saturate(140%) blur(10px)",
  zIndex: 200,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "10vh var(--ec-space-4) var(--ec-space-4)",
  animation: "ec-fade-in var(--ec-dur-base) var(--ec-ease) both",
};

const panel: CSSProperties = {
  width: "min(560px, 100%)",
  maxHeight: "70vh",
  display: "flex",
  flexDirection: "column",
  background: "hsl(200 8% 9% / 0.94)",
  backdropFilter: "saturate(180%) blur(20px)",
  WebkitBackdropFilter: "saturate(180%) blur(20px)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  boxShadow: "var(--ec-shadow-modal)",
  overflow: "hidden",
  animation: "ec-modal-zoom-in var(--ec-dur-base) var(--ec-ease-out) both",
};

const searchInputWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "var(--ec-space-3) var(--ec-space-4)",
  borderBottom: "1px solid var(--ec-border-subtle)",
};

const searchInput: CSSProperties = {
  flex: 1,
  background: "transparent",
  border: 0,
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-md)",
  outline: "none",
};

const listWrap: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "var(--ec-space-2) var(--ec-space-2) var(--ec-space-3)",
};

const hitRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px 1fr auto",
  alignItems: "start",
  gap: "var(--ec-space-3)",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  width: "100%",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text)",
  cursor: "pointer",
  textAlign: "left",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const kbd: CSSProperties = {
  display: "inline-block",
  padding: "0 5px",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-xs)",
  fontFamily: "var(--ec-font-mono)",
  fontSize: "0.62rem",
  color: "var(--ec-text-muted)",
  lineHeight: 1.6,
};

/** Highlight terms в content. Чувствительность к регистру отключена. */
function highlight(content: string, query: string): React.ReactNode[] {
  const q = query.trim();
  if (!q) return [content];
  // Берём только первое слово запроса для подсветки + escape regex chars
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = content.split(re);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <mark
          key={i}
          style={{
            background: "var(--ec-accent-soft)",
            color: "var(--ec-accent)",
            padding: "0 2px",
            borderRadius: 2,
          }}
        >
          {part}
        </mark>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function formatHitDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SearchOverlay({
  query,
  setQuery,
  results,
  loading,
  error,
  onSelect,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const truncated = query.trim().length >= 2;

  return (
    <div
      style={backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Поиск по сообщениям"
    >
      <div style={panel}>
        <div style={searchInputWrap}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ec-text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск сообщений в этом сервере…"
            style={searchInput}
          />
          <span style={kbd}>Esc</span>
        </div>
        <div style={listWrap}>
          {!truncated && (
            <div className="ec-empty" style={{ padding: "var(--ec-space-6)" }}>
              <div className="ec-empty-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <div className="ec-empty-title">Начните печатать</div>
              <div className="ec-empty-hint">Минимум 2 символа. Поиск в текстовых каналах активного сервера, без удалённых.</div>
            </div>
          )}
          {truncated && loading && (
            <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-3) var(--ec-space-3)", margin: 0 }}>
              Ищу…
            </p>
          )}
          {truncated && !loading && error && (
            <p style={{ color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-3) var(--ec-space-3)", margin: 0 }}>
              {error}
            </p>
          )}
          {truncated && !loading && !error && results.length === 0 && (
            <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-3) var(--ec-space-3)", margin: 0 }}>
              Ничего не найдено.
            </p>
          )}
          {truncated && !loading && results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {results.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelect(h)}
                  style={hitRow}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ec-surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Avatar url={h.user.avatar} name={h.user.displayName} size={28} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)" }}>
                        {h.user.displayName}
                      </strong>
                      <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
                        в <span style={{ color: "var(--ec-accent)" }}>#{h.channel.name}</span>
                      </span>
                    </span>
                    <span
                      style={{
                        color: "var(--ec-text-muted)",
                        fontSize: "var(--ec-text-sm)",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {highlight(h.content, query)}
                    </span>
                  </span>
                  <time
                    dateTime={h.createdAt}
                    style={{
                      fontFamily: "var(--ec-font-mono)",
                      fontSize: "var(--ec-text-2xs)",
                      color: "var(--ec-text-dim)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatHitDate(h.createdAt)}
                  </time>
                </button>
              ))}
              {results.length === 50 && (
                <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)", padding: "var(--ec-space-2) var(--ec-space-3)", margin: 0 }}>
                  Показаны первые 50. Уточните запрос для более точного результата.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
