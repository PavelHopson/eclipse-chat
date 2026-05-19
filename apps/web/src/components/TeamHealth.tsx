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
  fontFamily: "var(--ec-font-display, var(--ec-font-sans))",
  fontFeatureSettings: '"tnum"',
};

const statLabel: CSSProperties = {
  fontSize: "0.6rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 600,
  opacity: 0.78,
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
};

const statHint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  marginTop: "var(--ec-space-1)",
};

const sectionLabel: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  margin: 0,
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
  display: "flex",
  alignItems: "center",
  gap: 8,
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
  fontWeight: 700,
  color: "var(--ec-text-strong)",
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  flex: 1,
  minWidth: 0,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "var(--ec-font-display, var(--ec-font-sans))",
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
          className="ec-btn ec-btn--ghost ec-btn--sm ec-shimmer-sweep"
          title="Пересчитать"
        >
          <span>{loading ? "СИНХРОНИЗАЦИЯ…" : "ОБНОВИТЬ"}</span>
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

        {!error && loading && !data && (
          <div className="ec-team-health-stats" style={grid} aria-label="Считаем здоровье команды">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ec-skeleton-card" />
            ))}
          </div>
        )}

        {!error && isEmpty && (
          <EmptyState
            icon={<EmptyHealthIcon />}
            title="Пока нечего считать"
            hint="В пространстве ещё нет задач или решений. Создавайте их через /task в композере или hover-меню сообщения — здесь появится операционная сводка."
          />
        )}

        {!error && !isEmpty && data && (
          <>
            <div className="ec-team-health-stats" style={grid}>
              <button
                type="button"
                className="ec-lift-md ec-press ec-corner-brackets"
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
                className="ec-lift-md ec-press ec-corner-brackets"
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
                className="ec-lift-md ec-press ec-corner-brackets"
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
              <div style={{ ...statCardStyle("idle"), cursor: "default" }}>
                <span style={statLabel}>Время первого ответа</span>
                <span style={statValue}>
                  {data.responseTime.medianMs === null
                    ? "—"
                    : formatDuration(data.responseTime.medianMs)}
                </span>
                <span style={statHint}>
                  {data.responseTime.medianMs === null
                    ? `обсуждений < 5 за ${data.responseTime.windowDays} дн`
                    : `медиана по ${data.responseTime.sampleSize} обсуждений`}
                </span>
              </div>
            </div>

            {/* v0.60: Trends week-over-week */}
            <TrendsRibbon trends={data.trends} />

            {/* v0.60: Per-channel breakdown */}
            <PerChannelSection rows={data.perChannel} />

            {data.topOverloaded.length > 0 && (
              <section
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--ec-space-2)",
                }}
              >
                <h3 style={sectionLabel}><span aria-hidden style={{ color: "var(--ec-status-risk)" }}>◆</span>Кто перегружен</h3>
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

/* ============================================================
 * v0.60 #12 Team Health v3 — trends + perChannel
 * ============================================================
 */

function formatDuration(ms: number): string {
  if (ms < 60_000) {
    const secs = Math.max(1, Math.round(ms / 1000));
    return `${secs} c`;
  }
  if (ms < 3_600_000) {
    const mins = Math.round(ms / 60_000);
    return `${mins} мин`;
  }
  if (ms < 86_400_000) {
    const hours = ms / 3_600_000;
    return `${hours.toFixed(1)} ч`;
  }
  const days = ms / 86_400_000;
  return `${days.toFixed(1)} д`;
}

type TrendCellTone = "exec" | "warn" | "idle";

function TrendsRibbon({
  trends,
}: {
  trends: { thisWeek: { created: number; closed: number }; prevWeek: { created: number; closed: number } };
}) {
  // Hide ribbon если совсем нет активности в обоих окнах — calm UI.
  const total =
    trends.thisWeek.created +
    trends.thisWeek.closed +
    trends.prevWeek.created +
    trends.prevWeek.closed;
  if (total === 0) return null;
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ec-space-2)",
      }}
    >
      <h3 style={sectionLabel}><span aria-hidden style={{ color: "var(--ec-status-exec)" }}>◆</span>За эту неделю</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--ec-space-2)",
        }}
      >
        <TrendCell
          label="Создано"
          current={trends.thisWeek.created}
          previous={trends.prevWeek.created}
          tone="idle"
        />
        <TrendCell
          label="Закрыто"
          current={trends.thisWeek.closed}
          previous={trends.prevWeek.closed}
          tone="exec"
        />
      </div>
    </section>
  );
}

function TrendCell({
  label,
  current,
  previous,
  tone,
}: {
  label: string;
  current: number;
  previous: number;
  tone: TrendCellTone;
}) {
  const delta = current - previous;
  const pct =
    previous === 0
      ? current === 0
        ? 0
        : 100
      : Math.round(((current - previous) / previous) * 100);
  // Positive delta для "Закрыто" = good (exec colour). Для "Создано" — neutral
  // (просто сигнал волатильности, без оценки).
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const goodDirection = tone === "exec" ? isPositive : false;
  const badDirection = tone === "exec" ? isNegative : false;
  const arrow = delta === 0 ? "→" : isPositive ? "↑" : "↓";
  const arrowColor = goodDirection
    ? "var(--ec-status-exec)"
    : badDirection
    ? "var(--ec-status-warn)"
    : "var(--ec-text-muted)";
  return (
    <div
      style={{
        padding: "var(--ec-space-3) var(--ec-space-4)",
        background: "var(--ec-surface-2)",
        border: "1px solid var(--ec-border-subtle)",
        borderRadius: "var(--ec-radius-md)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: "var(--ec-text-2xs)",
          color: "var(--ec-text-dim)",
          letterSpacing: "var(--ec-tracking-caps)",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--ec-text-strong)",
            fontFamily: "var(--ec-font-mono)",
            fontFeatureSettings: '"tnum"',
          }}
        >
          {current}
        </span>
        <span style={{ color: arrowColor, fontSize: "var(--ec-text-sm)" }}>
          {arrow}{" "}
          {delta === 0
            ? "без изменений"
            : `${delta > 0 ? "+" : ""}${delta} (${pct > 0 ? "+" : ""}${pct}%)`}
        </span>
      </div>
      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
        пред. неделя: {previous}
      </span>
    </div>
  );
}

function PerChannelSection({
  rows,
}: {
  rows: import("../hooks/useTeamHealth").ChannelBreakdown[];
}) {
  if (rows.length === 0) return null;
  // Limit отображаемых строк — не больше 8, остальное collapses в "ещё N".
  const TOP_LIMIT = 8;
  const top = rows.slice(0, TOP_LIMIT);
  const overflow = rows.length - top.length;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ec-space-2)",
      }}
    >
      <h3 style={sectionLabel}><span aria-hidden style={{ color: "var(--ec-accent)" }}>◆</span>По комнатам</h3>
      <div
        style={{
          background: "var(--ec-surface-2)",
          border: "1px solid var(--ec-border-subtle)",
          borderRadius: "var(--ec-radius-md)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 70px 80px 80px",
            gap: 0,
            padding: "var(--ec-space-2) var(--ec-space-3)",
            background: "var(--ec-surface-3)",
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-dim)",
            textTransform: "uppercase",
            letterSpacing: "var(--ec-tracking-wide)",
            fontWeight: 700,
            borderBottom: "1px solid var(--ec-border-subtle)",
          }}
        >
          <span>Комната</span>
          <span style={{ textAlign: "right" }}>Открыто</span>
          <span style={{ textAlign: "right" }}>Просроч.</span>
          <span style={{ textAlign: "right" }}>Закрыто</span>
        </div>
        {top.map((row) => (
          <div
            key={row.channelId}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 80px 80px",
              padding: "var(--ec-space-2) var(--ec-space-3)",
              borderBottom: "1px solid var(--ec-border-subtle)",
              fontSize: "var(--ec-text-sm)",
              alignItems: "center",
            }}
          >
            <span
              style={{
                color: "var(--ec-text-strong)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: "var(--ec-accent)" }}>
                {row.channelType === "VOICE"
                  ? "🔊"
                  : row.channelType === "BROADCAST"
                  ? "📢"
                  : "#"}
              </span>{" "}
              {row.channelName ?? "—"}
            </span>
            <span
              style={{
                textAlign: "right",
                fontFamily: "var(--ec-font-mono)",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {row.open}
            </span>
            <span
              style={{
                textAlign: "right",
                fontFamily: "var(--ec-font-mono)",
                fontFeatureSettings: '"tnum"',
                color: row.overdue > 0 ? "var(--ec-status-warn)" : "var(--ec-text-dim)",
              }}
            >
              {row.overdue}
            </span>
            <span
              style={{
                textAlign: "right",
                fontFamily: "var(--ec-font-mono)",
                fontFeatureSettings: '"tnum"',
                color: row.closed > 0 ? "var(--ec-status-exec)" : "var(--ec-text-dim)",
              }}
            >
              {row.closed}
            </span>
          </div>
        ))}
        {overflow > 0 && (
          <div
            style={{
              padding: "var(--ec-space-2) var(--ec-space-3)",
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-dim)",
              textAlign: "center",
            }}
          >
            и ещё {overflow}
          </div>
        )}
      </div>
    </section>
  );
}
