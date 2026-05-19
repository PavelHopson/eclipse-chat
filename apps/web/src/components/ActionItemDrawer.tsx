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
import type {
  ActionItemPayload,
  ActionItemPriority,
  ActionItemDependencyRef,
} from "../lib/socket";

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
  /** v0.73 #20 phase 2: список ActionItem'ов активного сервера для
   *  dependency picker. Optional — если не передан, секция «Зависимости»
   *  работает в read-only режиме (без add). */
  serverActions?: ActionItemPayload[];
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
  // v1.1.11: position:relative для .ec-server-header-edge::after
  position: "relative",
  background: "hsl(210 25% 4% / 0.55)",
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
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
  margin: "0 0 var(--ec-space-2)",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
  display: "flex",
  alignItems: "center",
  gap: 8,
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

// v0.71: legacy binary statusToggle убран — теперь 4-status native select
// в headerStyle. handleStatusToggle тоже больше не нужен.

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
    case "APPROVAL_REQUESTED":
      return `${author}: запросил одобрение`;
    case "APPROVAL_APPROVED":
      return `${author}: одобрил`;
    case "APPROVAL_REJECTED":
      return `${author}: отклонил`;
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
  serverActions,
}: Props) {
  const {
    detail,
    loading,
    error,
    update,
    addComment,
    removeComment,
    requestApproval,
    decideApproval,
    addDependency,
    removeDependency,
    generateAiSummary,
  } = useActionItem(actionItemId, socket);

  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  // Approval section state.
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalApproverId, setApprovalApproverId] = useState<string>("");
  const [approvalNote, setApprovalNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);
  // v0.73 #20 phase 2: dependency picker state.
  const [depPickerOpen, setDepPickerOpen] = useState(false);
  const [depQuery, setDepQuery] = useState("");
  const [depError, setDepError] = useState<string | null>(null);
  const [submittingDep, setSubmittingDep] = useState(false);
  // v0.73 #20 phase 4: AI summary state.
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Sync drafts when detail loads / external update arrives.
  useEffect(() => {
    if (detail) {
      setTitleDraft(detail.title);
      setDescDraft(detail.description ?? "");
    }
  }, [detail?.id, detail?.updatedAt]);

  // Escape closes drawer + body scroll-lock пока drawer открыт.
  // v0.65: на mobile drawer fullscreen, background scroll'ил под backdrop.
  useEffect(() => {
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

  const submitApprovalRequest = async () => {
    if (!approvalApproverId) return;
    setSubmittingApproval(true);
    const ok = await requestApproval(approvalApproverId, approvalNote.trim() || undefined);
    setSubmittingApproval(false);
    if (ok) {
      setShowApprovalForm(false);
      setApprovalNote("");
    }
  };

  const submitDecision = async (decision: "APPROVED" | "REJECTED") => {
    setSubmittingApproval(true);
    const ok = await decideApproval(decision, decisionNote.trim() || undefined);
    setSubmittingApproval(false);
    if (ok) setDecisionNote("");
  };

  return (
    <>
      <div style={backdrop} onClick={onClose} aria-hidden />
      <aside className="ec-action-drawer" style={drawer} role="dialog" aria-label="Детали задачи">
        <header className="ec-server-header-edge" style={headerStyle}>
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
              {/* v0.71: 4-status select вместо binary toggle. Native
                  <select> достаточно для inline-edit (drag-and-drop
                  доступен в StatusBoard). */}
              <select
                value={detail.status}
                onChange={(e) =>
                  void update({
                    status: e.target.value as "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE",
                  })
                }
                style={{
                  padding: "0.35rem 0.7rem",
                  borderRadius: "var(--ec-radius-full)",
                  border: `1px solid ${
                    detail.status === "DONE"
                      ? "var(--ec-status-exec)"
                      : detail.status === "REVIEW"
                      ? "var(--ec-status-ai, var(--ec-accent))"
                      : detail.status === "IN_PROGRESS"
                      ? "var(--ec-accent)"
                      : "var(--ec-border-default)"
                  }`,
                  background: detail.status === "DONE"
                    ? "var(--ec-status-exec)"
                    : "var(--ec-surface-2)",
                  color: detail.status === "DONE"
                    ? "var(--ec-accent-text, #fff)"
                    : "var(--ec-text)",
                  fontSize: "var(--ec-text-xs)",
                  fontWeight: 600,
                  letterSpacing: "var(--ec-tracking-wide)",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="OPEN">Открыто</option>
                <option value="IN_PROGRESS">В работе</option>
                <option value="REVIEW">На ревью</option>
                <option value="DONE">Выполнено</option>
              </select>
            </>
          ) : (
            <strong style={{ fontSize: "var(--ec-text-sm)", color: "var(--ec-text-muted)" }}>
              {loading ? "Загрузка…" : "Задача"}
            </strong>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ec-drawer-close"
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
                <h3 style={sectionLabel}><span aria-hidden style={{ color: "var(--ec-accent)" }}>◆</span>Название</h3>
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
                <h3 style={sectionLabel}><span aria-hidden style={{ color: "var(--ec-accent)" }}>◆</span>Свойства</h3>
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

              {/* Approval */}
              <section>
                <h3 style={sectionLabel}><span aria-hidden style={{ color: "var(--ec-status-warn)" }}>◆</span>Одобрение</h3>
                <ApprovalSection
                  status={detail.approvalStatus}
                  approver={detail.approver}
                  approvalNote={detail.approvalNote}
                  approvedAt={detail.approvedAt}
                  currentUserId={currentUserId}
                  members={members}
                  showForm={showApprovalForm}
                  setShowForm={setShowApprovalForm}
                  approverId={approvalApproverId}
                  setApproverId={setApprovalApproverId}
                  noteDraft={approvalNote}
                  setNoteDraft={setApprovalNote}
                  decisionNote={decisionNote}
                  setDecisionNote={setDecisionNote}
                  submitting={submittingApproval}
                  onRequest={() => void submitApprovalRequest()}
                  onApprove={() => void submitDecision("APPROVED")}
                  onReject={() => void submitDecision("REJECTED")}
                />
              </section>

              {/* v0.73 #20 phase 2: Dependencies */}
              <section>
                <h3 style={sectionLabel}>
                  Зависимости
                  {detail.blockedByOpen > 0 ? (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: "var(--ec-warn-soft)",
                        color: "var(--ec-warn)",
                        fontSize: "0.7em",
                        letterSpacing: 0,
                        textTransform: "none",
                      }}
                    >
                      🚧 blocked by {detail.blockedByOpen}
                    </span>
                  ) : null}
                </h3>
                <DependencySection
                  dependencies={detail.dependencies}
                  blocks={detail.blocks}
                  serverActions={serverActions}
                  currentActionId={detail.id}
                  pickerOpen={depPickerOpen}
                  setPickerOpen={setDepPickerOpen}
                  query={depQuery}
                  setQuery={setDepQuery}
                  error={depError}
                  setError={setDepError}
                  submitting={submittingDep}
                  onAdd={async (blockerId) => {
                    setSubmittingDep(true);
                    setDepError(null);
                    const r = await addDependency(blockerId);
                    setSubmittingDep(false);
                    if (r.ok) {
                      setDepPickerOpen(false);
                      setDepQuery("");
                    } else {
                      setDepError(r.error);
                    }
                  }}
                  onRemove={async (blockerId) => {
                    setSubmittingDep(true);
                    await removeDependency(blockerId);
                    setSubmittingDep(false);
                  }}
                />
              </section>

              {/* Description */}
              <section>
                <h3 style={sectionLabel}><span aria-hidden style={{ color: "var(--ec-accent)" }}>◆</span>Описание</h3>
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

              {/* v0.73 #20 phase 4: AI summary */}
              <section>
                <h3 style={sectionLabel}>
                  AI-сводка
                  {detail.aiSummaryUpdatedAt && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "var(--ec-text-dim)",
                        fontSize: "0.7em",
                        letterSpacing: 0,
                        textTransform: "none",
                      }}
                    >
                      {relativeTime(detail.aiSummaryUpdatedAt)}
                    </span>
                  )}
                </h3>
                {detail.aiSummary ? (
                  <p
                    style={{
                      margin: 0,
                      padding: "var(--ec-space-3)",
                      borderRadius: "var(--ec-radius-md)",
                      background: "var(--ec-accent-soft)",
                      border: "1px solid var(--ec-border-accent)",
                      color: "var(--ec-text)",
                      fontSize: "var(--ec-text-sm)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {detail.aiSummary}
                  </p>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      color: "var(--ec-text-dim)",
                      fontSize: "var(--ec-text-sm)",
                    }}
                  >
                    Сводка ещё не сгенерирована.
                  </p>
                )}
                {aiError && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "var(--ec-danger)",
                      fontSize: "var(--ec-text-2xs)",
                    }}
                  >
                    {aiError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setAiLoading(true);
                    setAiError(null);
                    const r = await generateAiSummary();
                    setAiLoading(false);
                    if (!r.ok) setAiError(r.error);
                  }}
                  disabled={aiLoading}
                  className="ec-press"
                  style={{
                    marginTop: 6,
                    padding: "0.3rem 0.7rem",
                    borderRadius: "var(--ec-radius-md)",
                    background: "transparent",
                    border: "1px dashed var(--ec-border-default)",
                    color: aiLoading ? "var(--ec-text-dim)" : "var(--ec-text-muted)",
                    cursor: aiLoading ? "wait" : "pointer",
                    fontSize: "var(--ec-text-2xs)",
                    fontWeight: 600,
                    letterSpacing: "var(--ec-tracking-caps)",
                    textTransform: "uppercase",
                  }}
                >
                  {aiLoading
                    ? "Генерирую…"
                    : detail.aiSummary
                      ? "Перегенерировать"
                      : "Сгенерировать сводку"}
                </button>
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

type ApprovalSectionProps = {
  status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  approver: { id: string; displayName: string; avatar: string | null } | null;
  approvalNote: string | null;
  approvedAt: string | null;
  currentUserId: string;
  members: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  approverId: string;
  setApproverId: (v: string) => void;
  noteDraft: string;
  setNoteDraft: (v: string) => void;
  decisionNote: string;
  setDecisionNote: (v: string) => void;
  submitting: boolean;
  onRequest: () => void;
  onApprove: () => void;
  onReject: () => void;
};

function ApprovalSection({
  status,
  approver,
  approvalNote,
  approvedAt,
  currentUserId,
  members,
  showForm,
  setShowForm,
  approverId,
  setApproverId,
  noteDraft,
  setNoteDraft,
  decisionNote,
  setDecisionNote,
  submitting,
  onRequest,
  onApprove,
  onReject,
}: ApprovalSectionProps) {
  const eligible = members.filter((m) => m.userId !== currentUserId);
  const isApprover = approver?.id === currentUserId;

  const statusBadge = (label: string, color: string) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0.25rem 0.55rem",
        borderRadius: "var(--ec-radius-full)",
        background: "var(--ec-surface-2)",
        border: `1px solid ${color}`,
        color,
        fontSize: "var(--ec-text-2xs)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "var(--ec-tracking-caps)",
      }}
    >
      {label}
    </span>
  );

  if (status === "NONE") {
    return (
      <div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="ec-btn ec-btn--ghost ec-btn--sm"
            style={{
              border: "1px solid var(--ec-border-default)",
              padding: "0.4rem 0.75rem",
            }}
          >
            Запросить одобрение
          </button>
        ) : (
          <div
            style={{
              padding: "var(--ec-space-2) var(--ec-space-3)",
              background: "var(--ec-surface-2)",
              borderRadius: "var(--ec-radius-md)",
              border: "1px solid var(--ec-border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--ec-space-2)",
            }}
          >
            <label
              style={{
                fontSize: "var(--ec-text-2xs)",
                color: "var(--ec-text-dim)",
                textTransform: "uppercase",
                letterSpacing: "var(--ec-tracking-wide)",
              }}
            >
              Кто одобряет
            </label>
            <select
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              style={{ ...inlineInput }}
            >
              <option value="">— выбери участника —</option>
              {eligible.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.displayName}
                </option>
              ))}
            </select>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Комментарий для approver (необязательно)"
              style={{ ...inlineInput, minHeight: 50, resize: "vertical" }}
              maxLength={500}
              rows={2}
            />
            <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setNoteDraft("");
                }}
                disabled={submitting}
                style={{
                  background: "transparent",
                  border: "1px solid var(--ec-border-default)",
                  color: "var(--ec-text-muted)",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "var(--ec-radius-sm)",
                  fontSize: "var(--ec-text-sm)",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onRequest}
                disabled={submitting || !approverId}
                style={{
                  ...sendBtn,
                  opacity: !approverId || submitting ? 0.55 : 1,
                  cursor: !approverId || submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Отправляем…" : "Запросить"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div
        style={{
          padding: "var(--ec-space-3)",
          background: "var(--ec-surface-2)",
          borderRadius: "var(--ec-radius-md)",
          border: "1px solid var(--ec-status-warn)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--ec-space-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {statusBadge("Ожидает", "var(--ec-status-warn)")}
          <span style={{ fontSize: "var(--ec-text-sm)", color: "var(--ec-text)" }}>
            Решение от{" "}
            {approver ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Avatar url={approver.avatar} name={approver.displayName} size={16} />
                <strong style={{ color: "var(--ec-text-strong)" }}>{approver.displayName}</strong>
              </span>
            ) : (
              "неизвестно"
            )}
          </span>
        </div>
        {approvalNote && (
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-xs)",
              color: "var(--ec-text-muted)",
              fontStyle: "italic",
              whiteSpace: "pre-wrap",
            }}
          >
            Запрос: {approvalNote}
          </p>
        )}
        {isApprover && (
          <>
            <textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Причина / комментарий (особенно при отклонении)"
              style={{ ...inlineInput, minHeight: 50, resize: "vertical" }}
              maxLength={500}
              rows={2}
            />
            <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onReject}
                disabled={submitting}
                style={{
                  background: "transparent",
                  border: "1px solid var(--ec-danger)",
                  color: "var(--ec-danger)",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "var(--ec-radius-sm)",
                  fontSize: "var(--ec-text-sm)",
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Отклонить
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={submitting}
                style={{
                  background: "var(--ec-status-exec)",
                  color: "var(--ec-accent-text, #fff)",
                  border: "1px solid var(--ec-status-exec)",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "var(--ec-radius-sm)",
                  fontSize: "var(--ec-text-sm)",
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Одобрить
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // APPROVED / REJECTED — read-only display + re-request option.
  const isApproved = status === "APPROVED";
  return (
    <div
      style={{
        padding: "var(--ec-space-3)",
        background: "var(--ec-surface-2)",
        borderRadius: "var(--ec-radius-md)",
        border: `1px solid ${isApproved ? "var(--ec-status-exec)" : "var(--ec-danger)"}`,
        display: "flex",
        flexDirection: "column",
        gap: "var(--ec-space-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {statusBadge(
          isApproved ? "Одобрено" : "Отклонено",
          isApproved ? "var(--ec-status-exec)" : "var(--ec-danger)",
        )}
        {approver && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "var(--ec-text-xs)",
              color: "var(--ec-text-muted)",
            }}
          >
            <Avatar url={approver.avatar} name={approver.displayName} size={16} />
            {approver.displayName}
          </span>
        )}
        {approvedAt && (
          <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
            {relativeTime(approvedAt)}
          </span>
        )}
      </div>
      {approvalNote && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--ec-text-sm)",
            color: "var(--ec-text)",
            whiteSpace: "pre-wrap",
          }}
        >
          {approvalNote}
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowForm(true)}
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "1px solid var(--ec-border-default)",
          color: "var(--ec-text-muted)",
          padding: "0.3rem 0.6rem",
          borderRadius: "var(--ec-radius-sm)",
          fontSize: "var(--ec-text-2xs)",
          cursor: "pointer",
        }}
      >
        Запросить заново
      </button>
      {showForm && (
        <div
          style={{
            marginTop: "var(--ec-space-2)",
            padding: "var(--ec-space-2) var(--ec-space-3)",
            background: "var(--ec-surface-1)",
            borderRadius: "var(--ec-radius-md)",
            border: "1px solid var(--ec-border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ec-space-2)",
          }}
        >
          <select
            value={approverId}
            onChange={(e) => setApproverId(e.target.value)}
            style={{ ...inlineInput }}
          >
            <option value="">— выбери участника —</option>
            {eligible.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.displayName}
              </option>
            ))}
          </select>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Комментарий для approver (необязательно)"
            style={{ ...inlineInput, minHeight: 50, resize: "vertical" }}
            maxLength={500}
            rows={2}
          />
          <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNoteDraft("");
              }}
              disabled={submitting}
              style={{
                background: "transparent",
                border: "1px solid var(--ec-border-default)",
                color: "var(--ec-text-muted)",
                padding: "0.4rem 0.75rem",
                borderRadius: "var(--ec-radius-sm)",
                fontSize: "var(--ec-text-sm)",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={onRequest}
              disabled={submitting || !approverId}
              style={{
                ...sendBtn,
                opacity: !approverId || submitting ? 0.55 : 1,
                cursor: !approverId || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Отправляем…" : "Запросить"}
            </button>
          </div>
        </div>
      )}
    </div>
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

/* ============================================================
 * v0.73 #20 phase 2: Dependencies — задачи, от которых зависит
 * текущая (blockers), и задачи, которые она блокирует (blocks).
 * Picker лениво открывается, фильтрует по title (substring) и
 * исключает: саму задачу, уже добавленные blockers, и циклически
 * связанные (последнее проверяет backend и возвращает 409).
 * ============================================================ */

const DEP_STATUS_TONE: Record<
  "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE",
  { fg: string; bg: string; label: string }
> = {
  OPEN: { fg: "var(--ec-text)", bg: "var(--ec-surface-3)", label: "OPEN" },
  IN_PROGRESS: {
    fg: "var(--ec-accent)",
    bg: "var(--ec-accent-soft)",
    label: "В работе",
  },
  REVIEW: {
    fg: "var(--ec-ai, var(--ec-accent))",
    bg: "var(--ec-ai-soft, var(--ec-accent-soft))",
    label: "Review",
  },
  DONE: {
    fg: "var(--ec-exec, var(--ec-text-muted))",
    bg: "var(--ec-exec-soft, var(--ec-surface-3))",
    label: "Done",
  },
};

function depRowStyle(done: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "var(--ec-space-1) var(--ec-space-2)",
    borderRadius: "var(--ec-radius-md)",
    background: "var(--ec-surface-2)",
    border: "1px solid var(--ec-border-subtle)",
    opacity: done ? 0.7 : 1,
    fontSize: "var(--ec-text-sm)",
  };
}

/* ============================================================
 * v0.76 #20 phase 2: mini DAG visualization для зависимостей.
 *
 * Layered layout, 3 уровня:
 *   - row 0 (top): blockers (`dependencies` — то, что блокирует меня)
 *   - row 1 (mid): current task
 *   - row 2 (bot): tasks-я-блокирую (`blocks`)
 *
 * Compact: max 6 nodes per row (overflow → «+N» chip). Edges рисуются
 * от blocker.bottom → current.top и current.bottom → blocked.top.
 * SVG, без библиотек.
 * ============================================================ */

function truncateLabel(s: string, max = 18): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function dagNodeColors(
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE",
): { fill: string; stroke: string; text: string } {
  if (status === "DONE")
    return {
      fill: "var(--ec-exec-soft, var(--ec-surface-3))",
      stroke: "var(--ec-exec, var(--ec-text-dim))",
      text: "var(--ec-text-muted)",
    };
  if (status === "IN_PROGRESS")
    return {
      fill: "var(--ec-accent-soft)",
      stroke: "var(--ec-border-accent)",
      text: "var(--ec-text)",
    };
  if (status === "REVIEW")
    return {
      fill: "var(--ec-ai-soft, var(--ec-accent-soft))",
      stroke: "var(--ec-ai, var(--ec-accent))",
      text: "var(--ec-text)",
    };
  return {
    fill: "var(--ec-surface-2)",
    stroke: "var(--ec-border-default)",
    text: "var(--ec-text)",
  };
}

function DepDagViz({
  dependencies,
  blocks,
}: {
  dependencies: ActionItemDependencyRef[];
  blocks: ActionItemDependencyRef[];
}) {
  const MAX = 6;
  const visibleDeps = dependencies.slice(0, MAX);
  const moreDeps = dependencies.length - visibleDeps.length;
  const visibleBlocks = blocks.slice(0, MAX);
  const moreBlocks = blocks.length - visibleBlocks.length;

  // Геометрия: каждая node 96×26, gap 8, layered y-padding 14.
  const nodeW = 96;
  const nodeH = 26;
  const gapX = 10;
  const ySpace = 50;
  const padTop = 6;
  const padBottom = 6;
  const cols = Math.max(
    1,
    visibleDeps.length + (moreDeps > 0 ? 1 : 0),
    1,
    visibleBlocks.length + (moreBlocks > 0 ? 1 : 0),
  );
  const innerW = cols * nodeW + (cols - 1) * gapX;
  const w = innerW + 24;
  const h = padTop + nodeH + ySpace + nodeH + ySpace + nodeH + padBottom;

  // helper coordinates: layout центрирует ряд относительно средней оси.
  function rowCoords(count: number, idx: number): { x: number; y: number } {
    const rowWidth = count * nodeW + (count - 1) * gapX;
    const x = (w - rowWidth) / 2 + idx * (nodeW + gapX);
    return { x, y: 0 };
  }

  const depRowCount = visibleDeps.length + (moreDeps > 0 ? 1 : 0);
  const blockRowCount = visibleBlocks.length + (moreBlocks > 0 ? 1 : 0);
  const yDeps = padTop;
  const yMe = padTop + nodeH + ySpace;
  const yBlocks = padTop + nodeH + ySpace + nodeH + ySpace;
  const meX = (w - nodeW) / 2;

  return (
    <details
      style={{
        background: "var(--ec-surface-2)",
        border: "1px solid var(--ec-border-subtle)",
        borderRadius: "var(--ec-radius-md)",
        padding: "var(--ec-space-2) var(--ec-space-3)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          color: "var(--ec-text-muted)",
          fontSize: "var(--ec-text-2xs)",
          letterSpacing: "var(--ec-tracking-caps)",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Граф зависимостей · {dependencies.length} ← me → {blocks.length}
      </summary>
      <div style={{ marginTop: 8, overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
          aria-label="Граф зависимостей"
        >
          {/* Top row: blockers (dependencies) */}
          {visibleDeps.map((d, i) => {
            const { x } = rowCoords(depRowCount, i);
            const c = dagNodeColors(d.status);
            return (
              <g key={d.id}>
                <rect
                  x={x}
                  y={yDeps}
                  width={nodeW}
                  height={nodeH}
                  rx={6}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={1}
                />
                <text
                  x={x + nodeW / 2}
                  y={yDeps + nodeH / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill={c.text}
                  style={{ fontFamily: "var(--ec-font)" }}
                >
                  {truncateLabel(d.title)}
                </text>
                {/* arrow blocker→me */}
                <line
                  x1={x + nodeW / 2}
                  y1={yDeps + nodeH}
                  x2={meX + nodeW / 2}
                  y2={yMe}
                  stroke="var(--ec-border-default)"
                  strokeWidth={1.2}
                  markerEnd="url(#ec-dag-arrow)"
                />
              </g>
            );
          })}
          {moreDeps > 0 && (
            <g>
              <rect
                x={rowCoords(depRowCount, visibleDeps.length).x}
                y={yDeps}
                width={nodeW}
                height={nodeH}
                rx={6}
                fill="var(--ec-surface-3)"
                stroke="var(--ec-border-default)"
                strokeDasharray="3 3"
              />
              <text
                x={rowCoords(depRowCount, visibleDeps.length).x + nodeW / 2}
                y={yDeps + nodeH / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fill="var(--ec-text-muted)"
              >
                +{moreDeps} ещё
              </text>
            </g>
          )}

          {/* Middle: current task */}
          <rect
            x={meX}
            y={yMe}
            width={nodeW}
            height={nodeH}
            rx={6}
            fill="var(--ec-accent)"
            stroke="var(--ec-accent)"
            opacity={0.95}
          />
          <text
            x={meX + nodeW / 2}
            y={yMe + nodeH / 2 + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="var(--ec-accent-text, #fff)"
          >
            Эта задача
          </text>

          {/* Bottom row: blocks (исходящие edges) */}
          {visibleBlocks.map((b, i) => {
            const { x } = rowCoords(blockRowCount, i);
            const c = dagNodeColors(b.status);
            return (
              <g key={b.id}>
                <line
                  x1={meX + nodeW / 2}
                  y1={yMe + nodeH}
                  x2={x + nodeW / 2}
                  y2={yBlocks}
                  stroke="var(--ec-border-default)"
                  strokeWidth={1.2}
                  markerEnd="url(#ec-dag-arrow)"
                />
                <rect
                  x={x}
                  y={yBlocks}
                  width={nodeW}
                  height={nodeH}
                  rx={6}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={1}
                />
                <text
                  x={x + nodeW / 2}
                  y={yBlocks + nodeH / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill={c.text}
                  style={{ fontFamily: "var(--ec-font)" }}
                >
                  {truncateLabel(b.title)}
                </text>
              </g>
            );
          })}
          {moreBlocks > 0 && (
            <g>
              <line
                x1={meX + nodeW / 2}
                y1={yMe + nodeH}
                x2={
                  rowCoords(blockRowCount, visibleBlocks.length).x + nodeW / 2
                }
                y2={yBlocks}
                stroke="var(--ec-border-default)"
                strokeWidth={1.2}
                strokeDasharray="3 3"
              />
              <rect
                x={rowCoords(blockRowCount, visibleBlocks.length).x}
                y={yBlocks}
                width={nodeW}
                height={nodeH}
                rx={6}
                fill="var(--ec-surface-3)"
                stroke="var(--ec-border-default)"
                strokeDasharray="3 3"
              />
              <text
                x={
                  rowCoords(blockRowCount, visibleBlocks.length).x + nodeW / 2
                }
                y={yBlocks + nodeH / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fill="var(--ec-text-muted)"
              >
                +{moreBlocks} ещё
              </text>
            </g>
          )}

          <defs>
            <marker
              id="ec-dag-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill="var(--ec-border-default)"
              />
            </marker>
          </defs>
        </svg>
      </div>
    </details>
  );
}

function DependencySection({
  dependencies,
  blocks,
  serverActions,
  currentActionId,
  pickerOpen,
  setPickerOpen,
  query,
  setQuery,
  error,
  setError,
  submitting,
  onAdd,
  onRemove,
}: {
  dependencies: ActionItemDependencyRef[];
  blocks: ActionItemDependencyRef[];
  serverActions?: ActionItemPayload[];
  currentActionId: string;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  query: string;
  setQuery: (v: string) => void;
  error: string | null;
  setError: (v: string | null) => void;
  submitting: boolean;
  onAdd: (blockerId: string) => Promise<void>;
  onRemove: (blockerId: string) => Promise<void>;
}) {
  const candidates = useMemo(() => {
    if (!serverActions) return [];
    const existing = new Set(dependencies.map((d) => d.id));
    existing.add(currentActionId);
    const q = query.trim().toLowerCase();
    return serverActions
      .filter((a) => !existing.has(a.id))
      .filter((a) => (q ? a.title.toLowerCase().includes(q) : true))
      .slice(0, 30);
  }, [serverActions, dependencies, currentActionId, query]);

  // v0.76 #20 phase 2: показываем mini-DAG только если есть >=1 edge — иначе
  // картинка пустая. Toggle-collapsible чтобы не давить когда не нужно.
  const hasGraph = dependencies.length > 0 || blocks.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {hasGraph && (
        <DepDagViz dependencies={dependencies} blocks={blocks} />
      )}
      {dependencies.length === 0 ? (
        <p
          style={{
            margin: 0,
            color: "var(--ec-text-dim)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          Эта задача ни от чего не зависит.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {dependencies.map((d) => {
            const tone = DEP_STATUS_TONE[d.status];
            return (
              <div key={d.id} style={depRowStyle(d.status === "DONE")}>
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: tone.bg,
                    color: tone.fg,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "var(--ec-tracking-caps)",
                    flexShrink: 0,
                  }}
                >
                  {tone.label}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--ec-text)",
                  }}
                  title={d.title}
                >
                  {d.title}
                </span>
                <button
                  type="button"
                  onClick={() => void onRemove(d.id)}
                  disabled={submitting}
                  title="Убрать зависимость"
                  aria-label="Убрать зависимость"
                  style={{
                    width: 22,
                    height: 22,
                    display: "grid",
                    placeItems: "center",
                    background: "transparent",
                    border: 0,
                    color: "var(--ec-text-dim)",
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontSize: "0.9rem",
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {blocks.length > 0 && (
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-dim)",
              letterSpacing: "var(--ec-tracking-caps)",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Блокирует {blocks.length}
          </summary>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginTop: 6,
            }}
          >
            {blocks.map((b) => {
              const tone = DEP_STATUS_TONE[b.status];
              return (
                <div key={b.id} style={depRowStyle(b.status === "DONE")}>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: tone.bg,
                      color: tone.fg,
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "var(--ec-tracking-caps)",
                      flexShrink: 0,
                    }}
                  >
                    {tone.label}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--ec-text)",
                    }}
                    title={b.title}
                  >
                    {b.title}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {pickerOpen ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "var(--ec-space-2)",
            borderRadius: "var(--ec-radius-md)",
            background: "var(--ec-surface-2)",
            border: "1px solid var(--ec-border-default)",
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            placeholder="Поиск задачи по названию…"
            autoFocus
            style={{
              padding: "0.4rem 0.6rem",
              borderRadius: "var(--ec-radius-sm)",
              border: "1px solid var(--ec-border-default)",
              background: "var(--ec-surface-1)",
              color: "var(--ec-text)",
              fontSize: "var(--ec-text-sm)",
            }}
          />
          {!serverActions ? (
            <p
              style={{
                margin: 0,
                color: "var(--ec-text-dim)",
                fontSize: "var(--ec-text-2xs)",
              }}
            >
              Открой пространство, чтобы выбрать задачу-блокер.
            </p>
          ) : candidates.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: "var(--ec-text-dim)",
                fontSize: "var(--ec-text-2xs)",
              }}
            >
              Подходящих задач нет.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {candidates.map((c) => {
                const tone = DEP_STATUS_TONE[c.status];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void onAdd(c.id)}
                    disabled={submitting}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "var(--ec-space-1) var(--ec-space-2)",
                      borderRadius: "var(--ec-radius-sm)",
                      background: "transparent",
                      border: "1px solid transparent",
                      color: "var(--ec-text)",
                      cursor: submitting ? "not-allowed" : "pointer",
                      textAlign: "left",
                      fontSize: "var(--ec-text-sm)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--ec-surface-3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: tone.bg,
                        color: tone.fg,
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "var(--ec-tracking-caps)",
                        flexShrink: 0,
                      }}
                    >
                      {tone.label}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={c.title}
                    >
                      {c.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {error && (
            <p
              style={{
                margin: 0,
                color: "var(--ec-danger)",
                fontSize: "var(--ec-text-2xs)",
              }}
            >
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setPickerOpen(false);
              setQuery("");
              setError(null);
            }}
            style={{
              alignSelf: "flex-end",
              padding: "0.25rem 0.6rem",
              background: "transparent",
              border: "1px solid var(--ec-border-default)",
              borderRadius: "var(--ec-radius-sm)",
              color: "var(--ec-text-muted)",
              cursor: "pointer",
              fontSize: "var(--ec-text-2xs)",
            }}
          >
            Отмена
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={!serverActions}
          title={
            !serverActions
              ? "Открой пространство, чтобы выбрать задачу"
              : "Добавить blocker"
          }
          style={{
            alignSelf: "flex-start",
            padding: "0.3rem 0.7rem",
            borderRadius: "var(--ec-radius-md)",
            background: "transparent",
            border: "1px dashed var(--ec-border-default)",
            color: serverActions ? "var(--ec-text-muted)" : "var(--ec-text-dim)",
            cursor: serverActions ? "pointer" : "not-allowed",
            fontSize: "var(--ec-text-2xs)",
            fontWeight: 600,
            letterSpacing: "var(--ec-tracking-caps)",
            textTransform: "uppercase",
          }}
        >
          + Добавить блокер
        </button>
      )}
    </div>
  );
}
