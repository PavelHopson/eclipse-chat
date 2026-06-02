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
  /** v1.5.23 — filter row controls. Optional — если parent не передал,
   *  filters не показываются (backward compat). */
  filters?: {
    since: string | null;
    until: string | null;
    channelId: string | null;
  };
  onChangeFilters?: (next: {
    since: string | null;
    until: string | null;
    channelId: string | null;
  }) => void;
  /** Список channels для select'а. */
  channels?: Array<{ id: string; name: string }>;
  quickItems?: QuickNavItem[];
};

type Tab = "messages" | "actions" | "files" | "semantic";
type QuickKind = QuickNavItem["kind"];

export type QuickNavItem = {
  id: string;
  label: string;
  detail: string;
  glyph: string;
  kind: "channel" | "dm" | "table" | "view" | "settings";
  onSelect: () => void;
};

const QUICK_KIND_META: Record<
  QuickKind,
  { group: string; glyph: string; label: string }
> = {
  view: { group: "Навигация", glyph: "→", label: "Экран" },
  channel: { group: "Каналы", glyph: "#", label: "Канал" },
  dm: { group: "Личные", glyph: "@", label: "Диалог" },
  table: { group: "Данные", glyph: "▦", label: "Таблица" },
  settings: { group: "Настройки", glyph: "⚙", label: "Раздел" },
};
const QUICK_KIND_ORDER: QuickKind[] = [
  "view",
  "dm",
  "channel",
  "table",
  "settings",
];

// v1.1.95 slice 6: inline-style консоли SearchOverlay вынесены в
// классы .ec-search-* (components.css). JS-hover hit-row убран.

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
  filters,
  onChangeFilters,
  channels,
  quickItems = [],
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const quickButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [tab, setTab] = useState<Tab>("messages");
  const [activeQuickIndex, setActiveQuickIndex] = useState(0);
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
  const quickMatches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ru-RU");
    const source = q
      ? quickItems.filter((item) =>
          `${item.label} ${item.detail}`.toLocaleLowerCase("ru-RU").includes(q),
        )
      : quickItems;
    return source.slice(0, q ? 10 : 8);
  }, [query, quickItems]);
  const quickGroups = useMemo(() => {
    return QUICK_KIND_ORDER.map((kind) => ({
      kind,
      title: QUICK_KIND_META[kind].group,
      items: quickMatches
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.kind === kind),
    })).filter((group) => group.items.length > 0);
  }, [quickMatches]);

  useEffect(() => {
    setActiveQuickIndex(0);
  }, [query, quickMatches.length]);

  useEffect(() => {
    if (quickMatches.length === 0) return;
    const lastIndex = quickMatches.length - 1;
    setActiveQuickIndex((current) => Math.min(current, lastIndex));
  }, [quickMatches.length]);

  useEffect(() => {
    quickButtonRefs.current[activeQuickIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeQuickIndex]);

  return (
    <div
      className="ec-search-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Операционный поиск"
    >
      <div className="ec-search-panel">
        <div className="ec-server-header-edge ec-search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ filter: "drop-shadow(0 0 4px hsl(258 90% 66% / 0.4))" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (quickMatches.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveQuickIndex((current) => (current + 1) % quickMatches.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveQuickIndex((current) =>
                  (current - 1 + quickMatches.length) % quickMatches.length,
                );
                return;
              }
              if (e.key === "Enter") {
                const item = quickMatches[activeQuickIndex];
                if (!item) return;
                e.preventDefault();
                item.onSelect();
                onClose();
              }
            }}
            placeholder="ЗАПРОС_ПОИСКА // сообщения · задачи · файлы…"
            className="ec-search-input"
            aria-controls={quickMatches.length > 0 ? "ec-command-palette-list" : undefined}
            aria-activedescendant={
              quickMatches[activeQuickIndex]
                ? `ec-command-palette-${quickMatches[activeQuickIndex].id}`
                : undefined
            }
          />
          <span className="ec-kbd">↑↓ Enter · Esc</span>
        </div>

        {/* v1.5.23 — filter row: date range + channel select. Виден всегда
            если filters props переданы (нет filters → backward compat). */}
        {filters && onChangeFilters && (
          <div className="ec-search-filters" role="group" aria-label="Фильтры">
            <label className="ec-search-filter">
              <span className="ec-search-filter__label">С</span>
              <input
                type="datetime-local"
                value={filters.since ? filters.since.slice(0, 16) : ""}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    since: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                className="ec-search-filter__input"
                aria-label="Не раньше даты"
              />
            </label>
            <label className="ec-search-filter">
              <span className="ec-search-filter__label">По</span>
              <input
                type="datetime-local"
                value={filters.until ? filters.until.slice(0, 16) : ""}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    until: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                className="ec-search-filter__input"
                aria-label="Не позже даты"
              />
            </label>
            {channels && channels.length > 0 && (
              <label className="ec-search-filter">
                <span className="ec-search-filter__label">Канал</span>
                <select
                  value={filters.channelId ?? ""}
                  onChange={(e) =>
                    onChangeFilters({
                      ...filters,
                      channelId: e.target.value || null,
                    })
                  }
                  className="ec-search-filter__input"
                  aria-label="Канал"
                >
                  <option value="">все каналы</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(filters.since || filters.until || filters.channelId) && (
              <button
                type="button"
                onClick={() =>
                  onChangeFilters({ since: null, until: null, channelId: null })
                }
                className="ec-search-filter__reset"
                title="Сбросить фильтры"
                aria-label="Сбросить фильтры"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {truncated && (totalHits > 0 || semanticAvailable) && (
          <div className="ec-search-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "messages"}
              onClick={() => setTab("messages")}
              className="ec-search-tab"
            >
              Сообщения
              <span className="ec-search-tab__count">{counts.messages}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "actions"}
              onClick={() => setTab("actions")}
              className="ec-search-tab"
            >
              Дела
              <span className="ec-search-tab__count">{counts.actions}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "files"}
              onClick={() => setTab("files")}
              className="ec-search-tab"
            >
              Файлы
              <span className="ec-search-tab__count">{counts.files}</span>
            </button>
            {semanticAvailable && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "semantic"}
                onClick={() => setTab("semantic")}
                className="ec-search-tab"
                title="Поиск по смыслу, а не по точному совпадению слов"
              >
                Семантика
                <span className="ec-search-tab__count">
                  {tab === "semantic" && semantic.loading
                    ? "…"
                    : counts.semantic}
                </span>
              </button>
            )}
          </div>
        )}

        {quickMatches.length > 0 && (
          <div className="ec-command-palette" aria-label="Быстрые переходы">
            <div className="ec-command-palette__head">
              <span>Быстрые переходы</span>
              <span>{query.trim() ? "по запросу" : "основные места"}</span>
            </div>
            <div
              id="ec-command-palette-list"
              className="ec-command-palette__groups"
              role="listbox"
              aria-label="Команды"
            >
              {quickGroups.map((group) => (
                <section className="ec-command-palette__group" key={group.kind}>
                  <div className="ec-command-palette__group-title">
                    {group.title}
                  </div>
                  <div className="ec-command-palette__grid">
                    {group.items.map(({ item, index }) => {
                      const meta = QUICK_KIND_META[item.kind];
                      return (
                        <button
                          id={`ec-command-palette-${item.id}`}
                          key={item.id}
                          ref={(node) => {
                            quickButtonRefs.current[index] = node;
                          }}
                          type="button"
                          role="option"
                          aria-selected={index === activeQuickIndex}
                          className={`ec-command-palette__item ec-command-palette__item--${item.kind}${
                            index === activeQuickIndex ? " is-active" : ""
                          }`}
                          onClick={() => {
                            item.onSelect();
                            onClose();
                          }}
                          onMouseEnter={() => setActiveQuickIndex(index)}
                        >
                          <span className="ec-command-palette__glyph" aria-hidden>
                            {meta.glyph}
                          </span>
                          <span className="ec-command-palette__body">
                            <span className="ec-command-palette__label">{item.label}</span>
                            <span className="ec-command-palette__detail">
                              {meta.label} · {item.detail}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <div className="ec-command-palette__footer" aria-hidden>
              ↑↓ выбрать · Enter открыть · Esc закрыть
            </div>
          </div>
        )}

        <div className="ec-search-list">
          {!truncated && quickMatches.length === 0 && (
            <EmptyState
              icon={<EmptySearchIcon />}
              title="Начните печатать"
              hint="Минимум 2 символа. Поиск в сообщениях, задачах и файлах активного пространства."
              compact
            />
          )}
          {truncated && loading && (
            <p className="ec-search-hint">Ищу…</p>
          )}
          {truncated && !loading && error && (
            <p className="ec-search-hint ec-search-hint--error">{error}</p>
          )}
          {truncated && !loading && !error && totalHits === 0 && quickMatches.length === 0 && (
            <EmptyState
              icon={<EmptySearchIcon />}
              title="Ничего не найдено"
              hint="Попробуйте название канала, имя диалога, таблицу или раздел настроек."
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
      <p className="ec-search-hint">
        Ищу по смыслу…
      </p>
    );
  }
  if (error) {
    return (
      <p className="ec-search-hint ec-search-hint--error">
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
      <p className="ec-search-hint">
        Введи хотя бы 3 символа.
      </p>
    );
  }
  return (
    <div className="ec-search-results">
      {hits.map((h) => (
        <button
          key={h.messageId}
          type="button"
          onClick={() => onSelect(h)}
          className="ec-search-hit"
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
    <div className="ec-search-results">
      {hits.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => onSelect(h)}
          className="ec-search-hit"
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
    <div className="ec-search-results">
      {hits.map((h) => {
        const meta = ACTION_TYPE_META[h.type];
        const done = h.status === "DONE";
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h)}
            className="ec-search-hit"
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
    <div className="ec-search-results">
      {hits.map((h) => {
        const isImage = h.mimeType.startsWith("image/");
        const previewUrl = isImage ? resolveAssetUrl(h.thumbnailUrl ?? h.url) : null;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h)}
            className="ec-search-hit"
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
