import type { CSSProperties } from "react";
import { Avatar } from "./Avatar";
import { EmptyState } from "./EmptyState";
import { EmptyHealthIcon } from "./EmptyIcons";
import type { TeamHealthData } from "../hooks/useTeamHealth";

/**
 * TeamHealth — calm operator dashboard поверх ActionItem'ов сервера.
 *
 * Структура:
 *   - 4 stat-карточки (Открыто / Просрочено / Без ответственного /
 *     Среднее закрытие). Кликабельны где имеет смысл — переход в
 *     Status Board с pre-filter.
 *   - «Перегружены» секция — top-3 members + чип «blocked» если 3+ open.
 *   - Empty-state — calm, без шума, если нет ActionItem'ов вообще.
 *
 * Не делаем графики / trendlines (нет исторических snapshot'ов в DB).
 * Не делаем response-time computation (дорого + median требует window-функций).
 * Это минимально-достаточный «здоровье команды» view.
 */

type Props = {
  serverName: string | null;
  data: TeamHealthData | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onClose: () => void;
  /**
   * Открыть Status Board с opt-in фильтром. filter="overdue" | "unassigned"
   * | { assigneeUserId } | null (без фильтра).
   */
  onOpenBoard: (filter: BoardFilter) => void;
};

export type BoardFilter =
  | { kind: "overdue" }
  | { kind: "unassigned" }
  | { kind: "assignee"; userId: string }
  | null;

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

const body: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "var(--ec-space-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-5)",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "var(--ec-space-3)",
};

function statCardStyle(tone: "exec" | "warn" | "idle" | "risk"): CSSProperties {
  const toneColors: Record<typeof tone, { fg: string; bg: string; border: string }> = {
    exec: {
      fg: "hsl(195 85% 70%)",
      bg: "hsl(195 75% 60% / 0.08)",
      border: "hsl(195 75% 55% / 0.35)",
    },
    warn: {
      fg: "hsl(38 95% 70%)",
      bg: "hsl(38 90% 60% / 0.08)",
      border: "hsl(38 90% 55% / 0.35)",
    },
    idle: {
      fg: "hsl(215 85% 75%)",
      bg: "hsl(215 70% 65% / 0.08)",
      border: "hsl(215 70% 60% / 0.35)",
    },
    risk: {
      fg: "hsl(0 70% 70%)",
      bg: "hsl(0 60% 55% / 0.08)",
      border: "hsl(0 60% 50% / 0.35)",
    },
  };
  const c = toneColors[tone];
  return {
    padding: "var(--ec-space-4)",
    background: c.bg,
    border: `1px solid ${c.border}`,
    borderRadius: "var(--ec-radius-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--ec-space-1)",
    color: c.fg,
    cursor: "pointer",
    transition: "transform var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
    fontFamily: "inherit",
    textAlign: "left",
    width: "100%",
  };
}

const statValue: CSSProperties = {
  fontSize: "2.2rem",
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "-0.02em",
};

const statLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  fontWeight: 700,
  opacity: 0.78,
};

const statHint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  marginTop: "var(--ec-space-1)",
};

const sectionLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  margin: 0,
};

const overloadRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  cursor: "pointer",
  transition: "border-color var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
};

const overloadCount: CSSProperties = {
  fontFamily: "var(--ec-font-mono)",
  fontSize: "var(--ec-text-base)",
  fontWeight: 700,
  color: "var(--ec-text-strong)",
};

const blockedChip: CSSProperties = {
  marginLeft: "var(--ec-space-2)",
  padding: "0.05rem 0.4rem",
  fontSize: "0.62rem",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  borderRadius: "var(--ec-radius-full)",
  background: "hsl(0 60% 55% / 0.14)",
  color: "hsl(0 70% 70%)",
  border: "1px solid hsl(0 60% 50% / 0.45)",
};

const chatTitle: CSSProperties = {
  fontSize: "var(--ec-text-base)",
  fontWeight: 600,
  color: "var(--ec-text-strong)",
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  flex: 1,
  minWidth: 0,
};

function HeartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ec-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function TeamHealth({
  serverName,
  data,
  loading,
  error,
  onReload,
  onClose,
  onOpenBoard,
}: Props) {
  const overdue = data?.counts.overdueTotal ?? 0;
  const unassigned = data?.counts.unassignedTotal ?? 0;
  const open = data?.counts.openTotal ?? 0;
  const blockedSet = new Set(data?.blockedMembers.map((m) => m.userId) ?? []);

  const isEmpty =
    !loading &&
    !error &&
    data !== null &&
    data.counts.openTotal === 0 &&
    data.counts.resolvedInWindow === 0;

  return (
    <div style={wrap}>
      <div style={header}>
        <span style={chatTitle}>
          <HeartIcon />
          Здоровье команды
          {serverName && (
            <span
              style={{
                color: "var(--ec-text-dim)",
                fontWeight: 400,
                fontSize: "var(--ec-text-sm)",
              }}
            >
              · {serverName}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          className="ec-btn ec-btn--ghost ec-btn--sm"
          title="Пересчитать"
        >
          {loading ? "Считаем…" : "Обновить"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ec-btn ec-btn--ghost ec-btn--sm"
          title="Закрыть"
        >
          ✕
        </button>
      </div>

      <div style={body}>
        {error && (
          <div
            style={{
              padding: "var(--ec-space-3)",
              borderRadius: "var(--ec-radius-md)",
              background: "var(--ec-danger-soft)",
              color: "var(--ec-danger)",
              border: "1px solid var(--ec-danger)",
              fontSize: "var(--ec-text-sm)",
            }}
          >
            {error}
          </div>
        )}

        {!error && isEmpty && (
          <EmptyState
            icon={<EmptyHealthIcon />}
            title="Пока нечего считать"
            hint="На сервере ещё нет задач или решений. Создавайте их через /task в композере или hover-меню сообщения — здесь появится операционная сводка."
          />
        )}

        {!error && !isEmpty && data && (
          <>
            <div style={grid}>
              <button
                type="button"
                className="ec-lift-md ec-press"
                style={statCardStyle("exec")}
                onClick={() => onOpenBoard(null)}
                title="Открыть Доску задач"
              >
                <span style={statLabel}>Открыто</span>
                <span style={statValue}>{open}</span>
                <span style={statHint}>задач, решений и follow-up</span>
              </button>
              <button
                type="button"
                className="ec-lift-md ec-press"
                style={statCardStyle("warn")}
                onClick={() => onOpenBoard({ kind: "overdue" })}
                title="Открыть Доску задач — только просроченные"
                disabled={overdue === 0}
              >
                <span style={statLabel}>Просрочено</span>
                <span style={statValue}>{overdue}</span>
                <span style={statHint}>
                  {overdue === 0 ? "сроки соблюдаются" : "нужно внимание"}
                </span>
              </button>
              <button
                type="button"
                className="ec-lift-md ec-press"
                style={statCardStyle("idle")}
                onClick={() => onOpenBoard({ kind: "unassigned" })}
                title="Открыть Доску задач — без ответственного"
                disabled={unassigned === 0}
              >
                <span style={statLabel}>Без ответственного</span>
                <span style={statValue}>{unassigned}</span>
                <span style={statHint}>
                  {unassigned === 0 ? "все назначены" : "кто возьмёт?"}
                </span>
              </button>
              <div style={{ ...statCardStyle("exec"), cursor: "default" }}>
                <span style={statLabel}>Среднее закрытие</span>
                <span style={statValue}>
                  {data.avgResolutionDays === null
                    ? "—"
                    : `${data.avgResolutionDays} дн`}
                </span>
                <span style={statHint}>
                  {data.avgResolutionDays === null
                    ? `закрыто < 3 за ${data.windowDays} дн`
                    : `за последние ${data.windowDays} дней (${data.counts.resolvedInWindow} закрыто)`}
                </span>
              </div>
            </div>

            {data.topOverloaded.length > 0 && (
              <section
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--ec-space-2)",
                }}
              >
                <h3 style={sectionLabel}>Кто перегружен</h3>
                {data.topOverloaded.map((m) => {
                  const isBlocked = blockedSet.has(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      className="ec-hover-lift ec-press"
                      style={overloadRow}
                      onClick={() =>
                        onOpenBoard({ kind: "assignee", userId: m.userId })
                      }
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--ec-border-default)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
                      }}
                      title={`Открыть задачи ${m.displayName}`}
                    >
                      <Avatar url={m.avatar} name={m.displayName} size={36} />
                      <div style={{ minWidth: 0, textAlign: "left" }}>
                        <div
                          style={{
                            color: "var(--ec-text-strong)",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          {m.displayName}
                          {isBlocked && <span style={blockedChip}>blocked</span>}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--ec-text-2xs)",
                            color: "var(--ec-text-dim)",
                            marginTop: 2,
                          }}
                        >
                          {isBlocked
                            ? "3 и больше открытых — возможно нужна разгрузка"
                            : "открытые задачи"}
                        </div>
                      </div>
                      <div style={overloadCount}>{m.openCount}</div>
                    </button>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
