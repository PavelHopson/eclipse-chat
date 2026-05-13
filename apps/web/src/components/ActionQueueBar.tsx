import { useState } from "react";
import type { CSSProperties } from "react";
import { Avatar } from "./Avatar";
import type { MemberRow } from "../hooks/useMembers";
import type { ActionItemUpdatePatch, MessageActionItem } from "../hooks/useMessages";

type Props = {
  items: MessageActionItem[];
  currentUserId: string;
  members: MemberRow[];
  onUpdateAction?: (actionId: string, patch: ActionItemUpdatePatch) => Promise<boolean>;
};

const wrap: CSSProperties = {
  borderBottom: "1px solid var(--ec-border-subtle)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ec-accent) 7%, transparent), transparent)",
  padding: "var(--ec-space-3) var(--ec-space-5)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  marginBottom: "var(--ec-space-3)",
};

const rail: CSSProperties = {
  display: "flex",
  gap: "var(--ec-space-2)",
  overflowX: "auto",
  paddingBottom: 2,
};

const card: CSSProperties = {
  minWidth: 220,
  maxWidth: 280,
  padding: "var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-lg)",
  boxShadow: "var(--ec-shadow-sm)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

const metaRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  color: "var(--ec-text-muted)",
  fontSize: "var(--ec-text-2xs)",
};

const smallBtn: CSSProperties = {
  minHeight: 26,
  padding: "0.2rem 0.45rem",
  fontSize: "var(--ec-text-2xs)",
};

const filterBtn: CSSProperties = {
  minHeight: 28,
  padding: "0.22rem 0.58rem",
  borderRadius: "var(--ec-radius-full)",
  border: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
  color: "var(--ec-text-muted)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
};

const digestRail: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  flexWrap: "wrap",
  marginLeft: "auto",
};

type QueueFilter = "all" | "mine";

function labelForType(type: MessageActionItem["type"]) {
  if (type === "DECISION") return "Решение";
  if (type === "FOLLOW_UP") return "Follow-up";
  return "Задача";
}

function dueLabel(iso: string | null): string {
  if (!iso) return "Без срока";
  const due = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(due, today)) return "Сегодня";
  if (sameDay(due, tomorrow)) return "Завтра";
  return due.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dueMeta(iso: string | null) {
  if (!iso) {
    return {
      label: "Без срока",
      hint: "SLA не задан",
      bg: "hsl(220 12% 18% / 0.55)",
      fg: "var(--ec-text-muted)",
      border: "var(--ec-border-subtle)",
    };
  }

  const due = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (due.getTime() < startOfTodayMs()) {
    return {
      label: "Просрочено",
      hint: dueLabel(iso),
      bg: "hsl(0 80% 56% / 0.13)",
      fg: "hsl(0 82% 72%)",
      border: "hsl(0 72% 52% / 0.34)",
    };
  }

  if (sameDay(due, today)) {
    return {
      label: "Сегодня",
      hint: "Горит сегодня",
      bg: "hsl(32 100% 58% / 0.13)",
      fg: "hsl(32 100% 68%)",
      border: "hsl(32 100% 58% / 0.34)",
    };
  }

  if (sameDay(due, tomorrow)) {
    return {
      label: "Завтра",
      hint: "Следующий слот",
      bg: "hsl(47 85% 58% / 0.12)",
      fg: "hsl(47 88% 68%)",
      border: "hsl(47 72% 46% / 0.32)",
    };
  }

  return {
    label: dueLabel(iso),
    hint: "Плановый срок",
    bg: "hsl(194 72% 46% / 0.12)",
    fg: "hsl(194 76% 72%)",
    border: "hsl(194 72% 54% / 0.28)",
  };
}

function dueIsoInDays(days: number): string {
  const due = new Date();
  due.setDate(due.getDate() + days);
  due.setHours(18, 0, 0, 0);
  return due.toISOString();
}

function tintForType(type: MessageActionItem["type"]) {
  if (type === "DECISION") {
    return {
      bg: "hsl(47 85% 58% / 0.12)",
      fg: "hsl(47 88% 68%)",
      border: "hsl(47 72% 46% / 0.32)",
    };
  }
  if (type === "FOLLOW_UP") {
    return {
      bg: "hsl(170 70% 52% / 0.12)",
      fg: "hsl(170 74% 64%)",
      border: "hsl(170 64% 46% / 0.28)",
    };
  }
  return {
    bg: "var(--ec-accent-soft)",
    fg: "var(--ec-accent)",
    border: "var(--ec-border-accent)",
  };
}

export function ActionQueueBar({ items, currentUserId, members, onUpdateAction }: Props) {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const myItems = items.filter((item) => item.assignee?.id === currentUserId);
  const visibleItems = filter === "mine" ? myItems : items;
  const overdueCount = items.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < startOfTodayMs()).length;
  const decisionCount = items.filter((item) => item.type === "DECISION").length;
  const followUpCount = items.filter((item) => item.type === "FOLLOW_UP").length;
  const taskCount = items.filter((item) => item.type === "TASK").length;

  const beginEdit = (item: MessageActionItem) => {
    if (!onUpdateAction) return;
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const saveTitle = async (actionId: string) => {
    const next = editingTitle.trim();
    if (!next) return;
    const ok = await onUpdateAction?.(actionId, { title: next });
    if (ok) cancelEdit();
  };

  return (
    <div style={wrap}>
      <div style={header}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--ec-accent-soft)",
            color: "var(--ec-accent)",
            border: "1px solid var(--ec-border-accent)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)", fontWeight: 600 }}>
            Контур исполнения
          </div>
          <div style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
            {items.length > 0
              ? `${items.length} открытых action items · мои ${myItems.length}`
              : "Превращай сообщения в задачи, решения и follow-up"}
          </div>
        </div>
        {items.length > 0 && (
          <div style={digestRail} aria-label="Дайджест канала">
            <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
              T:{taskCount} / D:{decisionCount} / F:{followUpCount}
            </span>
            <span
              style={{
                padding: "0.22rem 0.5rem",
                borderRadius: "var(--ec-radius-full)",
                border: overdueCount > 0 ? "1px solid hsl(0 72% 52% / 0.34)" : "1px solid var(--ec-border-subtle)",
                background: overdueCount > 0 ? "hsl(0 80% 56% / 0.12)" : "var(--ec-surface-1)",
                color: overdueCount > 0 ? "hsl(0 82% 72%)" : "var(--ec-text-muted)",
                fontSize: "var(--ec-text-2xs)",
                fontWeight: 800,
                letterSpacing: "var(--ec-tracking-caps)",
                textTransform: "uppercase",
              }}
            >
              SLA {overdueCount > 0 ? `горит ${overdueCount}` : "чисто"}
            </span>
            <button
              type="button"
              style={{
                ...filterBtn,
                background: filter === "all" ? "var(--ec-accent-soft)" : filterBtn.background,
                color: filter === "all" ? "var(--ec-accent)" : filterBtn.color,
                borderColor: filter === "all" ? "var(--ec-border-accent)" : "var(--ec-border-subtle)",
              }}
              onClick={() => setFilter("all")}
            >
              Все
            </button>
            <button
              type="button"
              style={{
                ...filterBtn,
                background: filter === "mine" ? "var(--ec-accent-soft)" : filterBtn.background,
                color: filter === "mine" ? "var(--ec-accent)" : filterBtn.color,
                borderColor: filter === "mine" ? "var(--ec-border-accent)" : "var(--ec-border-subtle)",
              }}
              onClick={() => setFilter("mine")}
            >
              Мои
            </button>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div style={rail}>
          {visibleItems.length === 0 ? (
            <div
              style={{
                color: "var(--ec-text-muted)",
                fontSize: "var(--ec-text-sm)",
                padding: "var(--ec-space-3)",
                borderRadius: "var(--ec-radius-lg)",
                border: "1px dashed var(--ec-border-subtle)",
                background: "color-mix(in srgb, var(--ec-surface-2) 75%, transparent)",
                minWidth: 260,
              }}
            >
              В этом фильтре пусто. Возьми action item на себя или вернись ко всем задачам.
            </div>
          ) : visibleItems.map((item) => {
            const tint = tintForType(item.type);
            const assignee = item.assignee;
            const due = dueMeta(item.dueAt);
            const isEditing = editingId === item.id;
            return (
              <article key={item.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "var(--ec-radius-full)",
                      background: tint.bg,
                      color: tint.fg,
                      border: `1px solid ${tint.border}`,
                      fontSize: "var(--ec-text-2xs)",
                      letterSpacing: "var(--ec-tracking-wide)",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {labelForType(item.type)}
                  </span>
                  <span style={{ marginLeft: "auto", color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
                    {item.createdBy.displayName}
                  </span>
                </div>
                {isEditing ? (
                  <textarea
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                        event.preventDefault();
                        void saveTitle(item.id);
                      }
                    }}
                    autoFocus
                    rows={3}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      padding: "0.55rem 0.65rem",
                      borderRadius: "var(--ec-radius-md)",
                      border: "1px solid var(--ec-border-accent)",
                      background: "var(--ec-surface-1)",
                      color: "var(--ec-text)",
                      fontSize: "var(--ec-text-sm)",
                      lineHeight: "var(--ec-leading-normal)",
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => beginEdit(item)}
                    disabled={!onUpdateAction}
                    title={onUpdateAction ? "Редактировать action title" : undefined}
                    style={{
                      width: "100%",
                      minHeight: 58,
                      padding: 0,
                      textAlign: "left",
                      color: "var(--ec-text)",
                      fontSize: "var(--ec-text-sm)",
                      lineHeight: "var(--ec-leading-normal)",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3,
                      overflow: "hidden",
                      cursor: onUpdateAction ? "text" : "default",
                    }}
                  >
                    {item.title}
                  </button>
                )}
                <div style={metaRow}>
                  {assignee ? (
                    <>
                      <Avatar url={assignee.avatar} name={assignee.displayName} size={18} />
                      <span style={{ color: "var(--ec-text)" }}>{assignee.displayName}</span>
                    </>
                  ) : (
                    <span>Нет ответственного</span>
                  )}
                  <span
                    title={due.hint}
                    style={{
                      marginLeft: "auto",
                      padding: "0.18rem 0.45rem",
                      borderRadius: "var(--ec-radius-full)",
                      border: `1px solid ${due.border}`,
                      background: due.bg,
                      color: due.fg,
                      fontWeight: 800,
                    }}
                  >
                    {due.label}
                  </span>
                </div>
                {isEditing && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button type="button" className="ec-btn ec-btn--sm" onClick={() => void saveTitle(item.id)} style={smallBtn}>
                      Сохранить
                    </button>
                    <button type="button" className="ec-btn ec-btn--sm" onClick={cancelEdit} style={smallBtn}>
                      Отмена
                    </button>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <select
                    value={item.assignee?.id ?? ""}
                    onChange={(event) =>
                      void onUpdateAction?.(item.id, {
                        assigneeUserId: event.currentTarget.value || null,
                      })
                    }
                    title="Ответственный"
                    style={{
                      minWidth: 0,
                      padding: "0.35rem 0.45rem",
                      borderRadius: "var(--ec-radius-sm)",
                      border: "1px solid var(--ec-border-subtle)",
                      background: "var(--ec-surface-1)",
                      color: "var(--ec-text)",
                      fontSize: "var(--ec-text-xs)",
                    }}
                  >
                    <option value="">Без владельца</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.user.displayName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ec-btn ec-btn--sm"
                    onClick={() => void onUpdateAction?.(item.id, { assigneeUserId: currentUserId })}
                    style={smallBtn}
                  >
                    Взять
                  </button>
                  <button
                    type="button"
                    className="ec-btn ec-btn--sm"
                    onClick={() => void onUpdateAction?.(item.id, { dueAt: dueIsoInDays(0) })}
                    style={smallBtn}
                  >
                    Сегодня
                  </button>
                  <button
                    type="button"
                    className="ec-btn ec-btn--sm"
                    onClick={() => void onUpdateAction?.(item.id, { dueAt: dueIsoInDays(1) })}
                    style={smallBtn}
                  >
                    Завтра
                  </button>
                </div>
                <button
                  type="button"
                  className="ec-btn ec-btn--sm"
                  onClick={() => void onUpdateAction?.(item.id, { status: "DONE" })}
                  style={{
                    justifyContent: "center",
                    borderColor: "var(--ec-ok)",
                    color: "var(--ec-ok)",
                  }}
                >
                  Закрыть action item
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            color: "var(--ec-text-muted)",
            fontSize: "var(--ec-text-sm)",
            padding: "var(--ec-space-3)",
            borderRadius: "var(--ec-radius-lg)",
            border: "1px dashed var(--ec-border-subtle)",
            background: "color-mix(in srgb, var(--ec-surface-2) 75%, transparent)",
          }}
        >
          Пока пусто. Любое важное сообщение можно сразу перевести в рабочий объект, а не терять его в потоке.
        </div>
      )}
    </div>
  );
}
