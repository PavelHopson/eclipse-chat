import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { EmptyState } from "./EmptyState";
import { EmptySearchIcon } from "./EmptyIcons";
import { resolveAssetUrl } from "../lib/assets";
import type {
  SearchActionHit,
  SearchFileHit,
  SearchMessageHit,
  SearchResults,
} from "../hooks/useSearch";
import { useSemanticSearch } from "../hooks/useSemanticSearch";

/**
 * SearchOverlay — operational search с tabs (v0.57).
 *
 * Categories: Сообщения / Дела / Файлы. Counter в tab показывает количество
 * hits. Auto-switch на первую non-empty категорию при изменении query —
 * чтобы user не залип на пустой tab.
 */

type Props = {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResults;
  loading: boolean;
  error: string | null;
  onSelectMessage: (hit: SearchMessageHit) => void;
  onSelectAction: (hit: SearchActionHit) => void;
  onSelectFile: (hit: SearchFileHit) => void;
  onClose: () => void;
  /** v0.77 #21: serverId для semantic-search tab. Null = hide tab. */
  semanticServerId?: string | null;
};

type Tab = "messages" | "actions" | "files" | "semantic";

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
  width: "min(620px, 100%)",
  maxHeight: "75vh",
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
  background: "hsl(210 25% 4% / 0.55)",
  position: "relative",
};

const searchInput: CSSProperties = {
  flex: 1,
  background: "transparent",
  border: 0,
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-md)",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
  letterSpacing: "0.02em",
  outline: "none",
};

const tabsRow: CSSProperties = {
  display: "flex",
  gap: 2,
  padding: "var(--ec-space-2) var(--ec-space-3) 0",
  borderBottom: "1px solid var(--ec-border-subtle)",
};

const tabBtn = (active: boolean): CSSProperties => ({
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "transparent",
  border: 0,
  borderBottom: active ? "2px solid var(--ec-accent)" : "2px solid transparent",
  color: active ? "var(--ec-text-strong)" : "var(--ec-text-muted)",
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  transition: "color var(--ec-dur-fast) var(--ec-ease)",
});

const tabCount = (active: boolean): CSSProperties => ({
  fontSize: "0.65rem",
  fontWeight: 700,
  padding: "0 6px",
  borderRadius: "var(--ec-radius-full)",
  background: active ? "var(--ec-accent-soft)" : "var(--ec-surface-2)",
  color: active ? "var(--ec-accent)" : "var(--ec-text-dim)",
  fontFeatureSettings: '"tnum"',
  minWidth: 18,
  textAlign: "center",
  display: "inline-block",
});

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

const ACTION_TYPE_META: Record<
  "TASK" | "DECISION" | "FOLLOW_UP",
  { glyph: string; color: string; label: string }
> = {
  TASK: { glyph: "▣", color: "var(--ec-status-exec)", label: "Задача" },
  DECISION: { glyph: "◆", color: "var(--ec-accent)", label: "Решение" },
  FOLLOW_UP: { glyph: "○", color: "var(--ec-status-warn)", label: "Follow-up" },
};

function highlight(content: string, query: string): React.ReactNode[] {
  const q = query.trim();
  if (!q) return [content];
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

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SearchOverlay({
  query,
  setQuery,
  results,
  loading,
  error,
  onSelectMessage,
  onSelectAction,
  onSelectFile,
  onClose,
  semanticServerId,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("messages");
  const semantic = useSemanticSearch(
    semanticServerId ?? null,
    query,
    tab === "semantic",
  );

  // Auto-switch на первую non-empty категорию когда results меняются —
  // если текущий tab пуст, а другой имеет hits, prefer non-empty.
  // Semantic в auto-switch не участвует: это explicit choice пользователя.
  const counts = useMemo(
    () => ({
      messages: results.messages.length,
      actions: results.actions.length,
      files: results.files.length,
      semantic: semantic.hits.length,
    }),
    [results, semantic.hits.length],
  );

  useEffect(() => {
    if (tab === "semantic") return; // pure user-choice
    if (counts[tab] > 0) return;
    if (counts.messages > 0) setTab("messages");
    else if (counts.actions > 0) setTab("actions");
    else if (counts.files > 0) setTab("files");
  }, [counts, tab]);

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
  const totalHits = counts.messages + counts.actions + counts.files;
  // Semantic-tab показываем только если есть serverId + не «notConfigured».
  // Если backend вернул 503 — скрываем chip, чтобы не дразнить юзера.
  const semanticAvailable =
    Boolean(semanticServerId) && !semantic.notConfigured;

  return (
    <div
      className="ec-search-overlay"
      style={backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Операционный поиск"
    >
      <div style={panel}>
        <div className="ec-server-header-edge" style={searchInputWrap}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ filter: "drop-shadow(0 0 4px hsl(258 90% 66% / 0.4))" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ЗАПРОС_ПОИСКА // сообщения · задачи · файлы…"
            style={searchInput}
          />
          <span style={kbd}>Esc</span>
        </div>

        {truncated && (totalHits > 0 || semanticAvailable) && (
          <div style={tabsRow} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "messages"}
              onClick={() => setTab("messages")}
              style={tabBtn(tab === "messages")}
            >
              Сообщения
              <span style={tabCount(tab === "messages")}>{counts.messages}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "actions"}
              onClick={() => setTab("actions")}
              style={tabBtn(tab === "actions")}
            >
              Дела
              <span style={tabCount(tab === "actions")}>{counts.actions}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "files"}
              onClick={() => setTab("files")}
              style={tabBtn(tab === "files")}
            >
              Файлы
              <span style={tabCount(tab === "files")}>{counts.files}</span>
            </button>
            {semanticAvailable && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "semantic"}
                onClick={() => setTab("semantic")}
                style={tabBtn(tab === "semantic")}
                title="Поиск по смыслу, а не по точному совпадению слов"
              >
                Семантика
                <span style={tabCount(tab === "semantic")}>
                  {tab === "semantic" && semantic.loading
                    ? "…"
                    : counts.semantic}
                </span>
              </button>
            )}
          </div>
        )}

        <div style={listWrap}>
          {!truncated && (
            <EmptyState
              icon={<EmptySearchIcon />}
              title="Начните печатать"
              hint="Минимум 2 символа. Поиск в сообщениях, задачах и файлах активного пространства."
              compact
            />
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
          {truncated && !loading && !error && totalHits === 0 && (
            <EmptyState
              icon={<EmptySearchIcon />}
              title="Ничего не найдено"
              hint="Попробуйте другие слова, имя автора или часть имени файла."
              compact
            />
          )}

          {truncated && !loading && !error && totalHits > 0 && tab === "messages" && (
            <MessageList
              hits={results.messages}
              query={query}
              onSelect={onSelectMessage}
            />
          )}
          {truncated && !loading && !error && totalHits > 0 && tab === "actions" && (
            <ActionList
              hits={results.actions}
              query={query}
              onSelect={onSelectAction}
            />
          )}
          {truncated && !loading && !error && totalHits > 0 && tab === "files" && (
            <FileList
              hits={results.files}
              query={query}
              onSelect={onSelectFile}
            />
          )}
          {truncated && tab === "semantic" && (
            <SemanticList
              hits={semantic.hits}
              loading={semantic.loading}
              error={semantic.error}
              query={query}
              onSelect={(h) =>
                onSelectMessage({
                  // адаптируем под SearchMessageHit shape — все нужные поля есть.
                  // slug не передаётся бэкендом — fallback на channelId (для
                  // onSelectMessage важна только channel.id для навигации).
                  id: h.messageId,
                  content: h.content,
                  createdAt: h.createdAt,
                  channel: {
                    id: h.channelId,
                    name: h.channelName,
                    slug: h.channelId,
                  },
                  user: {
                    id: h.userId ?? "",
                    displayName: h.displayName ?? "—",
                    avatar: h.avatar,
                  },
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SemanticList({
  hits,
  loading,
  error,
  query,
  onSelect,
}: {
  hits: Array<{
    score: number;
    messageId: string;
    content: string;
    createdAt: string;
    channelId: string;
    channelName: string;
    userId: string | null;
    displayName: string | null;
    avatar: string | null;
  }>;
  loading: boolean;
  error: string | null;
  query: string;
  onSelect: (h: {
    score: number;
    messageId: string;
    content: string;
    createdAt: string;
    channelId: string;
    channelName: string;
    userId: string | null;
    displayName: string | null;
    avatar: string | null;
  }) => void;
}) {
  if (loading) {
    return (
      <p
        style={{
          color: "var(--ec-text-dim)",
          fontSize: "var(--ec-text-sm)",
          padding: "var(--ec-space-3) var(--ec-space-3)",
          margin: 0,
        }}
      >
        Ищу по смыслу…
      </p>
    );
  }
  if (error) {
    return (
      <p
        style={{
          color: "var(--ec-danger)",
          fontSize: "var(--ec-text-sm)",
          padding: "var(--ec-space-3) var(--ec-space-3)",
          margin: 0,
        }}
      >
        {error}
      </p>
    );
  }
  if (hits.length === 0 && query.trim().length >= 3) {
    return (
      <EmptyState
        icon={<EmptySearchIcon />}
        title="Ничего похожего"
        hint="Семантический поиск ищет по смыслу. Попробуй сформулировать иначе."
        compact
      />
    );
  }
  if (hits.length === 0) {
    return (
      <p
        style={{
          color: "var(--ec-text-dim)",
          fontSize: "var(--ec-text-sm)",
          padding: "var(--ec-space-3) var(--ec-space-3)",
          margin: 0,
        }}
      >
        Введи хотя бы 3 символа.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {hits.map((h) => (
        <button
          key={h.messageId}
          type="button"
          onClick={() => onSelect(h)}
          style={hitRow}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--ec-surface-2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <Avatar url={h.avatar} name={h.displayName ?? "?"} size={28} />
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
            }}
          >
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong
                style={{
                  color: "var(--ec-text-strong)",
                  fontSize: "var(--ec-text-sm)",
                }}
              >
                {h.displayName ?? "—"}
              </strong>
              <span
                style={{
                  color: "var(--ec-text-dim)",
                  fontSize: "var(--ec-text-2xs)",
                }}
              >
                в{" "}
                <span style={{ color: "var(--ec-accent)" }}>
                  #{h.channelName}
                </span>
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  color: "var(--ec-accent)",
                  padding: "0 6px",
                  borderRadius: "var(--ec-radius-full)",
                  background: "var(--ec-accent-soft)",
                  border: "1px solid var(--ec-border-accent)",
                }}
                title={`relevance ${h.score.toFixed(3)}`}
              >
                {(h.score * 100).toFixed(0)}%
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
              {h.content}
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
    </div>
  );
}

function MessageList({
  hits,
  query,
  onSelect,
}: {
  hits: SearchMessageHit[];
  query: string;
  onSelect: (h: SearchMessageHit) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {hits.map((h) => (
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
    </div>
  );
}

function ActionList({
  hits,
  query,
  onSelect,
}: {
  hits: SearchActionHit[];
  query: string;
  onSelect: (h: SearchActionHit) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {hits.map((h) => {
        const meta = ACTION_TYPE_META[h.type];
        const done = h.status === "DONE";
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h)}
            style={hitRow}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ec-surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              aria-hidden
              style={{
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--ec-radius-sm)",
                background: "var(--ec-surface-2)",
                color: meta.color,
                fontFamily: "var(--ec-font-mono)",
              }}
            >
              {meta.glyph}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <strong
                  style={{
                    color: done ? "var(--ec-text-dim)" : "var(--ec-text-strong)",
                    fontSize: "var(--ec-text-sm)",
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {highlight(h.title, query)}
                </strong>
                <span style={{ color: meta.color, fontSize: "var(--ec-text-2xs)" }}>
                  {meta.label}
                </span>
                {done && (
                  <span style={{ color: "var(--ec-status-exec)", fontSize: "var(--ec-text-2xs)" }}>
                    ✓
                  </span>
                )}
              </span>
              {h.description && (
                <span
                  style={{
                    color: "var(--ec-text-muted)",
                    fontSize: "var(--ec-text-2xs)",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {highlight(h.description, query)}
                </span>
              )}
              <span
                style={{
                  color: "var(--ec-text-dim)",
                  fontSize: "var(--ec-text-2xs)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: "var(--ec-accent)" }}>#{h.channel.name}</span>
                {h.assignee && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Avatar url={h.assignee.avatar} name={h.assignee.displayName} size={14} />
                    {h.assignee.displayName}
                  </span>
                )}
                {h.dueAt && <span>до {formatHitDate(h.dueAt)}</span>}
              </span>
            </span>
            <span />
          </button>
        );
      })}
    </div>
  );
}

function FileList({
  hits,
  query,
  onSelect,
}: {
  hits: SearchFileHit[];
  query: string;
  onSelect: (h: SearchFileHit) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {hits.map((h) => {
        const isImage = h.mimeType.startsWith("image/");
        const previewUrl = isImage ? resolveAssetUrl(h.thumbnailUrl ?? h.url) : null;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h)}
            style={hitRow}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ec-surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              aria-hidden
              style={{
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--ec-radius-sm)",
                background: "var(--ec-surface-2)",
                color: "var(--ec-accent)",
                overflow: "hidden",
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {highlight(h.filename, query)}
              </span>
              <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)", display: "flex", gap: 6 }}>
                <span style={{ color: "var(--ec-accent)" }}>#{h.channel.name}</span>
                <span>{humanSize(h.size)}</span>
                <span>{h.mimeType.split("/")[1] ?? h.mimeType}</span>
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
        );
      })}
    </div>
  );
}
