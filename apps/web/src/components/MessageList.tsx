import type { CSSProperties } from "react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { EmojiPicker } from "./EmojiPicker";
import type { MessageRow } from "../hooks/useMessages";
import type { MemberRole } from "../hooks/useMembers";

type Props = {
  messages: MessageRow[];
  emptyHint?: string;
  channelName?: string | null;
  currentUserId?: string;
  currentRole?: MemberRole | null;
  onRetry?: (messageId: string) => Promise<boolean>;
  onEdit?: (messageId: string, content: string) => Promise<boolean>;
  onDelete?: (messageId: string) => Promise<boolean>;
  onPin?: (messageId: string) => Promise<boolean>;
  onUnpin?: (messageId: string) => Promise<boolean>;
  onToggleReaction?: (messageId: string, emoji: string) => Promise<boolean>;
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
  paddingRight: 12,
  borderRadius: "var(--ec-radius-md)",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const rowGrouped: CSSProperties = {
  ...rowBase,
  paddingTop: 2,
  paddingBottom: 2,
};

const rowPinned: CSSProperties = {
  ...rowBase,
  background: "hsl(40 70% 60% / 0.06)",
  borderLeft: "2px solid var(--ec-warn)",
  paddingLeft: 6,
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
  top: -10,
  right: 12,
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
  zIndex: 2,
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

const editAreaWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 4,
};

const editTextarea: CSSProperties = {
  width: "100%",
  minHeight: 60,
  padding: "0.5rem 0.6rem",
  background: "var(--ec-input-bg)",
  color: "var(--ec-text)",
  border: "1px solid var(--ec-accent)",
  boxShadow: "0 0 0 3px var(--ec-accent-soft)",
  borderRadius: "var(--ec-radius-md)",
  fontSize: "var(--ec-text-base)",
  lineHeight: "var(--ec-leading-normal)",
  fontFamily: "var(--ec-font-sans)",
  resize: "vertical",
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

function canModerate(role: MemberRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

export function MessageList({
  messages,
  emptyHint,
  channelName,
  currentUserId,
  currentRole,
  onRetry,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onToggleReaction,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pickerFor, setPickerFor] = useState<{ messageId: string; rect: DOMRect } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isAtBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleCopy = async (m: MessageRow) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1400);
    } catch {
      /* fail silently */
    }
  };

  const beginEdit = (m: MessageRow) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const commitEdit = async (m: MessageRow) => {
    if (!onEdit) return;
    const trimmed = editDraft.trim();
    if (trimmed === "" || trimmed === m.content) {
      cancelEdit();
      return;
    }
    const ok = await onEdit(m.id, trimmed);
    if (ok) cancelEdit();
  };

  const handleDelete = async (m: MessageRow) => {
    if (!onDelete) return;
    if (!window.confirm("Удалить сообщение?")) return;
    await onDelete(m.id);
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

  const canMod = canModerate(currentRole);

  return (
    <div ref={containerRef} style={wrap}>
      {pickerFor && onToggleReaction && (
        <EmojiPicker
          anchorRect={pickerFor.rect}
          onPick={(emoji) => {
            void onToggleReaction(pickerFor.messageId, emoji);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
      {messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const sameAuthor = prev?.user.id === m.user.id;
        const closeInTime =
          prev != null && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
        const grouped = Boolean(sameAuthor && closeInTime);
        const newDay = !prev || dayKey(m.createdAt) !== dayKey(prev.createdAt);
        const isMine = currentUserId && m.user.id === currentUserId;
        const isCopied = copiedId === m.id;
        const isEditing = editingId === m.id;
        const isDeleted = m.deletedAt != null;
        const isPinned = m.pinnedAt != null;

        // Right action visibility:
        //  copy   — always (if не deleted/pending/failed)
        //  edit   — only own + not deleted + not pending/failed
        //  delete — own OR moderator + not deleted + not pending/failed
        //  pin    — moderator only + not deleted
        //  unpin  — moderator only + pinned + not deleted
        const showActions = !m.pending && !m.failed && !isDeleted && !isEditing;
        const showEdit = showActions && Boolean(isMine && onEdit);
        const showDelete = showActions && Boolean((isMine || canMod) && onDelete);
        const showPin = showActions && Boolean(canMod && onPin && !isPinned);
        const showUnpin = showActions && Boolean(canMod && onUnpin && isPinned);

        const rowStyle = isPinned ? rowPinned : grouped && !newDay ? rowGrouped : rowBase;

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
              style={{ ...rowStyle, opacity: m.pending ? 0.6 : 1 }}
              onMouseEnter={(e) => {
                if (!isPinned) e.currentTarget.style.background = "var(--ec-surface-1)";
                const time = e.currentTarget.querySelector<HTMLElement>("[data-sticky-time]");
                if (time) time.style.opacity = "1";
                const bar = e.currentTarget.querySelector<HTMLElement>("[data-actions]");
                if (bar) {
                  bar.style.opacity = "1";
                  bar.style.pointerEvents = "auto";
                }
              }}
              onMouseLeave={(e) => {
                if (!isPinned) e.currentTarget.style.background = "transparent";
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
                {grouped && !newDay && !isPinned ? (
                  <span data-sticky-time style={stickyTime}>
                    {formatTime(m.createdAt)}
                  </span>
                ) : (
                  <Avatar url={m.user.avatar} name={m.user.displayName} size={36} />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                {(!grouped || newDay || isPinned) && (
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
                    {isPinned && (
                      <span
                        title="Закреплено"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          color: "var(--ec-warn)",
                          fontSize: "var(--ec-text-2xs)",
                          fontWeight: 600,
                          letterSpacing: "var(--ec-tracking-wide)",
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <line x1="12" y1="17" x2="12" y2="22" />
                          <path d="M5 17h14V5l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
                        </svg>
                        ЗАКРЕПЛЕНО
                      </span>
                    )}
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
                {isEditing ? (
                  <div style={editAreaWrap}>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      autoFocus
                      style={editTextarea}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void commitEdit(m);
                        } else if (e.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={() => void commitEdit(m)}>
                        Сохранить
                      </button>
                      <button type="button" className="ec-btn ec-btn--sm" onClick={cancelEdit}>
                        Отмена
                      </button>
                      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                        Enter — сохранить · Esc — отмена
                      </span>
                    </div>
                  </div>
                ) : isDeleted ? (
                  <p
                    style={{
                      margin: 0,
                      color: "var(--ec-text-dim)",
                      fontStyle: "italic",
                      fontSize: "var(--ec-text-base)",
                    }}
                  >
                    сообщение удалено
                  </p>
                ) : (
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
                    {m.editedAt && (
                      <span
                        title={`Изменено ${new Date(m.editedAt).toLocaleString("ru-RU")}`}
                        style={{
                          marginLeft: 6,
                          fontSize: "var(--ec-text-2xs)",
                          color: "var(--ec-text-dim)",
                        }}
                      >
                        (изменено)
                      </span>
                    )}
                  </p>
                )}
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
                {!isDeleted && !isEditing && m.reactions.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {m.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        className="ec-anim-reaction-pop"
                        onClick={() => void onToggleReaction?.(m.id, r.emoji)}
                        title={r.mine ? "Снять реакцию" : "Поддержать"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "1px 7px 1px 5px",
                          background: r.mine ? "var(--ec-accent-soft)" : "var(--ec-surface-2)",
                          border: r.mine ? "1px solid var(--ec-border-accent)" : "1px solid var(--ec-border-subtle)",
                          borderRadius: "var(--ec-radius-full)",
                          color: r.mine ? "var(--ec-accent)" : "var(--ec-text-muted)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          lineHeight: 1.4,
                          transition: "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease), transform var(--ec-dur-fast) var(--ec-ease)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <span aria-hidden style={{ fontSize: "0.95rem" }}>{r.emoji}</span>
                        <span style={{ fontWeight: 600, fontFeatureSettings: '"tnum"' }}>{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {showActions && (
                <div data-actions style={actionsBar}>
                  {onToggleReaction && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Добавить реакцию"
                      title="Реакция"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPickerFor({ messageId: m.id, rect });
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-text)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    style={actionBtn}
                    aria-label="Копировать"
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
                  {showEdit && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Редактировать"
                      title="Редактировать"
                      onClick={() => beginEdit(m)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-text)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  {showUnpin && (
                    <button
                      type="button"
                      style={{ ...actionBtn, color: "var(--ec-warn)" }}
                      aria-label="Открепить"
                      title="Открепить"
                      onClick={() => void onUnpin?.(m.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "hsl(40 70% 60% / 0.14)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="2" y1="2" x2="22" y2="22" />
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14V5l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
                      </svg>
                    </button>
                  )}
                  {showPin && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Закрепить"
                      title="Закрепить"
                      onClick={() => void onPin?.(m.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-warn)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14V5l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
                      </svg>
                    </button>
                  )}
                  {showDelete && (
                    <button
                      type="button"
                      style={{ ...actionBtn, color: "var(--ec-danger)" }}
                      aria-label="Удалить"
                      title="Удалить"
                      onClick={() => void handleDelete(m)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-danger-soft)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
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
