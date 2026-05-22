import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import type { ActionItemPayload, ActionItemStatus, ActionItemType } from "../lib/socket";

/**
 * StatusBoard — Execution-доска: все ActionItem'ы сервера (across
 * channels) в 4-х статус-колонках. Часть Execution Cockpit: визуальный
 * слой — `.ec-cck-*` в cockpit.css, общий с таблицей и drawer'ом.
 *
 * v1.2.2 (R2) — переведена на cockpit-язык: module-level
 * CSSProperties-консоли и inline-стили убраны, chips/cards/columns
 * собираются из общих примитивов.
 *
 * v0.31: pre-filter integration с Team Health (`initialFilter`).
 */

/**
 * Pre-filter, который Team Health (и другие entry points) может
 * прокинуть в Board при открытии. Null = без pre-filter.
 */
export type BoardPreFilter =
  | { kind: "overdue" }
  | { kind: "unassigned" }
  | { kind: "assignee"; userId: string }
  | null;

type Props = {
  serverName: string | null;
  actions: ActionItemPayload[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  currentUserId: string;
  /** Резолв имени канала по id (из useChannels активного сервера). */
  channelNameById: (channelId: string) => string | undefined;
  onUpdateStatus: (id: string, status: ActionItemStatus) => void;
  onOpenChannel: (channelId: string) => void;
  /** v0.54: открыть ActionItemDrawer по клику на карточку. */
  onOpenAction?: (actionItemId: string) => void;
  /** Pre-filter from external trigger (Team Health stat-card click etc). */
  initialFilter?: BoardPreFilter;
};

/**
 * Pure фильтр — testable без React. AND-логика: action проходит
 * только если удовлетворяет ВСЕМ активным фильтрам. Все — opt-in.
 */
export type BoardFilters = {
  type: "ALL" | ActionItemType;
  mineOnly: boolean;
  overdueOnly: boolean;
  unassignedOnly: boolean;
  assigneeUserId: string | null;
};

export function applyBoardFilters(
  actions: ActionItemPayload[],
  filters: BoardFilters,
  currentUserId: string,
  now: number = Date.now(),
): ActionItemPayload[] {
  return actions.filter((a) => {
    if (filters.type !== "ALL" && a.type !== filters.type) return false;
    if (filters.mineOnly && a.assignee?.id !== currentUserId) return false;
    if (filters.overdueOnly) {
      if (!a.dueAt) return false;
      if (new Date(a.dueAt).getTime() >= now) return false;
      if (a.status === "DONE") return false; // overdue имеет смысл только для open
    }
    if (filters.unassignedOnly && a.assignee != null) return false;
    if (filters.assigneeUserId && a.assignee?.id !== filters.assigneeUserId) {
      return false;
    }
    return true;
  });
}

const TYPE_META: Record<ActionItemType, { glyph: string; label: string; tone: string }> = {
  TASK: { glyph: "□", label: "Задачи", tone: "var(--ec-status-exec)" },
  DECISION: { glyph: "◆", label: "Решения", tone: "var(--ec-status-ai)" },
  FOLLOW_UP: { glyph: "↻", label: "Follow-up", tone: "var(--ec-status-warn)" },
};

type TypeFilter = "ALL" | ActionItemType;

/** tone-токен для chip перетекает в `--tone` (динамика — допустимо). */
const tone = (t: string): CSSProperties => ({ "--tone": t } as CSSProperties);

function dueChip(dueAt: string | null): { label: string; tone: string } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  if (due < now) return { label: "просрочено", tone: "var(--ec-status-risk)" };
  const startTomorrow = new Date();
  startTomorrow.setHours(24, 0, 0, 0);
  if (due < startTomorrow.getTime())
    return { label: "сегодня", tone: "var(--ec-status-warn)" };
  return {
    label: new Date(dueAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
    tone: "var(--ec-text-dim)",
  };
}

/** Approval chip — PENDING warn · APPROVED exec · REJECTED danger. */
function ApprovalChip({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const map = {
    PENDING: { label: "одобрение?", tone: "var(--ec-status-warn)" },
    APPROVED: { label: "одобрено", tone: "var(--ec-status-exec)" },
    REJECTED: { label: "отклонено", tone: "var(--ec-danger)" },
  } as const;
  const meta = map[status];
  return (
    <span className="ec-cck-chip" style={tone(meta.tone)}>
      {meta.label}
    </span>
  );
}

function Card({
  item,
  channelName,
  onToggle,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  item: ActionItemPayload;
  channelName: string | undefined;
  onToggle: () => void;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const done = item.status === "DONE";
  const meta = TYPE_META[item.type];
  const chip = dueChip(item.dueAt);
  return (
    <div
      className="ec-cck-card"
      data-dragging={dragging ? "true" : "false"}
      data-done={done ? "true" : "false"}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="ec-cck-check"
        data-done={done ? "true" : "false"}
        onClick={onToggle}
        aria-label={done ? "Открыть задачу заново" : "Отметить выполненной"}
        title={done ? "Открыть заново" : "Отметить выполненной"}
      >
        {done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <button type="button" className="ec-cck-card__body" onClick={onOpen}>
        <span className="ec-cck-card__title">
          <span className="ec-cck-card__glyph" style={tone(meta.tone)} aria-hidden>
            {meta.glyph}
          </span>
          <span className="ec-cck-card__name">{item.title}</span>
        </span>
        <span className="ec-cck-card__meta">
          <span>#{channelName ?? "комната"}</span>
          {item.assignee && (
            <span className="ec-cck-user">
              <Avatar
                url={item.assignee.avatar}
                name={item.assignee.displayName}
                size={14}
              />
              <span className="ec-cck-user__name">{item.assignee.displayName}</span>
            </span>
          )}
          {chip && (
            <span className="ec-cck-chip" style={tone(chip.tone)}>
              {chip.label}
            </span>
          )}
          {item.approvalStatus !== "NONE" && (
            <ApprovalChip status={item.approvalStatus} />
          )}
          {/* blocked-by indicator — не показываем после DONE. */}
          {!done && item.blockedByOpen > 0 && (
            <span
              className="ec-cck-chip"
              style={tone("var(--ec-status-risk)")}
              title={`Блокировано: ${item.dependencies
                .filter((d) => d.status !== "DONE")
                .map((d) => d.title)
                .join(", ")}`}
            >
              блок ×{item.blockedByOpen}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

const COLUMNS: {
  key: ActionItemStatus;
  title: string;
  tone: string;
  empty: string;
}[] = [
  { key: "OPEN", title: "Открыто", tone: "var(--ec-status-warn)", empty: "Нет открытых задач" },
  { key: "IN_PROGRESS", title: "В работе", tone: "var(--ec-accent)", empty: "Ничего не в работе" },
  { key: "REVIEW", title: "Ревью", tone: "var(--ec-status-ai)", empty: "Нет на ревью" },
  { key: "DONE", title: "Сделано", tone: "var(--ec-status-exec)", empty: "Пока ничего не закрыто" },
];

export function StatusBoard({
  serverName,
  actions,
  loading,
  error,
  onReload,
  currentUserId,
  channelNameById,
  onUpdateStatus,
  onOpenChannel,
  onOpenAction,
  initialFilter,
}: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [mineOnly, setMineOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);

  // Apply initialFilter on mount + when prop changes (re-entry из TeamHealth).
  // Взаимоисключающие фильтры сбрасываются — это разные intent'ы.
  useEffect(() => {
    if (!initialFilter) return;
    if (initialFilter.kind === "overdue") {
      setOverdueOnly(true);
      setUnassignedOnly(false);
      setAssigneeFilter(null);
    } else if (initialFilter.kind === "unassigned") {
      setUnassignedOnly(true);
      setOverdueOnly(false);
      setAssigneeFilter(null);
    } else if (initialFilter.kind === "assignee") {
      setAssigneeFilter(initialFilter.userId);
      setOverdueOnly(false);
      setUnassignedOnly(false);
    }
  }, [initialFilter]);

  // Display name + avatar для chip'а assignee-filter — резолвим из actions.
  const assigneeChipInfo = useMemo(() => {
    if (!assigneeFilter) return null;
    const action = actions.find((a) => a.assignee?.id === assigneeFilter);
    if (!action?.assignee) return { displayName: "участник", avatar: null };
    return {
      displayName: action.assignee.displayName,
      avatar: action.assignee.avatar,
    };
  }, [actions, assigneeFilter]);

  const filtered = useMemo(
    () =>
      applyBoardFilters(
        actions,
        {
          type: typeFilter,
          mineOnly,
          overdueOnly,
          unassignedOnly,
          assigneeUserId: assigneeFilter,
        },
        currentUserId,
      ),
    [actions, typeFilter, mineOnly, overdueOnly, unassignedOnly, assigneeFilter, currentUserId],
  );

  // 4-status kanban — bucket на каждый статус. Items с нераспознанным
  // статусом → OPEN (backward-compat).
  const byStatus = useMemo(() => {
    const buckets: Record<ActionItemStatus, ActionItemPayload[]> = {
      OPEN: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };
    for (const a of filtered) {
      (buckets[a.status] ?? buckets.OPEN).push(a);
    }
    return buckets;
  }, [filtered]);

  // drag state — какой ActionItem drag'ается; над какой колонкой pointer.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<ActionItemStatus | null>(null);

  return (
    <div className="ec-cck">
      <div className="ec-cck__head">
        <div className="ec-cck__headline">
          <h2 className="ec-cck__title">Доска задач</h2>
          {serverName && <span className="ec-cck__sub">· {serverName}</span>}
          <span className="ec-cck__count">{filtered.length}</span>
        </div>

        <div className="ec-cck__tools">
          {(["ALL", "TASK", "DECISION", "FOLLOW_UP"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="ec-cck-filter"
              aria-pressed={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            >
              {t === "ALL" ? "Все" : TYPE_META[t].label}
            </button>
          ))}
          <button
            type="button"
            className="ec-cck-filter"
            aria-pressed={mineOnly}
            onClick={() => setMineOnly((v) => !v)}
          >
            Мои
          </button>
          <button
            type="button"
            className="ec-cck-filter"
            aria-pressed={overdueOnly}
            onClick={() => setOverdueOnly((v) => !v)}
            title="Только просроченные (срок в прошлом + не закрыто)"
          >
            Просрочено
          </button>
          <button
            type="button"
            className="ec-cck-filter"
            aria-pressed={unassignedOnly}
            onClick={() => setUnassignedOnly((v) => !v)}
            title="Только без ответственного"
          >
            Без ответственного
          </button>
          {assigneeFilter && assigneeChipInfo && (
            <span
              className="ec-cck-filter ec-cck-filter--active"
              title={`По участнику · ${assigneeChipInfo.displayName}`}
            >
              <Avatar
                url={assigneeChipInfo.avatar}
                name={assigneeChipInfo.displayName}
                size={16}
              />
              {assigneeChipInfo.displayName}
              <button
                type="button"
                className="ec-cck-filter__clear"
                onClick={() => setAssigneeFilter(null)}
                aria-label="Снять фильтр по участнику"
              >
                ✕
              </button>
            </span>
          )}
        </div>

        <div className="ec-cck__tools ec-cck__tools--end">
          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            className="ec-btn ec-btn--ghost ec-btn--sm"
          >
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

      {error && <p className="ec-cck-banner ec-cck-banner--error">{error}</p>}

      <div className="ec-cck-board ec-status-board">
        {COLUMNS.map((col) => {
          const items = byStatus[col.key];
          const isDropTarget = dropCol === col.key;
          return (
            <section
              key={col.key}
              className="ec-cck-col"
              data-drop={isDropTarget ? "true" : "false"}
              onDragEnter={() => {
                if (dragId) setDropCol(col.key);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) {
                  const dragged = filtered.find((a) => a.id === dragId);
                  if (dragged && dragged.status !== col.key) {
                    onUpdateStatus(dragId, col.key);
                  }
                }
                setDragId(null);
                setDropCol(null);
              }}
            >
              <div className="ec-cck-col__head">
                <span className="ec-cck-col__dot" style={tone(col.tone)} aria-hidden />
                {col.title}
                <span className="ec-cck-col__count">{items.length}</span>
              </div>
              <div className="ec-cck-col__body">
                {items.length === 0 ? (
                  <p className="ec-cck-empty">
                    {loading ? "Загрузка…" : col.empty}
                  </p>
                ) : (
                  items.map((item) => (
                    <Card
                      key={item.id}
                      item={item}
                      channelName={channelNameById(item.channelId)}
                      onToggle={() =>
                        onUpdateStatus(item.id, item.status === "DONE" ? "OPEN" : "DONE")
                      }
                      onOpen={() =>
                        onOpenAction
                          ? onOpenAction(item.id)
                          : onOpenChannel(item.channelId)
                      }
                      dragging={dragId === item.id}
                      onDragStart={() => setDragId(item.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropCol(null);
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
