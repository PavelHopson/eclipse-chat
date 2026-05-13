import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { RichContent } from "./RichContent";
import { useThread } from "../hooks/useThread";
import type { Socket } from "socket.io-client";
import type { PublicUser } from "../hooks/useAuth";

type Props = {
  rootId: string;
  socket: Socket | null;
  currentUser: PublicUser;
  /** Display name текущего user'а (для подсветки me-mentions). */
  currentUserName: string;
  currentUserAvatar: string | null;
  /** Display names known members активного сервера для @mention detection. */
  mentionNames?: string[];
  onClose: () => void;
};

const panel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--ec-surface-1)",
  borderLeft: "1px solid var(--ec-border-subtle)",
  height: "100%",
  minWidth: 0,
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-2)",
  padding: "0 var(--ec-space-4)",
  height: 48,
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-bg)",
};

const headerLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
};

const closeBtn: CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text-muted)",
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const content: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const rootCard: CSSProperties = {
  padding: "var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-accent)",
  borderRadius: "var(--ec-radius-md)",
  display: "grid",
  gridTemplateColumns: "36px 1fr",
  gap: "var(--ec-space-2)",
};

const separator: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  margin: "var(--ec-space-2) 0",
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
};

const sepLine: CSSProperties = {
  flex: 1,
  height: 1,
  background: "var(--ec-border-subtle)",
};

const replyRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px 1fr",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-1) 0",
};

const composer: CSSProperties = {
  padding: "var(--ec-space-3) var(--ec-space-4)",
  borderTop: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-bg)",
};

const composerBox: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "var(--ec-space-2)",
  alignItems: "end",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "var(--ec-input-bg)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  transition:
    "border-color var(--ec-dur-fast) var(--ec-ease), box-shadow var(--ec-dur-fast) var(--ec-ease)",
};

const composerBoxFocused: CSSProperties = {
  borderColor: "var(--ec-accent)",
  boxShadow: "0 0 0 3px var(--ec-accent-soft)",
};

const textareaStyle: CSSProperties = {
  display: "block",
  width: "100%",
  background: "transparent",
  border: 0,
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  lineHeight: "var(--ec-leading-normal)",
  fontFamily: "var(--ec-font-sans)",
  resize: "none",
  outline: "none",
  padding: "var(--ec-space-1) 0",
  maxHeight: 140,
};

const sendBtn: CSSProperties = {
  padding: "0.45rem 0.8rem",
  background: "var(--ec-accent)",
  color: "var(--ec-accent-text)",
  border: 0,
  borderRadius: "var(--ec-radius-md)",
  fontSize: "var(--ec-text-xs)",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function formatShortTime(iso: string): string {
  return iso.slice(11, 16);
}

function ReplyBadge({ isBot }: { isBot?: boolean }) {
  if (!isBot) return null;
  return (
    <span
      title="Сообщение от бота"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "0 0.4rem",
        background: "hsl(252 70% 70% / 0.14)",
        color: "hsl(252 80% 78%)",
        border: "1px solid hsl(252 70% 60% / 0.45)",
        borderRadius: "var(--ec-radius-full)",
        fontSize: "0.58rem",
        fontWeight: 700,
        letterSpacing: "var(--ec-tracking-caps)",
        textTransform: "uppercase",
        lineHeight: 1.4,
      }}
    >
      BOT
    </span>
  );
}

export function ThreadPanel({
  rootId,
  socket,
  currentUser,
  currentUserName,
  currentUserAvatar,
  mentionNames,
  onClose,
}: Props) {
  const { data, loading, error, sending, sendReply } = useThread(rootId, socket);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Autosize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // Auto-scroll to bottom on new reply
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isAtBottom) el.scrollTop = el.scrollHeight;
  }, [data?.replies.length]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    const ok = await sendReply(trimmed, {
      id: currentUser.id,
      displayName: currentUserName,
      avatar: currentUserAvatar,
    });
    if (ok) setDraft("");
    textareaRef.current?.focus();
  };

  const canSend = draft.trim().length > 0 && !sending;
  const boxStyle = focused ? { ...composerBox, ...composerBoxFocused } : composerBox;

  return (
    <aside className="ec-thread-panel" style={panel} aria-label="Thread panel">
      <header style={header}>
        <div style={headerLabel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          Тред
          {data && (
            <span style={{ color: "var(--ec-text-dim)", marginLeft: 4 }}>
              · {data.replies.length} {data.replies.length === 1 ? "ответ" : "ответов"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть тред"
          title="Закрыть (Esc)"
          style={closeBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--ec-surface-3)";
            e.currentTarget.style.color = "var(--ec-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--ec-text-muted)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div ref={scrollRef} style={content}>
        {loading && !data && (
          <div style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-3)" }}>
            Загружаем тред…
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "var(--ec-space-2) var(--ec-space-3)",
              background: "var(--ec-danger-soft)",
              color: "var(--ec-danger)",
              border: "1px solid var(--ec-danger)",
              borderRadius: "var(--ec-radius-md)",
              fontSize: "var(--ec-text-sm)",
            }}
          >
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Root message */}
            <div style={rootCard}>
              <Avatar
                url={data.root.user.avatar}
                name={data.root.user.displayName}
                size={36}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--ec-space-2)", marginBottom: 2, flexWrap: "wrap" }}>
                  <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)", fontWeight: 600 }}>
                    {data.root.user.displayName}
                  </strong>
                  <ReplyBadge isBot={data.root.user.isBot} />
                  <time
                    dateTime={data.root.createdAt}
                    style={{
                      fontFamily: "var(--ec-font-mono)",
                      fontSize: "var(--ec-text-2xs)",
                      color: "var(--ec-text-dim)",
                    }}
                  >
                    {formatShortTime(data.root.createdAt)}
                  </time>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "var(--ec-text)",
                    fontSize: "var(--ec-text-sm)",
                    lineHeight: "var(--ec-leading-normal)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {data.root.deletedAt ? (
                    <em style={{ color: "var(--ec-text-dim)" }}>сообщение удалено</em>
                  ) : (
                    <RichContent
                      content={data.root.content}
                      mentionNames={mentionNames}
                      currentUserName={currentUserName}
                    />
                  )}
                </p>
              </div>
            </div>

            <div style={separator} role="separator">
              <span style={sepLine} aria-hidden />
              <span>
                {data.replies.length === 0
                  ? "Будь первым в треде"
                  : `${data.replies.length} ${data.replies.length === 1 ? "ответ" : "ответов"}`}
              </span>
              <span style={sepLine} aria-hidden />
            </div>

            {data.replies.map((r) => (
              <article key={r.id} style={replyRow} className={r.pending ? "ec-thread-reply ec-thread-reply--pending" : "ec-thread-reply"}>
                <Avatar url={r.user.avatar} name={r.user.displayName} size={32} />
                <div style={{ minWidth: 0 }}>
                  <header style={{ display: "flex", alignItems: "baseline", gap: "var(--ec-space-2)", marginBottom: 2, flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)", fontWeight: 600 }}>
                      {r.user.displayName}
                    </strong>
                    <ReplyBadge isBot={r.user.isBot} />
                    <time
                      dateTime={r.createdAt}
                      style={{ fontFamily: "var(--ec-font-mono)", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}
                    >
                      {formatShortTime(r.createdAt)}
                    </time>
                    {r.pending && (
                      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                        отправляется…
                      </span>
                    )}
                    {r.failed && (
                      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-danger)" }}>
                        ошибка
                      </span>
                    )}
                  </header>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--ec-text)",
                      fontSize: "var(--ec-text-sm)",
                      lineHeight: "var(--ec-leading-normal)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      opacity: r.pending ? 0.6 : 1,
                    }}
                  >
                    {r.deletedAt ? (
                      <em style={{ color: "var(--ec-text-dim)" }}>удалено</em>
                    ) : (
                      <RichContent
                        content={r.content}
                        mentionNames={mentionNames}
                        currentUserName={currentUserName}
                      />
                    )}
                  </p>
                </div>
              </article>
            ))}
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={composer}
      >
        <div style={boxStyle}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ответить в треде"
            style={textareaStyle}
            aria-label="Ответ в треде"
          />
          <button
            type="submit"
            disabled={!canSend}
            style={{
              ...sendBtn,
              opacity: canSend ? 1 : 0.4,
              cursor: canSend ? "pointer" : "default",
            }}
            title="Отправить (Enter)"
          >
            {sending ? "…" : "Ответить"}
          </button>
        </div>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-dim)",
            paddingLeft: "var(--ec-space-2)",
          }}
        >
          Enter — отправить · Shift+Enter — новая строка · Esc — закрыть тред
        </p>
      </form>
    </aside>
  );
}
