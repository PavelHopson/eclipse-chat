import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { Avatar } from "./Avatar";
import {
  useActionItem,
  type ActionItemActivityType,
  type ActionItemComment,
  type ActionItemActivity,
} from "../hooks/useActionItem";
import type { ActionItemPriority } from "../lib/socket";

/**
 * ActionItemDrawer — first-class detail для task / decision / follow-up
 * (v0.54). Right-side floating panel поверх chat-shell'а; не ломает layout
 * (не использует grid-column как IntelligencePanel — full overlay через
 * fixed positioning).
 *
 * Содержимое:
 *   - Header: type-icon, title (inline edit), status toggle, close.
 *   - Properties row: priority / assignee / dueAt — inline editors.
 *   - Description (markdown textarea), сохраняется по blur.
 *   - Comments thread: список + composer внизу.
 *   - Activity log (collapsed section).
 *
 * Permissions: любой member server'а может update + комментировать. Delete
 * comment'а — только автор. Delete всего ActionItem не реализован в v1
 * (требует отдельного route + confirmation; сейчас удаление через
 * delete source-message также удалит item через cascade).
 */

type Props = {
  actionItemId: string;
  socket: Socket | null;
  currentUserId: string;
  /** Member list активного сервера — для assignee picker. */
  members: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  /** Резолв channel name по id (для строки источника). */
  channelNameById: (channelId: string) => string | null;
  onClose: () => void;
  /** Optional: jump к source message в основном чате. */
  onJumpToSource?: (channelId: string, messageId: string) => void;
};

/* ===== Styles ============================================== */

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.45)",
  backdropFilter: "saturate(140%) blur(6px)",
  WebkitBackdropFilter: "saturate(140%) blur(6px)",
  zIndex: 200,
  animation: "ec-fade-in var(--ec-dur-base) var(--ec-ease) both",
};

const drawer: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(460px, 100vw)",
  background: "var(--ec-surface-1)",
  borderLeft: "1px solid var(--ec-border-subtle)",
  boxShadow: "var(--ec-shadow-lg, 0 30px 80px -20px rgba(0,0,0,0.55))",
  display: "flex",
  flexDirection: "column",
  zIndex: 201,
  animation: "ec-slide-in-right var(--ec-dur-base) var(--ec-ease-out) both",
};

const headerStyle: CSSProperties = {
  padding: "var(--ec-space-3) var(--ec-space-4)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-4)",
};

const sectionLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
  margin: "0 0 var(--ec-space-2)",
};

const propRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px 1fr",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-1) 0",
  fontSize: "var(--ec-text-sm)",
};

const propLabel: CSSProperties = {
  color: "var(--ec-text-dim)",
  fontSize: "var(--ec-text-2xs)",
  textTransform: "uppercase",
  letterSpacing: "var(--ec-tracking-wide)",
};

const inlineInput: CSSProperties = {
  width: "100%",
  background: "var(--ec-input-bg)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text)",
  padding: "0.35rem 0.55rem",
  fontSize: "var(--ec-text-sm)",
  outline: "none",
};

const titleInput: CSSProperties = {
  ...inlineInput,
  fontSize: "var(--ec-text-lg)",
  fontWeight: 600,
  padding: "0.45rem 0.6rem",
};

const dueInput: CSSProperties = {
  ...inlineInput,
  fontFamily: "var(--ec-font-mono)",
  fontSize: "var(--ec-text-xs)",
};

const descTextarea: CSSProperties = {
  ...inlineInput,
  minHeight: 100,
  resize: "vertical",
  fontFamily: "inherit",
  lineHeight: "var(--ec-leading-relaxed)",
};

const closeBtn: CSSProperties = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  border: 0,
  background: "transparent",
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text-muted)",
  cursor: "pointer",
};

const statusToggle = (done: boolean): CSSProperties => ({
  padding: "0.4rem 0.8rem",
  borderRadius: "var(--ec-radius-full)",
  background: done ? "var(--ec-status-exec)" : "transparent",
  color: done ? "var(--ec-accent-text, #fff)" : "var(--ec-text)",
  border: `1px solid ${done ? "var(--ec-status-exec)" : "var(--ec-border-default)"}`,
  fontSize: "var(--ec-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--ec-tracking-wide)",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const composerWrap: CSSProperties = {
  borderTop: "1px solid var(--ec-border-subtle)",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  background: "var(--ec-surface-1)",
};

const composerInput: CSSProperties = {
  ...inlineInput,
  minHeight: 36,
  resize: "vertical",
  paddingRight: 80,
};

const sendBtn: CSSProperties = {
  padding: "0.5rem 0.95rem",
  background: "var(--ec-accent)",
  color: "var(--ec-accent-text, #fff)",
  border: "1px solid var(--ec-accent)",
  borderRadius: "var(--ec-radius-sm)",
  fontSize: "var(--ec-text-sm)",
  fontWeight: 600,
  cursor: "pointer",
};

const TYPE_META: Record<
  "TASK" | "DECISION" | "FOLLOW_UP",
  { label: string; color: string; glyph: string }
> = {
  TASK: { label: "Задача", color: "var(--ec-status-exec)", glyph: "▣" },
  DECISION: { label: "Решение", color: "var(--ec-accent)", glyph: "◆" },
  FOLLOW_UP: { label: "Follow-up", color: "var(--ec-status-warn)", glyph: "○" },
};

const PRIORITY_META: Record<
  ActionItemPriority,
  { label: string; color: string }
> = {
  LOW:    { label: "Low",     color: "var(--ec-status-idle)" },
  NORMAL: { label: "Normal",  color: "var(--ec-text-muted)" },
  HIGH:   { label: "High",    color: "var(--ec-status-warn)" },
  URGENT: { label: "Urgent",  color: "var(--ec-status-risk, var(--ec-danger))" },
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60_000);
  if (diffMin < 1) return "сейчас";
  if (diffMin < 60) return `${diffMin}м`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}ч`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}д`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatActivity(a: ActionItemActivity): string {
  const author = a.user?.displayName ?? "Система";
  const t: ActionItemActivityType = a.type;
  const data = a.payload ? safeParse(a.payload) : {};
  switch (t) {
    case "CREATED":
      return `${author} создал`;
    case "STATUS_CHANGED":
      return `${author}: статус ${data.from} → ${data.to}`;
    case "ASSIGNEE_CHANGED":
      return `${author}: сменил ответственного`;
    case "DUE_CHANGED":
      return `${author}: сменил срок`;
    case "PRIORITY_CHANGED":
      return `${author}: приоритет ${data.from} → ${data.to}`;
    case "TITLE_CHANGED":
      return `${author}: переименовал`;
    case "DESCRIPTION_CHANGED":
      return `${author}: ${data.hasValue ? (data.hadValue ? "обновил описание" : "добавил описание") : "удалил описание"}`;
    case "COMMENT_ADDED":
      return `${author}: оставил комментарий`;
    case "COMMENT_DELETED":
      return `${author}: удалил комментарий`;
    default:
      return author;
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* ===== Component =========================================== */

export function ActionItemDrawer({
  actionItemId,
  socket,
  currentUserId,
  members,
  channelNameById,
  onClose,
  onJumpToSource,
}: Props) {
  const { detail, loading, error, update, addComment, removeComment } = useActionItem(
    actionItemId,
    socket,
  );

  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  // Sync drafts when detail loads / external update arrives.
  useEffect(() => {
    if (detail) {
      setTitleDraft(detail.title);
      setDescDraft(detail.description ?? "");
    }
  }, [detail?.id, detail?.updatedAt]);

  // Escape closes drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const typeMeta = detail ? TYPE_META[detail.type] : null;

  const dueValue = useMemo(() => {
    if (!detail?.dueAt) return "";
    // <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" without TZ.
    const d = new Date(detail.dueAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [detail?.dueAt]);

  if (!actionItemId) return null;

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || !detail || trimmed === detail.title) return;
    await update({ title: trimmed });
  };

  const saveDescription = async () => {
    if (!detail) return;
    const value = descDraft.trim() ? descDraft : null;
    if ((value ?? null) === (detail.description ?? null)) return;
    await update({ description: value });
  };

  const handleStatusToggle = async () => {
    if (!detail) return;
    await update({ status: detail.status === "DONE" ? "OPEN" : "DONE" });
  };

  const handleAssigneeChange = async (value: string) => {
    await update({ assigneeUserId: value === "" ? null : value });
  };

  const handlePriorityChange = async (value: ActionItemPriority) => {
    await update({ priority: value });
  };

  const handleDueChange = async (value: string) => {
    if (!value) {
      await update({ dueAt: null });
      return;
    }
    // datetime-local не имеет TZ — интерпретируем как локальное время.
    const local = new Date(value);
    if (Number.isNaN(local.getTime())) return;
    await update({ dueAt: local.toISOString() });
  };

  const submitComment = async () => {
    const value = commentDraft.trim();
    if (!value) return;
    setSubmittingComment(true);
    const ok = await addComment(value);
    setSubmittingComment(false);
    if (ok) setCommentDraft("");
  };

  return (
    <>
      <div style={backdrop} onClick={onClose} aria-hidden />
      <aside style={drawer} role="dialog" aria-label="Детали задачи">
        <header style={headerStyle}>
          {detail && typeMeta ? (
            <>
              <span
                aria-hidden
                style={{
                  width: 26,
                  height: 26,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "var(--ec-radius-sm)",
                  background: "var(--ec-surface-2)",
                  color: typeMeta.color,
                  fontFamily: "var(--ec-font-mono)",
                  fontSize: "var(--ec-text-sm)",
                }}
              >
                {typeMeta.glyph}
              </span>
              <span
                style={{
                  fontSize: "var(--ec-text-2xs)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--ec-tracking-caps)",
                  color: typeMeta.color,
                  fontWeight: 700,
                }}
              >
                {typeMeta.label}
              </span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={handleStatusToggle}
                style={statusToggle(detail.status === "DONE")}
              >
                {detail.status === "DONE" ? "✓ Выполнено" : "Открыто"}
              </button>
            </>
          ) : (
            <strong style={{ fontSize: "var(--ec-text-sm)", color: "var(--ec-text-muted)" }}>
              {loading ? "Загрузка…" : "Задача"}
            </strong>
          )}
          <button
            type="button"
            onClick={onClose}
            style={closeBtn}
            aria-label="Закрыть"
            title="Закрыть · Esc"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div style={bodyStyle}>
          {error && (
            <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>{error}</p>
          )}

          {detail && (
            <>
              {/* Title */}
              <section>
                <h3 style={sectionLabel}>Название</h3>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  style={titleInput}
                  maxLength={160}
                />
              </section>

              {/* Properties */}
              <section>
                <h3 style={sectionLabel}>Свойства</h3>
                <div style={propRow}>
                  <span style={propLabel}>Приоритет</span>
                  <select
                    value={detail.priority}
                    onChange={(e) => void handlePriorityChange(e.target.value as ActionItemPriority)}
                    style={{ ...inlineInput, color: PRIORITY_META[detail.priority].color, fontWeight: 600 }}
                  >
                    {(Object.keys(PRIORITY_META) as ActionItemPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={propRow}>
                  <span style={propLabel}>Ответственный</span>
                  <select
                    value={detail.assignee?.id ?? ""}
                    onChange={(e) => void handleAssigneeChange(e.target.value)}
                    style={inlineInput}
                  >
                    <option value="">— не назначен —</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.displayName}
                        {m.userId === currentUserId ? " (я)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={propRow}>
                  <span style={propLabel}>Срок</span>
                  <input
                    type="datetime-local"
                    value={dueValue}
                    onChange={(e) => void handleDueChange(e.target.value)}
                    style={dueInput}
                  />
                </div>
                <div style={propRow}>
                  <span style={propLabel}>Источник</span>
                  <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>#{channelNameById(detail.channelId) ?? "комната"}</span>
                    {onJumpToSource && (
                      <button
                        type="button"
                        onClick={() => onJumpToSource(detail.channelId, detail.sourceMessageId)}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--ec-border-subtle)",
                          borderRadius: "var(--ec-radius-xs)",
                          color: "var(--ec-accent)",
                          fontSize: "var(--ec-text-2xs)",
                          padding: "0.1rem 0.4rem",
                          cursor: "pointer",
                        }}
                        title="Открыть исходное сообщение"
                      >
                        к сообщению
                      </button>
                    )}
                  </span>
                </div>
                <div style={propRow}>
                  <span style={propLabel}>Автор</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--ec-text-xs)" }}>
                    <Avatar
                      url={detail.createdBy.avatar}
                      name={detail.createdBy.displayName}
                      size={18}
                    />
                    {detail.createdBy.displayName}
                    <span style={{ color: "var(--ec-text-dim)", marginLeft: 6 }}>
                      · {relativeTime(detail.createdAt)}
                    </span>
                  </span>
                </div>
              </section>

              {/* Description */}
              <section>
                <h3 style={sectionLabel}>Описание</h3>
                <textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onBlur={() => void saveDescription()}
                  placeholder="Детали, контекст, ссылки. Сохраняется автоматически."
                  style={descTextarea}
                  maxLength={4000}
                  rows={4}
                />
              </section>

              {/* Comments */}
              <section>
                <h3 style={sectionLabel}>Комментарии · {detail.comments.length}</h3>
                {detail.comments.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      color: "var(--ec-text-dim)",
                      fontSize: "var(--ec-text-sm)",
                    }}
                  >
                    Никто ещё ничего не написал.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
                    {detail.comments.map((c) => (
                      <CommentRow
                        key={c.id}
                        comment={c}
                        currentUserId={currentUserId}
                        onDelete={async () => void removeComment(c.id)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Activity */}
              <section>
                <button
                  type="button"
                  onClick={() => setShowActivity((v) => !v)}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--ec-text-muted)",
                    fontSize: "var(--ec-text-2xs)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--ec-tracking-caps)",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  aria-expanded={showActivity}
                >
                  <span>История · {detail.activities.length}</span>
                  <span aria-hidden style={{ fontSize: "0.7rem" }}>{showActivity ? "▲" : "▼"}</span>
                </button>
                {showActivity && detail.activities.length > 0 && (
                  <div
                    style={{
                      marginTop: "var(--ec-space-2)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {detail.activities.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          fontSize: "var(--ec-text-2xs)",
                          color: "var(--ec-text-muted)",
                          display: "flex",
                          gap: 6,
                          alignItems: "baseline",
                        }}
                      >
                        <span style={{ color: "var(--ec-text-dim)", minWidth: 36, fontFeatureSettings: '"tnum"' }}>
                          {relativeTime(a.createdAt)}
                        </span>
                        <span>{formatActivity(a)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Comment composer */}
        {detail && (
          <div style={composerWrap}>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              placeholder="Комментарий · Enter — отправить, Shift+Enter — перенос"
              style={composerInput}
              rows={2}
              maxLength={2000}
              disabled={submittingComment}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--ec-space-2)" }}>
              <button
                type="button"
                onClick={() => void submitComment()}
                disabled={submittingComment || !commentDraft.trim()}
                style={{
                  ...sendBtn,
                  opacity: !commentDraft.trim() || submittingComment ? 0.55 : 1,
                  cursor: !commentDraft.trim() || submittingComment ? "not-allowed" : "pointer",
                }}
              >
                {submittingComment ? "Отправляем…" : "Отправить"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function CommentRow({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: ActionItemComment;
  currentUserId: string;
  onDelete: () => Promise<void>;
}) {
  const isMine = comment.user.id === currentUserId;
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 8,
        padding: "var(--ec-space-2) var(--ec-space-3)",
        background: "var(--ec-surface-2)",
        borderRadius: "var(--ec-radius-md)",
        border: "1px solid var(--ec-border-subtle)",
        position: "relative",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Avatar url={comment.user.avatar} name={comment.user.displayName} size={28} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "baseline",
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: "var(--ec-text-sm)", fontWeight: 600, color: "var(--ec-text-strong)" }}>
            {comment.user.displayName}
          </span>
          <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
            {relativeTime(comment.createdAt)}
            {comment.editedAt ? " · ред." : ""}
          </span>
        </div>
        <div
          style={{
            fontSize: "var(--ec-text-sm)",
            color: "var(--ec-text)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {comment.content}
        </div>
      </div>
      {isMine && hover && (
        <button
          type="button"
          onClick={() => void onDelete()}
          title="Удалить комментарий"
          aria-label="Удалить комментарий"
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 22,
            height: 22,
            display: "grid",
            placeItems: "center",
            background: "var(--ec-surface-3)",
            border: 0,
            borderRadius: "var(--ec-radius-xs)",
            color: "var(--ec-text-dim)",
            cursor: "pointer",
            fontSize: "0.7rem",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
