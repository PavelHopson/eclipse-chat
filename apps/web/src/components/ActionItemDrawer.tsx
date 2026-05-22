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
 * ActionItemDrawer — mission detail panel для task / decision /
 * follow-up. Right-side floating panel поверх chat-shell'а.
 *
 * v1.2.4 (R2, Execution Cockpit 3/3) — переведён на cockpit-язык
 * (`cockpit.css`, `.ec-cck-*`): убраны все module-level
 * `CSSProperties`-консоли и inline-style долг (~95), JS-hover в
 * CommentRow / dep-picker → CSS. Сильный identity-блок, ясная
 * иерархия секций (свойства / одобрение / зависимости / описание /
 * сводка / комментарии / история).
 *
 * Содержание и логика (inline-edit, approval workflow, dependency
 * DAG, AI summary, realtime sync) не тронуты.
 */

type Props = {
  actionItemId: string;
  socket: Socket | null;
  currentUserId: string;
  members: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  channelNameById: (channelId: string) => string | null;
  onClose: () => void;
  onJumpToSource?: (channelId: string, messageId: string) => void;
  serverActions?: ActionItemPayload[];
};

/** tone-токен → `--tone` (динамика — единственное, что допустимо инлайном). */
const tone = (t: string): CSSProperties => ({ "--tone": t } as CSSProperties);

const TYPE_META: Record<
  "TASK" | "DECISION" | "FOLLOW_UP",
  { label: string; tone: string; glyph: string }
> = {
  TASK: { label: "Задача", tone: "var(--ec-status-exec)", glyph: "▣" },
  DECISION: { label: "Решение", tone: "var(--ec-accent)", glyph: "◆" },
  FOLLOW_UP: { label: "Follow-up", tone: "var(--ec-status-warn)", glyph: "○" },
};

const PRIORITY_META: Record<ActionItemPriority, { label: string; tone: string }> = {
  LOW: { label: "Low", tone: "var(--ec-status-idle)" },
  NORMAL: { label: "Normal", tone: "var(--ec-text-muted)" },
  HIGH: { label: "High", tone: "var(--ec-status-warn)" },
  URGENT: { label: "Urgent", tone: "var(--ec-status-risk)" },
};

type TaskStatus = "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";

const STATUS_TONE: Record<TaskStatus, string> = {
  OPEN: "var(--ec-status-idle)",
  IN_PROGRESS: "var(--ec-accent)",
  REVIEW: "var(--ec-status-ai)",
  DONE: "var(--ec-status-exec)",
};

const STATUS_RU: Record<TaskStatus, string> = {
  OPEN: "Открыто",
  IN_PROGRESS: "В работе",
  REVIEW: "На ревью",
  DONE: "Выполнено",
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

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
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
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalApproverId, setApprovalApproverId] = useState<string>("");
  const [approvalNote, setApprovalNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [depPickerOpen, setDepPickerOpen] = useState(false);
  const [depQuery, setDepQuery] = useState("");
  const [depError, setDepError] = useState<string | null>(null);
  const [submittingDep, setSubmittingDep] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (detail) {
      setTitleDraft(detail.title);
      setDescDraft(detail.description ?? "");
    }
  }, [detail?.id, detail?.updatedAt]);

  // Escape closes drawer + body scroll-lock пока drawer открыт.
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
      <div className="ec-cck-drawer__backdrop" onClick={onClose} aria-hidden />
      <aside
        className="ec-cck-drawer ec-action-drawer"
        role="dialog"
        aria-label="Детали задачи"
      >
        <header className="ec-cck-drawer__head">
          {detail && typeMeta ? (
            <>
              <span className="ec-cck-drawer__glyph" style={tone(typeMeta.tone)} aria-hidden>
                {typeMeta.glyph}
              </span>
              <span className="ec-cck-drawer__type" style={tone(typeMeta.tone)}>
                {typeMeta.label}
              </span>
              <span style={{ flex: 1 }} />
              <select
                className="ec-cck-statussel"
                style={tone(STATUS_TONE[detail.status])}
                value={detail.status}
                onChange={(e) => void update({ status: e.target.value as TaskStatus })}
                aria-label="Статус"
              >
                {(Object.keys(STATUS_RU) as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_RU[s]}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <strong style={{ flex: 1, fontSize: "var(--ec-text-sm)", color: "var(--ec-text-muted)" }}>
              {loading ? "Загрузка…" : "Задача"}
            </strong>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ec-icon-btn ec-drawer-close"
            aria-label="Закрыть"
            title="Закрыть · Esc"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="ec-cck-drawer__body">
          {error && <p className="ec-cck-banner ec-cck-banner--error">{error}</p>}

          {detail && (
            <>
              {/* Identity — заголовок задачи (hero). */}
              <section className="ec-cck-sec">
                <h3 className="ec-cck-sec__label">Задача</h3>
                <input
                  type="text"
                  className="ec-cck-titleinput"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  maxLength={160}
                  aria-label="Название задачи"
                />
              </section>

              {/* Properties */}
              <section className="ec-cck-sec">
                <h3 className="ec-cck-sec__label">Свойства</h3>
                <div className="ec-cck-prop">
                  <span className="ec-cck-prop__label">Приоритет</span>
                  <select
                    className="ec-cck-field ec-cck-field--tone"
                    style={tone(PRIORITY_META[detail.priority].tone)}
                    value={detail.priority}
                    onChange={(e) =>
                      void update({ priority: e.target.value as ActionItemPriority })
                    }
                  >
                    {(Object.keys(PRIORITY_META) as ActionItemPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ec-cck-prop">
                  <span className="ec-cck-prop__label">Ответственный</span>
                  <select
                    className="ec-cck-field"
                    value={detail.assignee?.id ?? ""}
                    onChange={(e) =>
                      void update({
                        assigneeUserId: e.target.value === "" ? null : e.target.value,
                      })
                    }
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
                <div className="ec-cck-prop">
                  <span className="ec-cck-prop__label">Срок</span>
                  <input
                    type="datetime-local"
                    className="ec-cck-field ec-cck-field--mono"
                    value={dueValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        void update({ dueAt: null });
                        return;
                      }
                      const local = new Date(v);
                      if (!Number.isNaN(local.getTime())) {
                        void update({ dueAt: local.toISOString() });
                      }
                    }}
                  />
                </div>
                <div className="ec-cck-prop">
                  <span className="ec-cck-prop__label">Источник</span>
                  <span className="ec-cck-prop__val">
                    <span>#{channelNameById(detail.channelId) ?? "комната"}</span>
                    {onJumpToSource && (
                      <button
                        type="button"
                        className="ec-cck-rowbtn"
                        data-tone="accent"
                        onClick={() =>
                          onJumpToSource(detail.channelId, detail.sourceMessageId)
                        }
                        title="Открыть исходное сообщение"
                      >
                        к сообщению
                      </button>
                    )}
                  </span>
                </div>
                <div className="ec-cck-prop">
                  <span className="ec-cck-prop__label">Автор</span>
                  <span className="ec-cck-prop__val">
                    <Avatar
                      url={detail.createdBy.avatar}
                      name={detail.createdBy.displayName}
                      size={18}
                    />
                    {detail.createdBy.displayName}
                    <span style={{ color: "var(--ec-text-dim)" }}>
                      · {relativeTime(detail.createdAt)}
                    </span>
                  </span>
                </div>
              </section>

              {/* Approval */}
              <section className="ec-cck-sec">
                <h3 className="ec-cck-sec__label">Одобрение</h3>
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

              {/* Dependencies */}
              <section className="ec-cck-sec">
                <h3 className="ec-cck-sec__label">
                  Зависимости
                  {detail.blockedByOpen > 0 && (
                    <span className="ec-cck-chip" style={tone("var(--ec-status-risk)")}>
                      блок ×{detail.blockedByOpen}
                    </span>
                  )}
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
              <section className="ec-cck-sec">
                <h3 className="ec-cck-sec__label">Описание</h3>
                <textarea
                  className="ec-cck-field ec-cck-field--area"
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onBlur={() => void saveDescription()}
                  placeholder="Детали, контекст, ссылки. Сохраняется автоматически."
                  maxLength={4000}
                  rows={4}
                />
              </section>

              {/* AI summary */}
              <section className="ec-cck-sec">
                <h3 className="ec-cck-sec__label">
                  Сводка
                  {detail.aiSummaryUpdatedAt && (
                    <span className="ec-cck-sec__count">
                      {relativeTime(detail.aiSummaryUpdatedAt)}
                    </span>
                  )}
                </h3>
                {detail.aiSummary ? (
                  <p className="ec-cck-aicard">{detail.aiSummary}</p>
                ) : (
                  <p className="ec-cck-empty" style={{ padding: 0, textAlign: "left" }}>
                    Сводка ещё не сгенерирована.
                  </p>
                )}
                {aiError && (
                  <p className="ec-cck-banner ec-cck-banner--error" style={{ margin: 0 }}>
                    {aiError}
                  </p>
                )}
                <button
                  type="button"
                  className="ec-cck-rowbtn"
                  data-tone={aiLoading ? "accent" : undefined}
                  style={{ alignSelf: "flex-start" }}
                  onClick={async () => {
                    setAiLoading(true);
                    setAiError(null);
                    const r = await generateAiSummary();
                    setAiLoading(false);
                    if (!r.ok) setAiError(r.error);
                  }}
                  disabled={aiLoading}
                >
                  {aiLoading
                    ? "Генерирую…"
                    : detail.aiSummary
                      ? "Перегенерировать"
                      : "Сгенерировать сводку"}
                </button>
              </section>

              {/* Comments */}
              <section className="ec-cck-sec">
                <h3 className="ec-cck-sec__label">
                  Комментарии
                  <span className="ec-cck-sec__count">{detail.comments.length}</span>
                </h3>
                {detail.comments.length === 0 ? (
                  <p className="ec-cck-empty" style={{ padding: 0, textAlign: "left" }}>
                    Никто ещё ничего не написал.
                  </p>
                ) : (
                  detail.comments.map((c) => (
                    <CommentRow
                      key={c.id}
                      comment={c}
                      currentUserId={currentUserId}
                      onDelete={async () => void removeComment(c.id)}
                    />
                  ))
                )}
              </section>

              {/* Activity */}
              <section className="ec-cck-sec">
                <button
                  type="button"
                  className="ec-cck-toggle"
                  onClick={() => setShowActivity((v) => !v)}
                  aria-expanded={showActivity}
                >
                  <span>История · {detail.activities.length}</span>
                  <span aria-hidden style={{ fontSize: "0.7rem" }}>
                    {showActivity ? "▲" : "▼"}
                  </span>
                </button>
                {showActivity && detail.activities.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {detail.activities.map((a) => (
                      <div key={a.id} className="ec-cck-actrow">
                        <span className="ec-cck-actrow__time">
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
          <div className="ec-cck-drawer__foot">
            <textarea
              className="ec-cck-field ec-cck-field--area"
              style={{ minHeight: 38 }}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              placeholder="Комментарий · Enter — отправить, Shift+Enter — перенос"
              rows={2}
              maxLength={2000}
              disabled={submittingComment}
            />
            <div className="ec-cck-inset__row ec-cck-inset__row--end" style={{ marginTop: "var(--ec-space-2)" }}>
              <button
                type="button"
                className="ec-btn ec-btn--primary ec-btn--sm"
                onClick={() => void submitComment()}
                disabled={submittingComment || !commentDraft.trim()}
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

  const approverPicker = (
    <>
      <select
        className="ec-cck-field"
        value={approverId}
        onChange={(e) => setApproverId(e.target.value)}
      >
        <option value="">— выбери участника —</option>
        {eligible.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.user.displayName}
          </option>
        ))}
      </select>
      <textarea
        className="ec-cck-field ec-cck-field--area"
        style={{ minHeight: 50 }}
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        placeholder="Комментарий для approver (необязательно)"
        maxLength={500}
        rows={2}
      />
      <div className="ec-cck-inset__row ec-cck-inset__row--end">
        <button
          type="button"
          className="ec-btn ec-btn--ghost ec-btn--sm"
          onClick={() => {
            setShowForm(false);
            setNoteDraft("");
          }}
          disabled={submitting}
        >
          Отмена
        </button>
        <button
          type="button"
          className="ec-btn ec-btn--primary ec-btn--sm"
          onClick={onRequest}
          disabled={submitting || !approverId}
        >
          {submitting ? "Отправляем…" : "Запросить"}
        </button>
      </div>
    </>
  );

  if (status === "NONE") {
    return !showForm ? (
      <button
        type="button"
        className="ec-btn ec-btn--ghost ec-btn--sm"
        style={{ alignSelf: "flex-start" }}
        onClick={() => setShowForm(true)}
      >
        Запросить одобрение
      </button>
    ) : (
      <div className="ec-cck-inset">{approverPicker}</div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="ec-cck-inset" data-tone="var(--ec-status-warn)" style={tone("var(--ec-status-warn)")}>
        <div className="ec-cck-inset__row">
          <span className="ec-cck-chip" style={tone("var(--ec-status-warn)")}>
            Ожидает
          </span>
          <span style={{ fontSize: "var(--ec-text-sm)", color: "var(--ec-text)" }}>
            Решение от{" "}
            {approver ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle" }}>
                <Avatar url={approver.avatar} name={approver.displayName} size={16} />
                <strong style={{ color: "var(--ec-text-strong)" }}>
                  {approver.displayName}
                </strong>
              </span>
            ) : (
              "неизвестно"
            )}
          </span>
        </div>
        {approvalNote && (
          <p style={{ margin: 0, fontSize: "var(--ec-text-xs)", color: "var(--ec-text-muted)", fontStyle: "italic", whiteSpace: "pre-wrap" }}>
            Запрос: {approvalNote}
          </p>
        )}
        {isApprover && (
          <>
            <textarea
              className="ec-cck-field ec-cck-field--area"
              style={{ minHeight: 50 }}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Причина / комментарий (особенно при отклонении)"
              maxLength={500}
              rows={2}
            />
            <div className="ec-cck-inset__row ec-cck-inset__row--end">
              <button
                type="button"
                className="ec-btn ec-btn--danger ec-btn--sm"
                onClick={onReject}
                disabled={submitting}
              >
                Отклонить
              </button>
              <button
                type="button"
                className="ec-btn ec-btn--primary ec-btn--sm"
                onClick={onApprove}
                disabled={submitting}
              >
                Одобрить
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // APPROVED / REJECTED
  const isApproved = status === "APPROVED";
  const resultTone = isApproved ? "var(--ec-status-exec)" : "var(--ec-danger)";
  return (
    <div className="ec-cck-inset" data-tone={resultTone} style={tone(resultTone)}>
      <div className="ec-cck-inset__row">
        <span className="ec-cck-chip" style={tone(resultTone)}>
          {isApproved ? "Одобрено" : "Отклонено"}
        </span>
        {approver && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--ec-text-xs)", color: "var(--ec-text-muted)" }}>
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
        <p style={{ margin: 0, fontSize: "var(--ec-text-sm)", color: "var(--ec-text)", whiteSpace: "pre-wrap" }}>
          {approvalNote}
        </p>
      )}
      {!showForm ? (
        <button
          type="button"
          className="ec-btn ec-btn--ghost ec-btn--sm"
          style={{ alignSelf: "flex-start" }}
          onClick={() => setShowForm(true)}
        >
          Запросить заново
        </button>
      ) : (
        approverPicker
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
  return (
    <div className="ec-cck-comment">
      <Avatar url={comment.user.avatar} name={comment.user.displayName} size={28} />
      <div style={{ minWidth: 0 }}>
        <div className="ec-cck-comment__head">
          <span className="ec-cck-comment__author">{comment.user.displayName}</span>
          <span className="ec-cck-comment__time">
            {relativeTime(comment.createdAt)}
            {comment.editedAt ? " · ред." : ""}
          </span>
        </div>
        <div className="ec-cck-comment__body">{comment.content}</div>
      </div>
      {isMine && (
        <button
          type="button"
          className="ec-cck-comment__del"
          onClick={() => void onDelete()}
          title="Удалить комментарий"
          aria-label="Удалить комментарий"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ============================================================
 * Dependencies — blockers (от чего зависит) + blocks (что блокирует).
 * ============================================================ */

const DEP_STATUS: Record<TaskStatus, { tone: string; label: string }> = {
  OPEN: { tone: "var(--ec-status-idle)", label: "open" },
  IN_PROGRESS: { tone: "var(--ec-accent)", label: "работа" },
  REVIEW: { tone: "var(--ec-status-ai)", label: "ревью" },
  DONE: { tone: "var(--ec-status-exec)", label: "done" },
};

function truncateLabel(s: string, max = 18): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function dagNodeColors(status: TaskStatus): {
  fill: string;
  stroke: string;
  text: string;
} {
  if (status === "DONE")
    return {
      fill: "var(--ec-status-exec-soft)",
      stroke: "var(--ec-status-exec)",
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
      fill: "var(--ec-status-ai-soft)",
      stroke: "var(--ec-status-ai)",
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

  const nodeW = 96;
  const nodeH = 26;
  const gapX = 10;
  const ySpace = 50;
  const padTop = 6;
  const padBottom = 6;
  const cols = Math.max(
    1,
    visibleDeps.length + (moreDeps > 0 ? 1 : 0),
    visibleBlocks.length + (moreBlocks > 0 ? 1 : 0),
  );
  const innerW = cols * nodeW + (cols - 1) * gapX;
  const w = innerW + 24;
  const h = padTop + nodeH + ySpace + nodeH + ySpace + nodeH + padBottom;

  const depRowCount = visibleDeps.length + (moreDeps > 0 ? 1 : 0);
  const blockRowCount = visibleBlocks.length + (moreBlocks > 0 ? 1 : 0);
  const yDeps = padTop;
  const yMe = padTop + nodeH + ySpace;
  const yBlocks = padTop + nodeH + ySpace + nodeH + ySpace;
  const meX = (w - nodeW) / 2;

  function rowX(count: number, idx: number): number {
    const rowWidth = count * nodeW + (count - 1) * gapX;
    return (w - rowWidth) / 2 + idx * (nodeW + gapX);
  }

  return (
    <details className="ec-cck-inset">
      <summary className="ec-cck-toggle">
        Граф зависимостей · {dependencies.length} ← задача → {blocks.length}
      </summary>
      <div style={{ marginTop: 8, overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
          aria-label="Граф зависимостей"
        >
          {visibleDeps.map((d, i) => {
            const x = rowX(depRowCount, i);
            const c = dagNodeColors(d.status);
            return (
              <g key={d.id}>
                <rect x={x} y={yDeps} width={nodeW} height={nodeH} rx={6} fill={c.fill} stroke={c.stroke} strokeWidth={1} />
                <text x={x + nodeW / 2} y={yDeps + nodeH / 2 + 4} textAnchor="middle" fontSize={11} fill={c.text}>
                  {truncateLabel(d.title)}
                </text>
                <line x1={x + nodeW / 2} y1={yDeps + nodeH} x2={meX + nodeW / 2} y2={yMe} stroke="var(--ec-border-default)" strokeWidth={1.2} markerEnd="url(#ec-dag-arrow)" />
              </g>
            );
          })}
          {moreDeps > 0 && (
            <g>
              <rect x={rowX(depRowCount, visibleDeps.length)} y={yDeps} width={nodeW} height={nodeH} rx={6} fill="var(--ec-surface-3)" stroke="var(--ec-border-default)" strokeDasharray="3 3" />
              <text x={rowX(depRowCount, visibleDeps.length) + nodeW / 2} y={yDeps + nodeH / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--ec-text-muted)">
                +{moreDeps} ещё
              </text>
            </g>
          )}

          <rect x={meX} y={yMe} width={nodeW} height={nodeH} rx={6} fill="var(--ec-accent)" stroke="var(--ec-accent)" opacity={0.95} />
          <text x={meX + nodeW / 2} y={yMe + nodeH / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ec-accent-text)">
            Эта задача
          </text>

          {visibleBlocks.map((b, i) => {
            const x = rowX(blockRowCount, i);
            const c = dagNodeColors(b.status);
            return (
              <g key={b.id}>
                <line x1={meX + nodeW / 2} y1={yMe + nodeH} x2={x + nodeW / 2} y2={yBlocks} stroke="var(--ec-border-default)" strokeWidth={1.2} markerEnd="url(#ec-dag-arrow)" />
                <rect x={x} y={yBlocks} width={nodeW} height={nodeH} rx={6} fill={c.fill} stroke={c.stroke} strokeWidth={1} />
                <text x={x + nodeW / 2} y={yBlocks + nodeH / 2 + 4} textAnchor="middle" fontSize={11} fill={c.text}>
                  {truncateLabel(b.title)}
                </text>
              </g>
            );
          })}
          {moreBlocks > 0 && (
            <g>
              <line x1={meX + nodeW / 2} y1={yMe + nodeH} x2={rowX(blockRowCount, visibleBlocks.length) + nodeW / 2} y2={yBlocks} stroke="var(--ec-border-default)" strokeWidth={1.2} strokeDasharray="3 3" />
              <rect x={rowX(blockRowCount, visibleBlocks.length)} y={yBlocks} width={nodeW} height={nodeH} rx={6} fill="var(--ec-surface-3)" stroke="var(--ec-border-default)" strokeDasharray="3 3" />
              <text x={rowX(blockRowCount, visibleBlocks.length) + nodeW / 2} y={yBlocks + nodeH / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--ec-text-muted)">
                +{moreBlocks} ещё
              </text>
            </g>
          )}

          <defs>
            <marker id="ec-dag-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ec-border-default)" />
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

  const hasGraph = dependencies.length > 0 || blocks.length > 0;

  const depChip = (status: TaskStatus) => (
    <span className="ec-cck-chip" style={tone(DEP_STATUS[status].tone)}>
      {DEP_STATUS[status].label}
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
      {hasGraph && <DepDagViz dependencies={dependencies} blocks={blocks} />}

      {dependencies.length === 0 ? (
        <p className="ec-cck-empty" style={{ padding: 0, textAlign: "left" }}>
          Эта задача ни от чего не зависит.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {dependencies.map((d) => (
            <div key={d.id} className="ec-cck-deprow" data-done={d.status === "DONE" ? "true" : "false"}>
              {depChip(d.status)}
              <span className="ec-cck-deprow__name" title={d.title}>{d.title}</span>
              <button
                type="button"
                className="ec-cck-act ec-cck-act--danger"
                onClick={() => void onRemove(d.id)}
                disabled={submitting}
                title="Убрать зависимость"
                aria-label="Убрать зависимость"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {blocks.length > 0 && (
        <details>
          <summary className="ec-cck-toggle">Блокирует · {blocks.length}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            {blocks.map((b) => (
              <div key={b.id} className="ec-cck-deprow" data-done={b.status === "DONE" ? "true" : "false"}>
                {depChip(b.status)}
                <span className="ec-cck-deprow__name" title={b.title}>{b.title}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {pickerOpen ? (
        <div className="ec-cck-inset">
          <input
            type="text"
            className="ec-cck-field"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            placeholder="Поиск задачи по названию…"
            autoFocus
          />
          {!serverActions ? (
            <p className="ec-cck-empty" style={{ padding: 0, textAlign: "left" }}>
              Открой пространство, чтобы выбрать задачу-блокер.
            </p>
          ) : candidates.length === 0 ? (
            <p className="ec-cck-empty" style={{ padding: 0, textAlign: "left" }}>
              Подходящих задач нет.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 220, overflowY: "auto" }}>
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="ec-cck-pop__row"
                  onClick={() => void onAdd(c.id)}
                  disabled={submitting}
                  style={{ border: 0, background: "transparent", textAlign: "left", width: "100%" }}
                >
                  {depChip(c.status)}
                  <span className="ec-cck-deprow__name" title={c.title}>{c.title}</span>
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="ec-cck-banner ec-cck-banner--error" style={{ margin: 0 }}>
              {error}
            </p>
          )}
          <div className="ec-cck-inset__row ec-cck-inset__row--end">
            <button
              type="button"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              onClick={() => {
                setPickerOpen(false);
                setQuery("");
                setError(null);
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ec-cck-rowbtn"
          style={{ alignSelf: "flex-start" }}
          onClick={() => setPickerOpen(true)}
          disabled={!serverActions}
          title={
            !serverActions
              ? "Открой пространство, чтобы выбрать задачу"
              : "Добавить blocker"
          }
        >
          + Добавить блокер
        </button>
      )}
    </div>
  );
}
