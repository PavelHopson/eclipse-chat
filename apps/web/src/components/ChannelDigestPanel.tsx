import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { ChannelDigest, DigestAiSummary } from "../hooks/useChannelDigest";
import type { ActionItemPayload } from "../lib/socket";

type Props = {
  digest: ChannelDigest | null;
  loading: boolean;
  error: string | null;
  /** Manual refresh handler — кнопка «Собрать сводку». */
  onRefresh: () => void;
  /** UI compact на мобилке. */
  compact?: boolean;
  /** AI-резюме (на LLM поверх digest). Null = ещё не запрашивали. */
  aiSummary?: DigestAiSummary | null;
  aiLoading?: boolean;
  aiError?: string | null;
  /** Triggers AI summary generation. */
  onRequestAiSummary?: () => void;
};

const wrap: CSSProperties = {
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-lg)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ec-accent) 6%, transparent), transparent)",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  fontSize: "var(--ec-text-xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-strong)",
};

const meta: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
};

const statsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: "var(--ec-space-2)",
};

const statCard: CSSProperties = {
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const statValue: CSSProperties = {
  fontSize: "var(--ec-text-lg)",
  fontWeight: 700,
  color: "var(--ec-text-strong)",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
  fontFeatureSettings: '"tnum"',
};

const statLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "var(--ec-tracking-caps)",
};

const sectionTitle: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  marginBottom: 4,
};

const itemRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 8,
  padding: "0.35rem 0.5rem",
  borderRadius: "var(--ec-radius-sm)",
  background: "var(--ec-surface-1)",
  border: "1px solid var(--ec-border-subtle)",
  fontSize: "var(--ec-text-sm)",
};

const dueChip = (kind: "overdue" | "today" | "tomorrow" | "none"): CSSProperties => {
  const colorMap: Record<typeof kind, [string, string]> = {
    overdue: ["var(--ec-danger-soft)", "var(--ec-danger)"],
    today: ["var(--ec-accent-soft)", "var(--ec-accent)"],
    tomorrow: ["var(--ec-surface-2)", "var(--ec-text-muted)"],
    none: ["var(--ec-surface-2)", "var(--ec-text-dim)"],
  } as Record<"overdue" | "today" | "tomorrow" | "none", [string, string]>;
  const [bg, fg] = colorMap[kind];
  return {
    fontSize: "0.6rem",
    padding: "0.1rem 0.4rem",
    background: bg,
    color: fg,
    borderRadius: "var(--ec-radius-full)",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
};

function typeGlyph(type: ActionItemPayload["type"]): string {
  if (type === "DECISION") return "◆";
  if (type === "FOLLOW_UP") return "↻";
  return "□";
}

function relativeShort(iso: string): string {
  const t = new Date(iso).getTime();
  const dh = Math.round((Date.now() - t) / 3_600_000);
  if (dh < 1) return "сейчас";
  if (dh < 24) return `${dh}ч назад`;
  const dd = Math.round(dh / 24);
  if (dd < 7) return `${dd}д назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function ItemLine({ item }: { item: ActionItemPayload }) {
  const now = Date.now();
  const due = item.dueAt ? new Date(item.dueAt).getTime() : null;
  let kind: "overdue" | "today" | "tomorrow" | "none" = "none";
  let dueLabel = "—";
  if (due !== null) {
    const dayMs = 86_400_000;
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startTomorrow = startToday.getTime() + dayMs;
    if (due < now) {
      kind = "overdue";
      dueLabel = "просрочено";
    } else if (due < startTomorrow) {
      kind = "today";
      dueLabel = "сегодня";
    } else if (due < startTomorrow + dayMs) {
      kind = "tomorrow";
      dueLabel = "завтра";
    } else {
      dueLabel = new Date(item.dueAt!).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      });
    }
  } else if (!item.assignee) {
    kind = "tomorrow"; // визуально нейтрально
    dueLabel = "без ответственного";
  }
  return (
    <div style={itemRow} title={item.title}>
      <span aria-hidden style={{ color: "var(--ec-accent)", fontFamily: "var(--ec-font-mono, ui-monospace, monospace)" }}>
        {typeGlyph(item.type)}
      </span>
      <span
        style={{
          color: "var(--ec-text)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.title}
        {item.assignee && (
          <span style={{ color: "var(--ec-text-dim)", marginLeft: 6, fontSize: "var(--ec-text-2xs)" }}>
            · {item.assignee.displayName}
          </span>
        )}
      </span>
      <span style={dueChip(kind)}>{dueLabel}</span>
    </div>
  );
}

export function ChannelDigestPanel({
  digest,
  loading,
  error,
  onRefresh,
  compact,
  aiSummary,
  aiLoading,
  aiError,
  onRequestAiSummary,
}: Props) {
  const generatedAgo = useMemo(() => {
    if (!digest) return null;
    return relativeShort(digest.generatedAt);
  }, [digest]);

  return (
    <section style={wrap} aria-label="Сводка комнаты">
      <header style={headerRow}>
        <span style={titleStyle}>Сводка комнаты</span>
        {generatedAgo && (
          <span style={meta} title={`Обновлено ${digest?.generatedAt}`}>
            обновлено {generatedAgo}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="ec-btn ec-btn--ghost"
            style={{
              minHeight: 28,
              padding: "0.25rem 0.7rem",
              fontSize: "var(--ec-text-2xs)",
              // v0.92: defensive nowrap чтобы «Собрать сводку» не ломался
              // на узкой колонке.
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Собираем…" : "Собрать сводку"}
          </button>
          {onRequestAiSummary && digest && (
            <button
              type="button"
              onClick={onRequestAiSummary}
              disabled={aiLoading}
              style={{
                minHeight: 28,
                padding: "0.25rem 0.7rem",
                fontSize: "var(--ec-text-2xs)",
                fontWeight: 700,
                letterSpacing: "var(--ec-tracking-caps)",
                textTransform: "uppercase",
                borderRadius: "var(--ec-radius-sm)",
                background: "var(--ec-accent-3-soft)",
                color: "var(--ec-accent-3)",
                border: "1px solid var(--ec-accent-3)",
                cursor: aiLoading ? "wait" : "pointer",
                transition: "background var(--ec-dur-fast) var(--ec-ease)",
                // v0.92 fix: ru-слова длинные («ПЕРЕГЕНЕРИРОВАТЬ ИИ» 21 chars
                // в uppercase) на узкой intel-rail колонке (≈120-140px)
                // wrap'ились по букве → «ПЕРЕГЕНЕРИРОВАТИИ» glitch.
                // Fix: nowrap + ellipsis overflow. И текст укорочен.
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
              title={aiSummary ? "Сгенерировать резюме заново" : "Сгенерировать резюме через ИИ"}
            >
              {aiLoading ? "ИИ думает…" : aiSummary ? "✦ Заново" : "✦ Резюме"}
            </button>
          )}
        </div>
      </header>

      {(aiSummary || aiError) && (
        <div
          style={{
            padding: "var(--ec-space-3) var(--ec-space-4)",
            background:
              "linear-gradient(135deg, var(--ec-accent-3-soft), color-mix(in srgb, var(--ec-accent-3) 4%, transparent))",
            border: "1px solid var(--ec-accent-3)",
            borderRadius: "var(--ec-radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--ec-text-2xs)",
              fontWeight: 700,
              letterSpacing: "var(--ec-tracking-caps)",
              textTransform: "uppercase",
              color: "var(--ec-accent-3)",
            }}
          >
            <span aria-hidden>✦</span>
            <span>ИИ-резюме</span>
            {aiSummary && (
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--ec-font-mono)",
                  fontSize: "0.6rem",
                  color: "var(--ec-text-dim)",
                  letterSpacing: 0,
                  textTransform: "none",
                  fontWeight: 400,
                }}
                title={`${aiSummary.provider}/${aiSummary.model} · ${aiSummary.latencyMs}ms`}
              >
                {aiSummary.provider} · {(aiSummary.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {aiError ? (
            <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>
              {aiError}
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                color: "var(--ec-text)",
                fontSize: "var(--ec-text-sm)",
                lineHeight: "var(--ec-leading-relaxed)",
                whiteSpace: "pre-wrap",
              }}
            >
              {aiSummary?.summary}
            </p>
          )}
        </div>
      )}

      {error && (
        <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>
          {error}
        </p>
      )}

      {!digest && !loading && !error && (
        <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
          Нажми «Собрать сводку», чтобы увидеть открытые задачи, решения и
          закреплённые сообщения этой комнаты.
        </p>
      )}

      {digest && (() => {
        const isCleanChannel =
          digest.openActions.total === 0 &&
          digest.decisions.length === 0 &&
          digest.followUps.length === 0 &&
          digest.pinned.length === 0;
        if (isCleanChannel) {
          // Calm empty-state — без 5 нулевых stat-карточек.
          return null;
        }
        return (
          <div style={statsRow}>
            {digest.openActions.byType.TASK > 0 && (
              <div style={statCard}>
                <span style={statValue}>{digest.openActions.byType.TASK}</span>
                <span style={statLabel}>Открытые задачи</span>
              </div>
            )}
            {digest.openActions.overdue.length > 0 && (
              <div style={statCard}>
                <span style={{ ...statValue, color: "var(--ec-status-risk)" }}>
                  {digest.openActions.overdue.length}
                </span>
                <span style={statLabel}>Просрочено</span>
              </div>
            )}
            {digest.openActions.dueToday.length > 0 && (
              <div style={statCard}>
                <span style={{ ...statValue, color: "var(--ec-status-warn)" }}>
                  {digest.openActions.dueToday.length}
                </span>
                <span style={statLabel}>Сегодня</span>
              </div>
            )}
            {digest.openActions.unassigned.length > 0 && (
              <div style={statCard}>
                <span style={statValue}>{digest.openActions.unassigned.length}</span>
                <span style={statLabel}>Без ответственного</span>
              </div>
            )}
            {!compact && digest.stats.messages > 0 && (
              <div style={statCard}>
                <span style={statValue}>
                  {digest.stats.messages}
                  <span style={{ ...statLabel, marginLeft: 6 }}>/ {digest.stats.uniqueAuthors}</span>
                </span>
                <span style={statLabel}>Сообщения / авторы · {digest.windowDays}д</span>
              </div>
            )}
          </div>
        );
      })()}
      {digest && (
        <>
          {digest.openActions.overdue.length > 0 && (
            <div>
              <div style={sectionTitle}>Требует внимания</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {digest.openActions.overdue.slice(0, 4).map((a) => (
                  <ItemLine key={a.id} item={a} />
                ))}
              </div>
            </div>
          )}

          {digest.openActions.dueToday.length > 0 && (
            <div>
              <div style={sectionTitle}>Сегодня</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {digest.openActions.dueToday.slice(0, 4).map((a) => (
                  <ItemLine key={a.id} item={a} />
                ))}
              </div>
            </div>
          )}

          {digest.decisions.length > 0 && (
            <div>
              <div style={sectionTitle}>Недавние решения · {digest.windowDays}д</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {digest.decisions.slice(0, 3).map((a) => (
                  <ItemLine key={a.id} item={a} />
                ))}
              </div>
            </div>
          )}

          {digest.followUps.length > 0 && (
            <div>
              <div style={sectionTitle}>Follow-up</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {digest.followUps.slice(0, 3).map((a) => (
                  <ItemLine key={a.id} item={a} />
                ))}
              </div>
            </div>
          )}

          {digest.pinned.length > 0 && (
            <div>
              <div style={sectionTitle}>Закреплено</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {digest.pinned.slice(0, 3).map((p) => (
                  <div key={p.id} style={itemRow}>
                    <span aria-hidden style={{ color: "var(--ec-accent)" }}>📌</span>
                    <span
                      style={{
                        color: "var(--ec-text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={p.content}
                    >
                      {p.content || "[без текста]"}
                      <span style={{ color: "var(--ec-text-dim)", marginLeft: 6, fontSize: "var(--ec-text-2xs)" }}>
                        · {p.user.displayName}
                      </span>
                    </span>
                    <span style={{ ...meta, fontSize: "0.6rem" }}>
                      {p.pinnedAt ? relativeShort(p.pinnedAt) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {digest.openActions.total === 0 &&
            digest.decisions.length === 0 &&
            digest.followUps.length === 0 &&
            digest.pinned.length === 0 && (
              <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
                Комната чистая — нет открытых задач, решений или закреплённых сообщений.
              </p>
            )}
        </>
      )}
    </section>
  );
}
