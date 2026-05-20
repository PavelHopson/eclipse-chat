import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useComposio, type ComposioApp } from "../hooks/useComposio";

/**
 * v1.0.1 #11.5 Composio Automation Expansion — UI section.
 *
 * Render'ится inside AdminPanel «Интеграции» tab под существующим
 * IntegrationsTabContent. Self-contained — own data loading через
 * useComposio hook.
 *
 * Состояния:
 *   - Composio not configured (no COMPOSIO_API_KEY) → info banner
 *   - Composio configured, нет connections → CTA «Подключить первое
 *     приложение» с button открывающим app-picker
 *   - Composio configured, есть connections → list + кнопка disconnect +
 *     button «Подключить новое»
 *
 * App picker — modal с поиском по supported apps. Подключение открывает
 * Composio OAuth в новой вкладке + listener на postMessage от callback.
 */

type Props = {
  serverId: string;
};

const sectionLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  margin: "0 0 var(--ec-space-2) 0",
};

const groupCard: CSSProperties = {
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  padding: "var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const fieldHint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  lineHeight: 1.5,
  margin: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-surface-1)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  fontFamily: "inherit",
};

const connectionRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "var(--ec-space-3)",
  background: "var(--ec-surface-1)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
};

const statusChip = (status: string): CSSProperties => {
  if (status === "ACTIVE") {
    return {
      color: "var(--ec-status-exec)",
      background: "color-mix(in srgb, var(--ec-status-exec) 14%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ec-status-exec) 35%, transparent)",
    };
  }
  if (status === "PENDING") {
    return {
      color: "var(--ec-status-warn)",
      background: "color-mix(in srgb, var(--ec-status-warn) 14%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ec-status-warn) 35%, transparent)",
    };
  }
  return {
    color: "var(--ec-text-muted)",
    background: "var(--ec-surface-3)",
    border: "1px solid var(--ec-border-subtle)",
  };
};

function formatRelative(iso: string | null): string {
  if (!iso) return "ни разу";
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  if (diff < 60_000) return "только что";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} ч назад`;
  const days = Math.floor(diff / 86400_000);
  if (days < 30) return `${days} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export function ComposioConnections({ serverId }: Props) {
  const {
    status,
    connections,
    loading,
    error,
    reload,
    initiateConnect,
    disconnect,
    fetchAvailableApps,
  } = useComposio(serverId);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerApps, setPickerApps] = useState<ComposioApp[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthWindowRef, setOauthWindowRef] = useState<Window | null>(null);

  // Listener для postMessage от callback page (auto-close window после OAuth).
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && typeof e.data === "object" && e.data.type === "composio.callback") {
        void reload();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [reload]);

  const handleOpenPicker = async () => {
    setShowPicker(true);
    if (pickerApps.length === 0) {
      setPickerLoading(true);
      try {
        const apps = await fetchAvailableApps();
        setPickerApps(apps);
      } finally {
        setPickerLoading(false);
      }
    }
  };

  const handleConnect = async (app: ComposioApp) => {
    setBusy(true);
    try {
      const url = await initiateConnect(app.name, app.displayName);
      if (url) {
        // Open OAuth flow в new window. Listener сверху reload'ает при callback.
        const w = window.open(url, "composio_oauth", "width=600,height=720");
        setOauthWindowRef(w);
        setShowPicker(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async (connectionId: string, displayName: string) => {
    if (!window.confirm(`Отключить «${displayName}»? Auto-rule'ы которые используют это подключение перестанут работать.`)) {
      return;
    }
    setBusy(true);
    try {
      await disconnect(connectionId);
    } finally {
      setBusy(false);
    }
  };

  const filteredApps = pickerQuery.trim()
    ? pickerApps.filter(
        (a) =>
          a.displayName.toLowerCase().includes(pickerQuery.toLowerCase()) ||
          a.name.toLowerCase().includes(pickerQuery.toLowerCase()) ||
          a.description?.toLowerCase().includes(pickerQuery.toLowerCase()),
      )
    : pickerApps;

  return (
    <section style={{ marginTop: "var(--ec-space-5)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--ec-space-3)",
        }}
      >
        <h3 style={{ ...sectionLabel, margin: 0 }}>
          Composio · 500+ apps через OAuth
        </h3>
        {status?.enabled && (
          <button
            type="button"
            onClick={() => void handleOpenPicker()}
            disabled={busy}
            className="ec-btn ec-btn--primary ec-btn--sm"
          >
            + Подключить app
          </button>
        )}
      </div>

      {!status && (
        <p style={fieldHint}>Загружаем статус Composio…</p>
      )}

      {status && !status.enabled && (
        <div
          style={{
            ...groupCard,
            background: "var(--ec-surface-1)",
            borderColor: "color-mix(in srgb, var(--ec-status-warn) 35%, transparent)",
          }}
        >
          <strong style={{ color: "var(--ec-status-warn)", fontSize: "var(--ec-text-sm)" }}>
            ⚠ Composio не настроен
          </strong>
          <p style={fieldHint}>
            Добавь <code style={{ fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>COMPOSIO_API_KEY</code>
            {" "}в .env на сервере (получи ключ на{" "}
            <a
              href="https://composio.dev"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--ec-accent)" }}
            >
              composio.dev
            </a>
            ) и перезапусти процесс. После этого OWNER сможет подключать Gmail / Slack /
            Notion / Jira / Asana / Telegram / Stripe / 500+ других apps через единый
            OAuth flow.
          </p>
          {status.callbackUrl && (
            <p style={fieldHint}>
              Callback URL для Composio config:{" "}
              <code style={{ fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>
                {status.callbackUrl}
              </code>
            </p>
          )}
        </div>
      )}

      {status?.enabled && (
        <>
          {error && (
            <div
              style={{
                padding: "var(--ec-space-2) var(--ec-space-3)",
                marginBottom: "var(--ec-space-3)",
                background: "var(--ec-danger-soft)",
                color: "var(--ec-danger)",
                border: "1px solid var(--ec-danger)",
                borderRadius: "var(--ec-radius-md)",
                fontSize: "var(--ec-text-sm)",
              }}
            >
              {error}
            </div>
          )}

          {loading && connections.length === 0 && (
            <p style={{ ...fieldHint, padding: "var(--ec-space-4)", textAlign: "center" }}>
              Загружаем подключения…
            </p>
          )}

          {!loading && connections.length === 0 && (
            <div
              style={{
                ...groupCard,
                background:
                  "linear-gradient(135deg, hsl(258 90% 66% / 0.04), hsl(252 70% 70% / 0.03))",
                textAlign: "center",
              }}
            >
              <p style={{ ...fieldHint, fontSize: "var(--ec-text-sm)", color: "var(--ec-text-muted)" }}>
                Ни одного app пока не подключено. Жми «+ Подключить app» сверху —
                выберешь Gmail / Slack / Notion / etc, авторизуешь, и сможешь
                использовать действия в Automation rules.
              </p>
            </div>
          )}

          {connections.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
              {connections.map((c) => (
                <div key={c.id} style={connectionRow}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--ec-radius-md)",
                      background: "var(--ec-surface-3)",
                      border: "1px solid var(--ec-border-default)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--ec-accent)",
                      fontFamily: "var(--ec-font-mono)",
                      fontWeight: 700,
                      fontSize: 0.85,
                      textTransform: "uppercase",
                    }}
                  >
                    {c.appName.slice(0, 2)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--ec-space-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong
                        style={{
                          color: "var(--ec-text-strong)",
                          fontSize: "var(--ec-text-sm)",
                        }}
                      >
                        {c.displayName}
                      </strong>
                      <span
                        style={{
                          ...statusChip(c.status),
                          fontSize: "0.58rem",
                          fontWeight: 700,
                          letterSpacing: "var(--ec-tracking-caps)",
                          textTransform: "uppercase",
                          padding: "0.05rem 0.45rem",
                          borderRadius: "var(--ec-radius-full)",
                        }}
                      >
                        {c.status}
                      </span>
                      <code
                        style={{
                          fontSize: "var(--ec-text-2xs)",
                          color: "var(--ec-text-dim)",
                          background: "var(--ec-surface-3)",
                          padding: "0.05rem 0.4rem",
                          borderRadius: "var(--ec-radius-xs)",
                          fontFamily: "var(--ec-font-mono)",
                        }}
                      >
                        {c.appName}
                      </code>
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        gap: "var(--ec-space-3)",
                        fontSize: "var(--ec-text-2xs)",
                        color: "var(--ec-text-dim)",
                        flexWrap: "wrap",
                      }}
                    >
                      {c.createdBy && <span>создал {c.createdBy.displayName}</span>}
                      <span>•</span>
                      <span>использован: {formatRelative(c.lastUsedAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDisconnect(c.id, c.displayName)}
                    disabled={busy}
                    className="ec-btn ec-btn--danger ec-btn--sm"
                    title="Отключить app"
                  >
                    Отключить
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* App picker overlay */}
      {showPicker && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
            zIndex: 100,
            padding: "var(--ec-space-4)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPicker(false);
          }}
        >
          <div
            style={{
              background: "hsl(200 8% 9% / 0.96)",
              border: "1px solid var(--ec-border-default)",
              borderRadius: "var(--ec-radius-lg)",
              width: "min(560px, calc(100vw - 32px))",
              maxHeight: "min(80vh, 700px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header
              style={{
                padding: "var(--ec-space-4) var(--ec-space-5)",
                borderBottom: "1px solid var(--ec-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--ec-text-md)",
                  fontWeight: 600,
                  color: "var(--ec-text-strong)",
                }}
              >
                Подключить app из Composio
              </h2>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="ec-btn ec-btn--ghost ec-btn--sm"
              >
                ✕
              </button>
            </header>
            <div style={{ padding: "var(--ec-space-4) var(--ec-space-5)" }}>
              <input
                type="text"
                placeholder="Поиск: gmail / slack / notion …"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                style={inputStyle}
                autoFocus
              />
            </div>
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "0 var(--ec-space-5) var(--ec-space-5)",
              }}
            >
              {pickerLoading && (
                <p style={{ ...fieldHint, textAlign: "center", padding: "var(--ec-space-4)" }}>
                  Загружаем список apps из Composio…
                </p>
              )}
              {!pickerLoading && filteredApps.length === 0 && pickerApps.length > 0 && (
                <p style={{ ...fieldHint, textAlign: "center", padding: "var(--ec-space-4)" }}>
                  Ничего не найдено по запросу «{pickerQuery}».
                </p>
              )}
              {!pickerLoading && pickerApps.length === 0 && (
                <p style={{ ...fieldHint, textAlign: "center", padding: "var(--ec-space-4)" }}>
                  Composio не вернул apps. Проверь API key + base URL.
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
                {filteredApps.map((app) => (
                  <button
                    key={app.name}
                    type="button"
                    onClick={() => void handleConnect(app)}
                    disabled={busy}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px 1fr auto",
                      gap: "var(--ec-space-3)",
                      padding: "var(--ec-space-3)",
                      background: "var(--ec-surface-1)",
                      border: "1px solid var(--ec-border-subtle)",
                      borderRadius: "var(--ec-radius-md)",
                      cursor: busy ? "wait" : "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      color: "var(--ec-text)",
                      transition: "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--ec-surface-2)";
                      e.currentTarget.style.borderColor = "var(--ec-border-accent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--ec-surface-1)";
                      e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--ec-radius-sm)",
                        background: "var(--ec-surface-3)",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--ec-accent)",
                        fontFamily: "var(--ec-font-mono)",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                      }}
                    >
                      {app.iconUrl ? (
                        <img
                          src={app.iconUrl}
                          alt=""
                          style={{ width: 24, height: 24, borderRadius: 4 }}
                          loading="lazy"
                        />
                      ) : (
                        app.name.slice(0, 2)
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "var(--ec-text-sm)",
                          fontWeight: 600,
                          color: "var(--ec-text-strong)",
                        }}
                      >
                        {app.displayName}
                      </div>
                      {app.description && (
                        <div
                          style={{
                            fontSize: "var(--ec-text-2xs)",
                            color: "var(--ec-text-muted)",
                            marginTop: 2,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {app.description}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        alignSelf: "center",
                        color: "var(--ec-text-dim)",
                        fontSize: "var(--ec-text-2xs)",
                      }}
                    >
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {oauthWindowRef && (
        <p style={{ ...fieldHint, marginTop: "var(--ec-space-2)" }}>
          Открыто Composio OAuth-окно. Подтверди доступ и оно само закроется.
        </p>
      )}
    </section>
  );
}
