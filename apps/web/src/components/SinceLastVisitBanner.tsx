import type { CSSProperties } from "react";
import type { SinceLastVisitData } from "../hooks/useSinceLastVisit";

/**
 * SinceLastVisitBanner — AI Memory card «Пока тебя не было».
 *
 * Рендерится ТОЛЬКО если:
 *   1) есть `priorVisitAt` (не первый заход в канал),
 *   2) с момента prior прошло > 30 минут (не re-open),
 *   3) есть какая-то дельта (сообщения / actions / pinned / incident).
 *
 * Calm operational digest, не AI-prose: счётчики + 2-3 recent items.
 * LLM-сводка прозы — отдельная follow-up фича (AI summary button).
 */

const MIN_GAP_MS = 30 * 60 * 1000; // 30 минут

type Props = {
  data: SinceLastVisitData | null;
  onDismiss: () => void;
  onOpenAction?: (channelId: string) => void;
};

const wrap: CSSProperties = {
  margin: "var(--ec-space-3) var(--ec-space-5) 0",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  borderRadius: "var(--ec-radius-lg)",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--ec-status-ai) 8%, transparent), color-mix(in srgb, var(--ec-accent) 4%, transparent))",
  border: "1px solid color-mix(in srgb, var(--ec-status-ai) 32%, transparent)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
  position: "relative",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-status-ai)",
};

const counterRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--ec-space-3)",
  fontSize: "var(--ec-text-sm)",
  color: "var(--ec-text)",
  fontFeatureSettings: '"tnum"',
};

const counter = (label: string, value: number, color: string) =>
  value > 0
    ? (
        <span key={label} style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
          <strong style={{ color, fontSize: "var(--ec-text-md)", fontWeight: 700 }}>{value}</strong>
          <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-2xs)" }}>{label}</span>
        </span>
      )
    : null;

function typeGlyph(type: "TASK" | "DECISION" | "FOLLOW_UP"): string {
  if (type === "DECISION") return "◆";
  if (type === "FOLLOW_UP") return "↻";
  return "□";
}

function relativeShort(iso: string): string {
  const dh = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (dh < 1) return "меньше часа назад";
  if (dh < 24) return `${dh}ч назад`;
  const dd = Math.round(dh / 24);
  if (dd === 1) return "вчера";
  if (dd < 7) return `${dd}д назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function SinceLastVisitBanner({ data, onDismiss }: Props) {
  if (!data || !data.priorVisitAt || !data.since) return null;
  const priorMs = Date.now() - new Date(data.priorVisitAt).getTime();
  if (priorMs < MIN_GAP_MS) return null;
  const s = data.since;
  const hasAny =
    s.newMessages > 0 ||
    s.newTasks > 0 ||
    s.newDecisions > 0 ||
    s.newFollowUps > 0 ||
    s.recentPinned.length > 0 ||
    s.incident != null;
  if (!hasAny) return null;

  return (
    <section style={wrap} aria-label="Сводка с момента последнего visit'а">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Закрыть сводку"
        title="Закрыть"
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          border: 0,
          background: "transparent",
          color: "var(--ec-text-dim)",
          cursor: "pointer",
          borderRadius: "var(--ec-radius-xs)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div style={header}>
        <span aria-hidden style={{ fontSize: "0.8rem" }}>✦</span>
        <span>Пока тебя не было · {relativeShort(data.priorVisitAt)}</span>
      </div>

      <div style={counterRow}>
        {counter("сообщений", s.newMessages, "var(--ec-text-strong)")}
        {counter("авторов", s.newAuthors, "var(--ec-text-strong)")}
        {counter("новых задач", s.newTasks, "var(--ec-status-exec)")}
        {counter("решений", s.newDecisions, "var(--ec-status-ai)")}
        {counter("follow-up", s.newFollowUps, "var(--ec-status-warn)")}
        {s.recentPinned.length > 0 &&
          counter("закреплено", s.recentPinned.length, "var(--ec-accent)")}
      </div>

      {s.incident && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0.4rem 0.6rem",
            background: "color-mix(in srgb, var(--ec-status-risk) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ec-status-risk) 40%, transparent)",
            borderRadius: "var(--ec-radius-md)",
            fontSize: "var(--ec-text-sm)",
            color: "var(--ec-text)",
          }}
        >
          <span aria-hidden style={{ color: "var(--ec-status-risk)" }}>🚨</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Открыт инцидент: <strong>{s.incident.title}</strong>
          </span>
          <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
            {relativeShort(s.incident.openedAt)}
          </span>
        </div>
      )}

      {s.recentActions.length > 0 && (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {s.recentActions.slice(0, 3).map((a) => (
            <li
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: 8,
                fontSize: "var(--ec-text-sm)",
                color: "var(--ec-text)",
              }}
            >
              <span
                aria-hidden
                style={{
                  color:
                    a.type === "DECISION"
                      ? "var(--ec-status-ai)"
                      : a.type === "FOLLOW_UP"
                      ? "var(--ec-status-warn)"
                      : "var(--ec-status-exec)",
                  fontFamily: "var(--ec-font-mono)",
                  fontSize: "var(--ec-text-base)",
                }}
              >
                {typeGlyph(a.type)}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.title}
              </span>
              {a.assignee && (
                <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
                  · {a.assignee.displayName}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
