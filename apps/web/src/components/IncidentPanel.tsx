import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { RichContent } from "./RichContent";
import {
  useIncidents,
  type IncidentDetail,
  type IncidentPinned,
  type IncidentRow,
  type IncidentTimelineItem,
} from "../hooks/useIncidents";
import type { Socket } from "socket.io-client";

type Props = {
  serverId: string;
  socket: Socket | null;
  currentUserId: string;
  /** Роль текущего user'а — для permission «закрыть инцидент». */
  currentRole: string | null;
  /** Открыть incident-канал в основном чате. */
  onOpenChannel: (channelId: string) => void;
  onClose: () => void;
};

const panel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--ec-surface-1)",
  borderLeft: "1px solid var(--ec-border-subtle)",
  height: "100%",
  minWidth: 0,
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-2)",
  padding: "0 var(--ec-space-4)",
  height: 48,
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-bg)",
};

const headerLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
};

const iconBtn: CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text-muted)",
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const content: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.65rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-surface-1)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  fontFamily: "inherit",
};

const incidentCard: CSSProperties = {
  padding: "var(--ec-space-3)",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
  cursor: "pointer",
  transition: "border-color var(--ec-dur-fast) var(--ec-ease)",
};

function statusBadge(status: "OPEN" | "RESOLVED"): CSSProperties {
  const open = status === "OPEN";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "0.05rem 0.45rem",
    borderRadius: "var(--ec-radius-full)",
    fontSize: "0.6rem",
    fontWeight: 700,
    letterSpacing: "var(--ec-tracking-caps)",
    textTransform: "uppercase",
    background: open ? "var(--ec-danger-soft)" : "color-mix(in srgb, var(--ec-ok) 18%, transparent)",
    color: open ? "var(--ec-danger)" : "var(--ec-ok)",
    border: `1px solid ${open ? "var(--ec-danger)" : "var(--ec-ok)"}`,
  };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `сегодня ${time}`;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} ${time}`;
}

function durationLabel(openedAt: string, resolvedAt: string | null): string {
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const min = Math.max(1, Math.round((end - new Date(openedAt).getTime()) / 60_000));
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

export function IncidentPanel({
  serverId,
  socket,
  currentUserId,
  currentRole,
  onOpenChannel,
  onClose,
}: Props) {
  const { incidents, loading, error, openIncident, resolveIncident, loadDetail } =
    useIncidents(serverId, socket);

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // Detail view
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    incident: IncidentDetail;
    timeline: { actionItems: IncidentTimelineItem[]; pinned: IncidentPinned[] };
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const formRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) formRef.current?.focus();
  }, [showForm]);

  // Загрузка detail при выборе инцидента
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void loadDetail(detailId).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setDetailLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [detailId, loadDetail]);

  // Если incidents обновились (socket: post-mortem готов) и открыт detail —
  // перезагрузить detail чтобы подтянуть post-mortem.
  useEffect(() => {
    if (!detailId) return;
    const row = incidents.find((i) => i.id === detailId);
    if (row && row.status === "RESOLVED" && row.hasPostMortem && detail && !detail.incident.postMortem) {
      void loadDetail(detailId).then((d) => {
        if (d) setDetail(d);
      });
    }
  }, [incidents, detailId, detail, loadDetail]);

  const handleOpen = async () => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const res = await openIncident(title);
      if (res) {
        setDraft("");
        setShowForm(false);
        // Сразу уводим в incident-канал — оператор начинает разбор
        if (res.channelId) onOpenChannel(res.channelId);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async (incident: IncidentRow | IncidentDetail) => {
    if (
      !window.confirm(
        `Закрыть инцидент «${incident.title}»? Будет сгенерирован post-mortem.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await resolveIncident(incident.id);
    } finally {
      setBusy(false);
    }
  };

  const canResolve = (inc: { openedByUserId: string }) =>
    inc.openedByUserId === currentUserId ||
    currentRole === "OWNER" ||
    currentRole === "ADMIN" ||
    currentRole === "MODERATOR";

  // ===== DETAIL VIEW =====
  if (detailId) {
    return (
      <aside className="ec-incident-panel" style={panel} aria-label="Детали инцидента">
        <header style={header}>
          <button
            type="button"
            onClick={() => setDetailId(null)}
            style={{ ...iconBtn, width: "auto", padding: "0 0.5rem", gap: 4 }}
            title="К списку инцидентов"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span style={{ fontSize: "var(--ec-text-2xs)", letterSpacing: "var(--ec-tracking-wide)" }}>
              Все инциденты
            </span>
          </button>
          <button type="button" onClick={onClose} style={iconBtn} title="Закрыть панель" aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div style={content}>
          {detailLoading && !detail && (
            <div style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-3)" }}>
              Загружаем инцидент…
            </div>
          )}
          {detail && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)", flexWrap: "wrap" }}>
                <span style={statusBadge(detail.incident.status)}>
                  {detail.incident.status === "OPEN" ? "Открыт" : "Закрыт"}
                </span>
                <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                  {durationLabel(detail.incident.openedAt, detail.incident.resolvedAt)}
                </span>
              </div>
              <h2 style={{ margin: "var(--ec-space-1) 0 0", fontSize: "var(--ec-text-lg)", color: "var(--ec-text-strong)" }}>
                {detail.incident.title}
              </h2>
              <p style={{ margin: 0, fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                Открыл {detail.incident.openedByName} · {formatWhen(detail.incident.openedAt)}
                {detail.incident.resolvedAt && ` · закрыт ${formatWhen(detail.incident.resolvedAt)}`}
              </p>

              {detail.incident.channelId && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChannel(detail.incident.channelId!);
                    onClose();
                  }}
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                  style={{ alignSelf: "flex-start", marginTop: "var(--ec-space-1)" }}
                >
                  🚨 Открыть комнату инцидента
                </button>
              )}

              {/* Timeline */}
              {(detail.timeline.actionItems.length > 0 || detail.timeline.pinned.length > 0) && (
                <section style={{ marginTop: "var(--ec-space-3)" }}>
                  <h3 style={{ ...headerLabel, margin: "0 0 var(--ec-space-2)" }}>Timeline</h3>
                  {detail.timeline.actionItems.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                        padding: "0.2rem 0",
                        fontSize: "var(--ec-text-xs)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.55rem",
                          fontWeight: 700,
                          letterSpacing: "var(--ec-tracking-caps)",
                          color:
                            a.type === "DECISION"
                              ? "var(--ec-warn)"
                              : a.type === "FOLLOW_UP"
                                ? "var(--ec-ok)"
                                : "var(--ec-accent)",
                          flexShrink: 0,
                        }}
                      >
                        {a.type === "DECISION" ? "РЕШЕНИЕ" : a.type === "FOLLOW_UP" ? "FOLLOW-UP" : "ЗАДАЧА"}
                      </span>
                      <span
                        style={{
                          color: a.status === "DONE" ? "var(--ec-text-dim)" : "var(--ec-text)",
                          textDecoration: a.status === "DONE" ? "line-through" : "none",
                        }}
                      >
                        {a.title}
                        {a.assigneeName && (
                          <span style={{ color: "var(--ec-text-dim)" }}> — {a.assigneeName}</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {detail.timeline.pinned.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "0.3rem 0.5rem",
                        marginTop: 4,
                        background: "color-mix(in srgb, var(--ec-warn) 6%, transparent)",
                        borderLeft: "2px solid var(--ec-warn)",
                        borderRadius: "var(--ec-radius-sm)",
                        fontSize: "var(--ec-text-xs)",
                      }}
                    >
                      <span style={{ color: "var(--ec-text-dim)" }}>📌 {p.authorName}: </span>
                      <span style={{ color: "var(--ec-text)" }}>{p.content.slice(0, 200)}</span>
                    </div>
                  ))}
                </section>
              )}

              {/* Post-mortem */}
              <section style={{ marginTop: "var(--ec-space-3)" }}>
                <h3 style={{ ...headerLabel, margin: "0 0 var(--ec-space-2)" }}>
                  ✦ Post-mortem
                </h3>
                {detail.incident.postMortem ? (
                  <div
                    style={{
                      padding: "var(--ec-space-3)",
                      background: "var(--ec-surface-2)",
                      border: "1px solid var(--ec-border-subtle)",
                      borderRadius: "var(--ec-radius-md)",
                      fontSize: "var(--ec-text-sm)",
                      lineHeight: "var(--ec-leading-normal)",
                      color: "var(--ec-text)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    <RichContent content={detail.incident.postMortem} />
                  </div>
                ) : detail.incident.status === "RESOLVED" ? (
                  <p style={{ fontSize: "var(--ec-text-xs)", color: "var(--ec-text-dim)", margin: 0 }}>
                    Post-mortem генерируется… (если сервис недоступен — не появится).
                    Обновится автоматически когда будет готов.
                  </p>
                ) : (
                  <p style={{ fontSize: "var(--ec-text-xs)", color: "var(--ec-text-dim)", margin: 0 }}>
                    Post-mortem будет сгенерирован при закрытии инцидента.
                  </p>
                )}
              </section>

              {detail.incident.status === "OPEN" && canResolve(detail.incident) && (
                <button
                  type="button"
                  onClick={() => void handleResolve(detail.incident)}
                  disabled={busy}
                  className="ec-btn ec-btn--primary"
                  style={{ marginTop: "var(--ec-space-3)" }}
                >
                  Закрыть инцидент + сгенерировать post-mortem
                </button>
              )}
            </>
          )}
        </div>
      </aside>
    );
  }

  // ===== LIST VIEW =====
  const openIncidents = incidents.filter((i) => i.status === "OPEN");
  const resolvedIncidents = incidents.filter((i) => i.status === "RESOLVED");

  const renderCard = (inc: IncidentRow) => (
    <div
      key={inc.id}
      style={{
        ...incidentCard,
        ...(inc.status === "OPEN"
          ? { borderColor: "var(--ec-danger)", background: "var(--ec-danger-soft)" }
          : {}),
      }}
      onClick={() => setDetailId(inc.id)}
      onMouseEnter={(e) => {
        if (inc.status !== "OPEN") e.currentTarget.style.borderColor = "var(--ec-border-default)";
      }}
      onMouseLeave={(e) => {
        if (inc.status !== "OPEN") e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)", flexWrap: "wrap" }}>
        <span style={statusBadge(inc.status)}>
          {inc.status === "OPEN" ? "Открыт" : "Закрыт"}
        </span>
        <span style={{ fontSize: "0.6rem", color: "var(--ec-text-dim)", fontFamily: "var(--ec-font-mono)" }}>
          {durationLabel(inc.openedAt, inc.resolvedAt)}
        </span>
        {inc.status === "RESOLVED" && inc.hasPostMortem && (
          <span style={{ fontSize: "0.6rem", color: "var(--ec-accent)" }}>✦ post-mortem</span>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: "var(--ec-text-sm)", fontWeight: 600, color: "var(--ec-text-strong)" }}>
        {inc.title}
      </div>
      <div style={{ marginTop: 2, fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
        {inc.openedByName} · {formatWhen(inc.openedAt)}
      </div>
    </div>
  );

  return (
    <aside className="ec-incident-panel" style={panel} aria-label="Инциденты">
      <header style={header}>
        <div style={headerLabel}>
          <span aria-hidden>🚨</span>
          Инциденты
          {openIncidents.length > 0 && (
            <span style={{ color: "var(--ec-danger)", marginLeft: 4 }}>
              · {openIncidents.length} активн{openIncidents.length === 1 ? "ый" : "ых"}
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} style={iconBtn} title="Закрыть панель" aria-label="Закрыть">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div style={content}>
        {/* Open form */}
        {showForm ? (
          <div
            style={{
              padding: "var(--ec-space-3)",
              background: "var(--ec-surface-2)",
              border: "1px solid var(--ec-border-accent)",
              borderRadius: "var(--ec-radius-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--ec-space-2)",
            }}
          >
            <input
              ref={formRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleOpen();
                } else if (e.key === "Escape") {
                  setShowForm(false);
                  setDraft("");
                }
              }}
              maxLength={160}
              placeholder="Что случилось? (напр. «WB API 500 на синхронизации»)"
              style={inputStyle}
            />
            <p style={{ margin: 0, fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)", lineHeight: 1.5 }}>
              Создаст dedicated комнату 🚨 для разбора. Закрытие инцидента сгенерит
              post-mortem из timeline (задачи, решения, закреплённое).
            </p>
            <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setDraft("");
                }}
                disabled={busy}
                className="ec-btn ec-btn--ghost ec-btn--sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleOpen()}
                disabled={busy || !draft.trim()}
                className="ec-btn ec-btn--primary ec-btn--sm"
              >
                {busy ? "Создаём…" : "Открыть инцидент"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="ec-btn ec-btn--primary"
            style={{ width: "100%" }}
          >
            🚨 Открыть инцидент
          </button>
        )}

        {error && (
          <div
            style={{
              padding: "var(--ec-space-2) var(--ec-space-3)",
              background: "var(--ec-danger-soft)",
              color: "var(--ec-danger)",
              border: "1px solid var(--ec-danger)",
              borderRadius: "var(--ec-radius-md)",
              fontSize: "var(--ec-text-xs)",
            }}
          >
            {error}
          </div>
        )}

        {loading && incidents.length === 0 && (
          <div style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-3)", textAlign: "center" }}>
            Загружаем инциденты…
          </div>
        )}

        {!loading && incidents.length === 0 && (
          <div
            className="ec-empty"
            style={{
              padding: "var(--ec-space-5) var(--ec-space-3)",
              textAlign: "center",
            }}
          >
            <div className="ec-empty-title" style={{ fontSize: "var(--ec-text-base)" }}>
              Инцидентов нет
            </div>
            <div className="ec-empty-hint" style={{ maxWidth: 300, margin: "0 auto" }}>
              Когда что-то ломается — открой инцидент. Eclipse Chat создаст
              dedicated комнату и соберёт timeline для разбора.
            </div>
          </div>
        )}

        {openIncidents.length > 0 && (
          <>
            <h3 style={{ ...headerLabel, margin: "var(--ec-space-2) 0 0" }}>Активные</h3>
            {openIncidents.map(renderCard)}
          </>
        )}
        {resolvedIncidents.length > 0 && (
          <>
            <h3 style={{ ...headerLabel, margin: "var(--ec-space-3) 0 0" }}>Закрытые</h3>
            {resolvedIncidents.map(renderCard)}
          </>
        )}
      </div>
    </aside>
  );
}
