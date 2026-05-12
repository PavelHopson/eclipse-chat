import type { CSSProperties } from "react";
import { Fragment, useEffect, useRef } from "react";
import { Avatar } from "./Avatar";
import type { MessageRow } from "../hooks/useMessages";

type Props = {
  messages: MessageRow[];
  emptyHint?: string;
  channelName?: string | null;
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
  display: "grid",
  gridTemplateColumns: "44px 1fr auto",
  columnGap: "var(--ec-space-3)",
  padding: "var(--ec-space-2) var(--ec-space-2)",
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
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function MessageList({ messages, emptyHint, channelName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

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
            {channelName ? <>Начните разговор в <span style={{ color: "var(--ec-accent)" }}>#{channelName}</span></> : "Сообщений пока нет"}
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
              className="ec-message"
              style={grouped && !newDay ? rowGrouped : rowBase}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ec-surface-1)";
                const time = e.currentTarget.querySelector<HTMLElement>("[data-sticky-time]");
                if (time) time.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                const time = e.currentTarget.querySelector<HTMLElement>("[data-sticky-time]");
                if (time) time.style.opacity = "0";
              }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                {grouped && !newDay ? (
                  <span data-sticky-time style={stickyTime}>{formatTime(m.createdAt)}</span>
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
              </div>
              <div />
            </article>
          </Fragment>
        );
      })}
    </div>
  );
}
