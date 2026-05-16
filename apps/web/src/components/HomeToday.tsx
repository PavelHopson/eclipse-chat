import type { CSSProperties } from "react";
import type { HomeTodayData } from "../hooks/useHomeToday";

/**
 * HomeToday — операционный Home-экран «СЕГОДНЯ». Не список серверов, а
 * сводка «что происходит в системе»: назначенные задачи, активные
 * инциденты, живые голосовые сессии. Calm operational system, не noisy
 * gamer chat.
 */

type Props = {
  userName: string;
  data: HomeTodayData | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  serversCount: number;
  dmCount: number;
  /** Перейти в канал (serverId, channelId) — закрывает Home. */
  onOpenChannel: (serverId: string, channelId: string) => void;
  onOpenServer: () => void;
  onOpenDms: () => void;
  onCreateServer: () => void;
};

const wrap: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "var(--ec-space-6) var(--ec-space-6) var(--ec-space-8)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-5)",
  maxWidth: 920,
  width: "100%",
  margin: "0 auto",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "var(--ec-space-3)",
  flexWrap: "wrap",
};

const eyebrow: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
};

const statRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "var(--ec-space-3)",
};

function statCard(color: string): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "var(--ec-space-3) var(--ec-space-4)",
    borderRadius: "var(--ec-radius-lg)",
    background: "hsl(208 16% 10% / 0.6)",
    boxShadow: `inset 3px 0 0 0 ${color}, 0 8px 24px -16px hsl(210 40% 2% / 0.7)`,
  };
}

const statValue: CSSProperties = {
  fontSize: "var(--ec-text-2xl)",
  fontWeight: 700,
  fontFeatureSettings: '"tnum"',
  lineHeight: 1,
  color: "var(--ec-text-strong)",
};

const statLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "var(--ec-tracking-wide)",
};

const sectionTitle: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  margin: "0 0 var(--ec-space-2) 0",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const rowBtn: CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "0.6rem 0.8rem",
  borderRadius: "var(--ec-radius-md)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  color: "var(--ec-text)",
  cursor: "pointer",
  textAlign: "left",
  transition:
    "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const ctxLine: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function dueChip(overdue: boolean, dueAt: string | null): { label: string; color: string } | null {
  if (!dueAt) return null;
  if (overdue) return { label: "просрочено", color: "var(--ec-status-risk)" };
  const due = new Date(dueAt).getTime();
  const startTomorrow = new Date();
  startTomorrow.setHours(24, 0, 0, 0);
  if (due < startTomorrow.getTime()) return { label: "сегодня", color: "var(--ec-status-warn)" };
  return {
    label: new Date(dueAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
    color: "var(--ec-text-dim)",
  };
}

function typeGlyph(type: "TASK" | "DECISION" | "FOLLOW_UP"): string {
  if (type === "DECISION") return "◆";
  if (type === "FOLLOW_UP") return "↻";
  return "□";
}

function relativeShort(iso: string): string {
  const dh = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (dh < 1) return "только что";
  if (dh < 24) return `${dh}ч назад`;
  const dd = Math.round(dh / 24);
  return `${dd}д назад`;
}

function Row({
  onClick,
  glyph,
  glyphColor,
  title,
  context,
  trailing,
}: {
  onClick: () => void;
  glyph: React.ReactNode;
  glyphColor: string;
  title: string;
  context: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ec-home-today-row"
      style={rowBtn}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--ec-surface-3)";
        e.currentTarget.style.borderColor = "var(--ec-border-default)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--ec-surface-2)";
        e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
      }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--ec-radius-sm)",
          background: `color-mix(in srgb, ${glyphColor} 14%, transparent)`,
          color: glyphColor,
          fontSize: "var(--ec-text-sm)",
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--ec-text-sm)",
            color: "var(--ec-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
        <span style={ctxLine}>{context}</span>
      </span>
      {trailing}
    </button>
  );
}

export function HomeToday({
  userName,
  data,
  loading,
  error,
  onReload,
  serversCount,
  dmCount,
  onOpenChannel,
  onOpenServer,
  onOpenDms,
  onCreateServer,
}: Props) {
  const counts = data?.counts ?? { tasks: 0, overdue: 0, incidents: 0, activeVoice: 0 };
  const isEmpty =
    !loading &&
    !error &&
    data != null &&
    data.assignedTasks.length === 0 &&
    data.incidents.length === 0 &&
    data.activeVoice.length === 0;

  return (
    <div style={wrap} className="ec-home">
      <header className="ec-home-today__header" style={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={eyebrow}>Операционная сводка</span>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--ec-text-2xl)",
              color: "var(--ec-text-strong)",
              letterSpacing: "var(--ec-tracking-tight)",
            }}
          >
            Сегодня, {userName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          className="ec-btn ec-btn--ghost ec-btn--sm"
        >
          {loading ? "Обновляем…" : "Обновить"}
        </button>
      </header>

      {error && (
        <p
          style={{
            margin: 0,
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

      {/* Operational stat cards */}
      <div className="ec-home-today__stats" style={statRow}>
        <div className="ec-home-stat-card ec-home-stat-card--exec" style={statCard("var(--ec-status-exec)")}>
          <span style={statValue}>{counts.tasks}</span>
          <span style={statLabel}>Задач на мне</span>
        </div>
        <div className="ec-home-stat-card ec-home-stat-card--risk" style={statCard("var(--ec-status-risk)")}>
          <span style={{ ...statValue, color: counts.overdue > 0 ? "var(--ec-status-risk)" : "var(--ec-text-strong)" }}>
            {counts.overdue}
          </span>
          <span style={statLabel}>Просрочено</span>
        </div>
        <div className="ec-home-stat-card ec-home-stat-card--warn" style={statCard("var(--ec-status-warn)")}>
          <span style={{ ...statValue, color: counts.incidents > 0 ? "var(--ec-status-warn)" : "var(--ec-text-strong)" }}>
            {counts.incidents}
          </span>
          <span style={statLabel}>Инцидентов</span>
        </div>
        <div className="ec-home-stat-card ec-home-stat-card--idle" style={statCard("var(--ec-status-idle)")}>
          <span style={statValue}>{counts.activeVoice}</span>
          <span style={statLabel}>Голосовых сессий</span>
        </div>
      </div>

      {isEmpty && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "var(--ec-space-8) var(--ec-space-4)",
            textAlign: "center",
            color: "var(--ec-text-muted)",
          }}
        >
          <span
            className="ec-anim-limbus"
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 50% 40%, hsl(152 58% 52% / 0.24), transparent 70%)",
              display: "grid",
              placeItems: "center",
              color: "var(--ec-status-exec)",
              fontSize: "1.4rem",
            }}
          >
            ✓
          </span>
          <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-md)" }}>
            Всё под контролем
          </strong>
          <span style={{ fontSize: "var(--ec-text-sm)", maxWidth: 360 }}>
            Нет задач на тебе, открытых инцидентов и активных голосовых сессий.
            Можно открыть workspace или личные сообщения.
          </span>
        </div>
      )}

      {/* Assigned tasks */}
      {data && data.assignedTasks.length > 0 && (
        <section>
          <h3 style={sectionTitle}>
            <span aria-hidden style={{ color: "var(--ec-status-exec)" }}>▸</span>
            Назначено мне
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
            {data.assignedTasks.map((t) => {
              const chip = dueChip(t.overdue, t.dueAt);
              return (
                <Row
                  key={t.id}
                  onClick={() => onOpenChannel(t.serverId, t.channelId)}
                  glyph={typeGlyph(t.type)}
                  glyphColor={t.overdue ? "var(--ec-status-risk)" : "var(--ec-status-exec)"}
                  title={t.title}
                  context={`${t.serverName} · #${t.channelName}`}
                  trailing={
                    chip ? (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          padding: "0.12rem 0.45rem",
                          borderRadius: "var(--ec-radius-full)",
                          color: chip.color,
                          background: `color-mix(in srgb, ${chip.color} 14%, transparent)`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {chip.label}
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Open incidents */}
      {data && data.incidents.length > 0 && (
        <section>
          <h3 style={sectionTitle}>
            <span aria-hidden style={{ color: "var(--ec-status-warn)" }}>▸</span>
            Активные инциденты
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
            {data.incidents.map((i) => (
              <Row
                key={i.id}
                onClick={() => i.channelId && onOpenChannel(i.serverId, i.channelId)}
                glyph="🚨"
                glyphColor="var(--ec-status-risk)"
                title={i.title}
                context={`${i.serverName} · открыт ${relativeShort(i.openedAt)}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Active voice */}
      {data && data.activeVoice.length > 0 && (
        <section>
          <h3 style={sectionTitle}>
            <span aria-hidden style={{ color: "var(--ec-status-idle)" }}>▸</span>
            Голосовые сессии
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
            {data.activeVoice.map((vch) => (
              <Row
                key={vch.channelId}
                onClick={() => onOpenChannel(vch.serverId, vch.channelId)}
                glyph={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                  </svg>
                }
                glyphColor="var(--ec-status-idle)"
                title={vch.channelName}
                context={vch.serverName}
                trailing={
                  <span
                    style={{
                      fontSize: "var(--ec-text-2xs)",
                      color: "var(--ec-status-exec)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {vch.count} в эфире
                  </span>
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <div
        className="ec-home-quick-actions"
        style={{
          display: "flex",
          gap: "var(--ec-space-2)",
          flexWrap: "wrap",
          marginTop: "auto",
          paddingTop: "var(--ec-space-3)",
          borderTop: "1px solid var(--ec-border-subtle)",
        }}
      >
        <button type="button" className="ec-btn ec-btn--sm" onClick={onOpenServer}>
          Открыть workspace ({serversCount})
        </button>
        <button type="button" className="ec-btn ec-btn--sm" onClick={onOpenDms}>
          Личные сообщения{dmCount > 0 ? ` (${dmCount})` : ""}
        </button>
        <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={onCreateServer}>
          + Создать workspace
        </button>
      </div>
    </div>
  );
}
