import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import type { ActionItemPayload, ActionItemType } from "../lib/socket";

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
  onUpdateStatus: (id: string, status: "OPEN" | "DONE") => void;
  onOpenChannel: (channelId: string) => void;
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
  background: "hsl(208 16% 9% / 0.55)",
  border: "1px solid var(--ec-border-subtle)",
};

const columnHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "var(--ec-space-3) var(--ec-space-3) var(--ec-space-2)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
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
  border: "1px solid var(--ec-border-subtle)",
};

const checkbox = (done: boolean): CSSProperties => ({
  width: 18,
  height: 18,
  borderRadius: "var(--ec-radius-xs)",
  border: `1.5px solid ${done ? "var(--ec-status-exec)" : "var(--ec-border-emphasis)"}`,
  background: done ? "var(--ec-status-exec)" : "transparent",
  color: "#fff",
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

function Card({
  item,
  channelName,
  onToggle,
  onOpen,
}: {
  item: ActionItemPayload;
  channelName: string | undefined;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const done = item.status === "DONE";
  const meta = TYPE_META[item.type];
  const chip = dueChip(item.dueAt);
  return (
    <div className="ec-hover-lift" style={card}>
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
          <span>#{channelName ?? "канал"}</span>
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

  const open = filtered.filter((a) => a.status === "OPEN");
  const done = filtered.filter((a) => a.status === "DONE");

  return (
    <div style={wrap}>
      <div style={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontSize: "var(--ec-text-2xs)",
              fontWeight: 800,
              letterSpacing: "var(--ec-tracking-caps)",
              textTransform: "uppercase",
              color: "var(--ec-text-dim)",
            }}
          >
            Execution
          </span>
          <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-lg)" }}>
            Доска задач{serverName ? ` — ${serverName}` : ""}
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

      <div style={board}>
        {(
          [
            { key: "open", title: "Открытые", items: open, color: "var(--ec-status-warn)" },
            { key: "done", title: "Сделано", items: done, color: "var(--ec-status-exec)" },
          ] as const
        ).map((col) => (
          <section key={col.key} style={column}>
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
                  {loading
                    ? "Загрузка…"
                    : col.key === "open"
                    ? "Нет открытых задач"
                    : "Пока ничего не закрыто"}
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
                    onOpen={() => onOpenChannel(item.channelId)}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
