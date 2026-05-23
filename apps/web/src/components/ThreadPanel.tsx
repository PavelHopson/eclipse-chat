import { useEffect, useRef } from "react";
import { Attachments } from "./Attachments";
import { Avatar } from "./Avatar";
import { MessageInput } from "./MessageInput";
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
  /** v1.2.22 — custom-emoji map активного сервера (shortcode → URL). */
  customEmojis?: Record<string, string>;
  onClose: () => void;
};

// v1.1.93 slice 4: inline-style консоли ThreadPanel вынесены в классы
// .ec-thread* (components.css). JS-hover убран.

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
  socket: _socket,
  currentUser,
  currentUserName,
  currentUserAvatar,
  mentionNames,
  customEmojis,
  onClose,
}: Props) {
  const { data, loading, error, sendReply } = useThread(rootId, _socket);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new reply
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isAtBottom) el.scrollTop = el.scrollHeight;
  }, [data?.replies.length]);

  // ESC to close — но НЕ если фокус в input/textarea (Esc dismisses autocomplete)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="ec-thread-panel" aria-label="Thread panel">
      <header className="ec-server-header-edge ec-thread__header">
        <div className="ec-thread__label">
          <svg className="ec-thread__label-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          ТРЕД_ОБСУЖДЕНИЯ
          {data && <span className="ec-thread__count">{data.replies.length}</span>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть тред"
          title="Закрыть (Esc)"
          className="ec-icon-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div ref={scrollRef} className="ec-thread__content">
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
            <div className="ec-thread__root">
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
                      customEmojis={customEmojis}
                    />
                  )}
                </p>
              </div>
            </div>

            <div className="ec-thread__sep" role="separator">
              <span className="ec-thread__sep-line" aria-hidden />
              <span>
                {data.replies.length === 0
                  ? "Будь первым в треде"
                  : `${data.replies.length} ${data.replies.length === 1 ? "ответ" : "ответов"}`}
              </span>
              <span className="ec-thread__sep-line" aria-hidden />
            </div>

            {data.replies.filter((r) => r.deletedAt == null).map((r) => (
              <article key={r.id} className={r.pending ? "ec-thread-reply ec-thread-reply--pending" : "ec-thread-reply"}>
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
                        customEmojis={customEmojis}
                      />
                    )}
                  </p>
                  {!r.deletedAt && r.attachments.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <Attachments attachments={r.attachments} />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </>
        )}
      </div>

      <MessageInput
        channelName={data?.root.user.displayName ?? null}
        placeholder="Ответить в треде"
        draftKey={`thread:${rootId}`}
        mentionNames={mentionNames}
        onSend={(content, attachments) =>
          sendReply(
            content,
            {
              id: currentUser.id,
              displayName: currentUserName,
              avatar: currentUserAvatar,
            },
            attachments,
          )
        }
        onTypingStart={() => undefined}
        onTypingStop={() => undefined}
      />
    </aside>
  );
}
