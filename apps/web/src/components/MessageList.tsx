import type { CSSProperties } from "react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import type { MessageRow } from "../hooks/useMessages";

type Props = {
  messages: MessageRow[];
  emptyHint?: string;
  channelName?: string | null;
  currentUserId?: string;
  onRetry?: (messageId: string) => Promise<boolean>;
};

const wrap: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--ec-space-4) var(--ec-space-5) var(--ec-space-2)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const rowBase: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  columnGap: "var(--ec-space-3)",
  padding: "var(--ec-space-2) var(--ec-space-2)",
  paddingRight: 80,
  borderRadius: "var(--ec-radius-md)",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const rowGrouped: CSSProperties = {
  ...rowBase,
  paddingTop: 2,
  paddingBottom: 2,
};

const daySeparator: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  margin: "var(--ec-space-4) 0 var(--ec-space-2)",
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
};

const dayLine: CSSProperties = {
  flex: 1,
  height: 1,
  background: "var(--ec-border-subtle)",
};

const stickyTime: CSSProperties = {
  fontFamily: "var(--ec-font-mono)",
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  whiteSpace: "nowrap",
  paddingTop: 4,
  opacity: 0,
  transition: "opacity var(--ec-dur-fast) var(--ec-ease)",
};

const actionsBar: CSSProperties = {
  position: "absolute",
  top: 2,
  right: 8,
  display: "flex",
  gap: 2,
  padding: 2,
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  boxShadow: "var(--ec-shadow-sm)",
  opacity: 0,
  transition: "opacity var(--ec-dur-fast) var(--ec-ease)",
  pointerEvents: "none",
};

const actionBtn: CSSProperties = {
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text-muted)",
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
};

const failedTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginLeft: "var(--ec-space-2)",
  padding: "0.05rem 0.45rem",
  background: "var(--ec-danger-soft)",
  color: "var(--ec-danger)",
  border: "1px solid var(--ec-danger)",
  borderRadius: "var(--ec-radius-full)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "var(--ec-tracking-wide)",
};

function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Сегодня";
  if (sameDay(d, yest)) return "Вчера";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function MessageList({ messages, emptyHint, channelName, currentUserId, onRetry }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleCopy = async (m: MessageRow) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1400);
    } catch {
      /* clipboard недоступен — fail silently, не критично */
    }
  };

  if (messages.length === 0) {
    return (
      <div ref={containerRef} style={{ ...wrap, justifyContent: "center" }}>
        <div className="ec-empty">
          <div className="ec-empty-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
          </div>
          <div className="ec-empty-title">
            {channelName ? (
              <>
                Начните разговор в <span style={{ color: "var(--ec-accent)" }}>#{channelName}</span>
              </>
            ) : (
              "Сообщений пока нет"
            )}
          </div>
          <div className="ec-empty-hint">{emptyHint ?? "Будьте первым — напишите что-нибудь ниже."}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={wrap}>
      {messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const sameAuthor = prev?.user.id === m.user.id;
        const closeInTime =
          prev != null && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
        const grouped = Boolean(sameAuthor && closeInTime);
        const newDay = !prev || dayKey(m.createdAt) !== dayKey(prev.createdAt);
        const isMine = currentUserId && m.user.id === currentUserId;
        const isCopied = copiedId === m.id;

        return (
          <Fragment key={m.id}>
            {newDay && (
              <div style={daySeparator} role="separator">
                <span style={dayLine} aria-hidden />
                <span>{formatDay(m.createdAt)}</span>
                <span style={dayLine} aria-hidden />
              </div>
            )}
            <article
              style={{
                ...(grouped && !newDay ? rowGrouped : rowBase),
                opacity: m.pending ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ec-surface-1)";
                const time = e.currentTarget.querySelector<HTMLElement>("[data-sticky-time]");
                if (time) time.style.opacity = "1";
                const bar = e.currentTarget.querySelector<HTMLElement>("[data-actions]");
                if (bar) {
                  bar.style.opacity = "1";
                  bar.style.pointerEvents = "auto";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                const time = e.currentTarget.querySelector<HTMLElement>("[data-sticky-time]");
                if (time) time.style.opacity = "0";
                const bar = e.currentTarget.querySelector<HTMLElement>("[data-actions]");
                if (bar) {
                  bar.style.opacity = "0";
                  bar.style.pointerEvents = "none";
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                {grouped && !newDay ? (
                  <span data-sticky-time style={stickyTime}>
                    {formatTime(m.createdAt)}
                  </span>
                ) : (
                  <Avatar url={m.user.avatar} name={m.user.displayName} size={36} />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                {(!grouped || newDay) && (
                  <header style={{ display: "flex", alignItems: "baseline", gap: "var(--ec-space-2)", marginBottom: 2 }}>
                    <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-base)", fontWeight: 600 }}>
                      {m.user.displayName}
                    </strong>
                    <time
                      dateTime={m.createdAt}
                      style={{
                        fontFamily: "var(--ec-font-mono)",
                        fontSize: "var(--ec-text-2xs)",
                        color: "var(--ec-text-dim)",
                      }}
                    >
                      {formatTime(m.createdAt)}
                    </time>
                    {m.pending && (
                      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>отправляется…</span>
                    )}
                    {m.failed && (
                      <span style={failedTag}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Ошибка
                      </span>
                    )}
                  </header>
                )}
                <p
                  style={{
                    margin: 0,
                    color: "var(--ec-text)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: "var(--ec-text-base)",
                    lineHeight: "var(--ec-leading-normal)",
                  }}
                >
                  {m.content}
                </p>
                {m.failed && onRetry && (
                  <button
                    type="button"
                    onClick={() => void onRetry(m.id)}
                    className="ec-btn ec-btn--sm"
                    style={{ marginTop: 4, color: "var(--ec-danger)", borderColor: "var(--ec-danger)" }}
                  >
                    Повторить
                  </button>
                )}
              </div>
              {!m.pending && !m.failed && (
                <div data-actions style={actionsBar}>
                  <button
                    type="button"
                    style={actionBtn}
                    aria-label="Копировать сообщение"
                    title={isCopied ? "Скопировано" : "Копировать"}
                    onClick={() => void handleCopy(m)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--ec-surface-3)";
                      e.currentTarget.style.color = "var(--ec-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--ec-text-muted)";
                    }}
                  >
                    {isCopied ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ec-ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    )}
                  </button>
                  {isMine && (
                    <span
                      style={{
                        ...actionBtn,
                        width: 26,
                        cursor: "default",
                        fontSize: "0.62rem",
                        letterSpacing: "var(--ec-tracking-caps)",
                        color: "var(--ec-text-dim)",
                      }}
                      aria-hidden
                      title="Это ваше сообщение"
                    >
                      ВЫ
                    </span>
                  )}
                </div>
              )}
            </article>
          </Fragment>
        );
      })}
    </div>
  );
}
