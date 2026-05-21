import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import type { ActionItemPayload, ActionItemStatus, ActionItemType } from "../lib/socket";

/**
 * StatusBoard — Execution-доска: все ActionItem'ы сервера (across channels)
 * в двух колонках Открытые / Сделано. Calm operational board, не overloaded
 * dashboard: фильтры по типу + «мои / все», клик по карточке → переход в
 * канал-источник, чекбокс переключает статус.
 *
 * v0.31: pre-filter integration с Team Health. `initialFilter` prop ставит
 * один из 3-х filter mode'ов при mount: overdue / unassigned / by-assignee.
 * UI dismissible chip показывает active pre-filter — пользователь может
 * снять одним кликом.
 */

/**
 * Pre-filter, который Team Health (и теоретически другие entry points)
 * может прокинуть в Board при открытии. Null = без pre-filter.
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
  /** v0.54: открыть ActionItemDrawer по клику на карточку. Если undefined —
   *  старое поведение (клик = переход в канал-источник). */
  onOpenAction?: (actionItemId: string) => void;
  /** Pre-filter from external trigger (Team Health stat-card click etc). */
  initialFilter?: BoardPreFilter;
};

/**
 * Pure фильтр — testable без React. Применяется AND-логикой: action попадает
 * в результат только если проходит ВСЕ активные фильтры. Все фильтры — opt-in.
 */
export type BoardFilters = {
  type: "ALL" | ActionItemType;
  mineOnly: boolean;
  overdueOnly: boolean;
  unassignedOnly: boolean;
  /** Filter to actions assigned to this userId. Null = no filter. */
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

const wrap: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  background: "var(--ec-bg)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "var(--ec-space-4) var(--ec-space-5)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  flexWrap: "wrap",
};

const board: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  /* v0.43: было hardcoded 2-col — на mobile ломалось. Теперь auto-fit
     adaptive: ≥480px = 2 col, <480px = 1 col. Responsive.css доп. правило
     для совсем-narrow. */
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: "var(--ec-space-3)",
  padding: "var(--ec-space-4) var(--ec-space-5)",
  overflow: "auto",
};

const column: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  borderRadius: "var(--ec-radius-lg)",
  background: "var(--ec-surface-sunken)",
  // WS-1 v1.1.43: border → глубина (elevation); drop-target = подъём.
  boxShadow: "var(--ec-elev-1)",
};

const columnHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "var(--ec-space-3) var(--ec-space-3) var(--ec-space-2)",
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
};

const columnList: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "0 var(--ec-space-2) var(--ec-space-2)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

const card: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "var(--ec-space-2)",
  padding: "0.6rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  background: "var(--ec-surface-2)",
  // WS-1 v1.1.43: border → глубина (elevation); hover-lift через класс.
  boxShadow: "var(--ec-elev-1)",
};

const checkbox = (done: boolean): CSSProperties => ({
  width: 18,
  height: 18,
  borderRadius: "var(--ec-radius-xs)",
  border: `1.5px solid ${done ? "var(--ec-status-exec)" : "var(--ec-border-emphasis)"}`,
  background: done ? "var(--ec-status-exec)" : "transparent",
  color: "var(--ec-accent-text)",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  marginTop: 1,
  transition: "border-color var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
});

const filterBtn = (active: boolean): CSSProperties => ({
  padding: "0.28rem 0.6rem",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  borderRadius: "var(--ec-radius-full)",
  border: `1px solid ${active ? "var(--ec-border-accent)" : "var(--ec-border-subtle)"}`,
  background: active ? "var(--ec-accent-soft)" : "transparent",
  color: active ? "var(--ec-accent)" : "var(--ec-text-muted)",
  cursor: "pointer",
  transition: "all var(--ec-dur-fast) var(--ec-ease)",
});

const TYPE_META: Record<ActionItemType, { glyph: string; label: string; color: string }> = {
  TASK: { glyph: "□", label: "Задачи", color: "var(--ec-status-exec)" },
  DECISION: { glyph: "◆", label: "Решения", color: "var(--ec-status-ai)" },
  FOLLOW_UP: { glyph: "↻", label: "Follow-up", color: "var(--ec-status-warn)" },
};

type TypeFilter = "ALL" | ActionItemType;

function dueChip(dueAt: string | null): { label: string; color: string } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  if (due < now) return { label: "просрочено", color: "var(--ec-status-risk)" };
  const startTomorrow = new Date();
  startTomorrow.setHours(24, 0, 0, 0);
  if (due < startTomorrow.getTime())
    return { label: "сегодня", color: "var(--ec-status-warn)" };
  return {
    label: new Date(dueAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
    color: "var(--ec-text-dim)",
  };
}

/**
 * Approval chip — visible на cards с активным approval workflow.
 * PENDING = warn (ожидает), APPROVED = exec (зелёный), REJECTED = danger.
 */
function ApprovalChip({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const map = {
    PENDING: { label: "одобрение?", color: "var(--ec-status-warn)" },
    APPROVED: { label: "одобрено", color: "var(--ec-status-exec)" },
    REJECTED: { label: "отклонено", color: "var(--ec-danger)" },
  } as const;
  const meta = map[status];
  return (
    <span
      style={{
        fontSize: "0.58rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "0.08rem 0.4rem",
        borderRadius: "var(--ec-radius-full)",
        color: meta.color,
        background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)`,
      }}
    >
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
      className="ec-hover-lift ec-corner-brackets"
      style={{
        ...card,
        opacity: dragging ? 0.45 : 1,
        cursor: "grab",
        transition: "opacity var(--ec-dur-fast) var(--ec-ease)",
      }}
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
        onClick={onToggle}
        style={checkbox(done)}
        aria-label={done ? "Открыть задачу заново" : "Отметить выполненной"}
        title={done ? "Открыть заново" : "Отметить выполненной"}
      >
        {done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: "var(--ec-text-sm)",
            color: done ? "var(--ec-text-dim)" : "var(--ec-text)",
            textDecoration: done ? "line-through" : "none",
            display: "flex",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <span aria-hidden style={{ color: meta.color, fontFamily: "var(--ec-font-mono)" }}>
            {meta.glyph}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-dim)",
            flexWrap: "wrap",
          }}
        >
          <span>#{channelName ?? "комната"}</span>
          {item.assignee && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Avatar
                url={item.assignee.avatar}
                name={item.assignee.displayName}
                size={14}
              />
              {item.assignee.displayName}
            </span>
          )}
          {chip && (
            <span
              style={{
                fontSize: "0.58rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                padding: "0.08rem 0.4rem",
                borderRadius: "var(--ec-radius-full)",
                color: chip.color,
                background: `color-mix(in srgb, ${chip.color} 14%, transparent)`,
              }}
            >
              {chip.label}
            </span>
          )}
          {item.approvalStatus !== "NONE" && (
            <ApprovalChip status={item.approvalStatus} />
          )}
          {/* v0.73 #20 phase 2: blocked-by indicator. Не показываем
              после DONE — задача уже закрыта, blockers неактуальны. */}
          {!done && item.blockedByOpen > 0 && (
            <span
              title={`Блокировано: ${item.dependencies
                .filter((d) => d.status !== "DONE")
                .map((d) => d.title)
                .join(", ")}`}
              style={{
                fontSize: "0.58rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                padding: "0.08rem 0.4rem",
                borderRadius: "var(--ec-radius-full)",
                color: "var(--ec-warn)",
                background: "var(--ec-warn-soft)",
              }}
            >
              🚧 blocked × {item.blockedByOpen}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

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

  // Apply initialFilter on mount + when prop changes (re-entry from TeamHealth
  // с другим filter'ом). Сбрасываем взаимоисключающие — если пришёл overdue,
  // unassigned/assignee сбрасываются (это разные intent'ы).
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

  // Display name + avatar для chip'а assignee filter — резолвим из actions.
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

  // v0.71: 4-status kanban — отдельный bucket для каждого. Items без
  // recognized status (e.g. enum extension в будущем) попадают в OPEN
  // для backward-compat.
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

  // v0.71: drag state — какой ActionItem сейчас drag'ается; over какой
  // column сейчас pointer. Drop = onUpdateStatus с target column.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<ActionItemStatus | null>(null);

  return (
    <div style={wrap}>
      <div style={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--ec-text-dim)",
              fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
            }}
          >
            EXECUTION_BOARD //
          </span>
          <strong
            style={{
              color: "var(--ec-text-strong)",
              fontSize: "var(--ec-text-lg)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--ec-font-display, var(--ec-font-sans))",
            }}
          >
            Доска задач{serverName ? ` · ${serverName}` : ""}
          </strong>
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: "var(--ec-space-3)", flexWrap: "wrap", alignItems: "center" }}>
          {(["ALL", "TASK", "DECISION", "FOLLOW_UP"] as const).map((t) => (
            <button
              key={t}
              type="button"
              style={filterBtn(typeFilter === t)}
              onClick={() => setTypeFilter(t)}
            >
              {t === "ALL" ? "Все" : TYPE_META[t].label}
            </button>
          ))}
          <button
            type="button"
            style={filterBtn(mineOnly)}
            onClick={() => setMineOnly((v) => !v)}
          >
            Мои
          </button>
          <button
            type="button"
            style={filterBtn(overdueOnly)}
            onClick={() => setOverdueOnly((v) => !v)}
            title="Только просроченные (dueAt в прошлом + не закрыто)"
          >
            Просрочено
          </button>
          <button
            type="button"
            style={filterBtn(unassignedOnly)}
            onClick={() => setUnassignedOnly((v) => !v)}
            title="Только без ответственного"
          >
            Без ответственного
          </button>
          {assigneeFilter && assigneeChipInfo && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0.25rem 0.55rem 0.25rem 0.3rem",
                borderRadius: "var(--ec-radius-full)",
                border: "1px solid var(--ec-border-accent)",
                background: "var(--ec-accent-soft)",
                color: "var(--ec-accent)",
                fontSize: "var(--ec-text-2xs)",
                fontWeight: 600,
              }}
              title={`По участнику · ${assigneeChipInfo.displayName}`}
            >
              <Avatar url={assigneeChipInfo.avatar} name={assigneeChipInfo.displayName} size={20} />
              {assigneeChipInfo.displayName}
              <button
                type="button"
                onClick={() => setAssigneeFilter(null)}
                aria-label="Снять фильтр по участнику"
                style={{
                  marginLeft: 2,
                  background: "transparent",
                  border: 0,
                  color: "inherit",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ✕
              </button>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          className="ec-btn ec-btn--ghost ec-btn--sm"
          style={{ marginLeft: "auto" }}
        >
          {loading ? "Обновляем…" : "Обновить"}
        </button>
      </div>

      {error && (
        <p
          style={{
            margin: "var(--ec-space-2) var(--ec-space-5) 0",
            color: "var(--ec-danger)",
            background: "var(--ec-danger-soft)",
            padding: "var(--ec-space-2) var(--ec-space-3)",
            borderRadius: "var(--ec-radius-md)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          {error}
        </p>
      )}

      <div className="ec-status-board" style={board}>
        {(
          [
            { key: "OPEN", title: "Открыто", items: byStatus.OPEN, color: "var(--ec-status-warn)", empty: "Нет открытых задач" },
            { key: "IN_PROGRESS", title: "В работе", items: byStatus.IN_PROGRESS, color: "var(--ec-accent)", empty: "Ничего не в работе" },
            { key: "REVIEW", title: "Ревью", items: byStatus.REVIEW, color: "var(--ec-status-ai, var(--ec-accent))", empty: "Нет на ревью" },
            { key: "DONE", title: "Сделано", items: byStatus.DONE, color: "var(--ec-status-exec)", empty: "Пока ничего не закрыто" },
          ] as const
        ).map((col) => {
          const isDropTarget = dropCol === col.key;
          return (
            <section
              key={col.key}
              style={{
                ...column,
                boxShadow: isDropTarget
                  ? "var(--ec-elev-2)"
                  : "var(--ec-elev-1)",
                background: isDropTarget
                  ? "color-mix(in srgb, var(--ec-accent) 6%, hsl(208 16% 9% / 0.55))"
                  : "hsl(208 16% 9% / 0.55)",
                transition:
                  "box-shadow var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
              }}
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
              <div style={columnHead}>
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: col.color,
                  }}
                />
                {col.title}
                <span style={{ marginLeft: "auto", color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>
                  {col.items.length}
                </span>
              </div>
              <div style={columnList}>
                {col.items.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      padding: "var(--ec-space-4) var(--ec-space-2)",
                      color: "var(--ec-text-dim)",
                      fontSize: "var(--ec-text-sm)",
                      textAlign: "center",
                    }}
                  >
                    {loading ? "Загрузка…" : col.empty}
                  </p>
                ) : (
                  col.items.map((item) => (
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
