import type { CSSProperties } from "react";

type Props = {
  channelName: string;
};

const wrap: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--ec-space-6)",
  background:
    "radial-gradient(ellipse at center, hsl(195 40% 12% / 0.35) 0%, transparent 65%)",
};

const card: CSSProperties = {
  width: "min(440px, 100%)",
  padding: "var(--ec-space-6)",
  background: "var(--ec-surface-1)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  boxShadow: "var(--ec-shadow-md)",
};

const iconWrap: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-accent-soft)",
  border: "1px solid var(--ec-border-accent)",
  display: "grid",
  placeItems: "center",
  color: "var(--ec-accent)",
  boxShadow: "var(--ec-glow-active)",
};

const tag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--ec-space-1)",
  padding: "0.18rem 0.55rem",
  background: "var(--ec-surface-3)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-full)",
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  fontWeight: 600,
  color: "var(--ec-text-muted)",
};

const list: CSSProperties = {
  width: "100%",
  marginTop: "var(--ec-space-2)",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
  textAlign: "left",
};

const listRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  fontSize: "var(--ec-text-sm)",
  color: "var(--ec-text-muted)",
};

const checkmark: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: "var(--ec-radius-full)",
  display: "grid",
  placeItems: "center",
  background: "var(--ec-accent-2-soft)",
  color: "var(--ec-accent-2)",
  flexShrink: 0,
};

export function VoicePlaceholder({ channelName }: Props) {
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={iconWrap} aria-hidden>
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: "var(--ec-text-lg)",
            fontWeight: 600,
            color: "var(--ec-text-strong)",
            letterSpacing: "var(--ec-tracking-tight)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ color: "var(--ec-accent)" }}
          >
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
          </svg>
          {channelName}
        </h2>

        <span style={tag}>Готовим инфраструктуру</span>

        <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)", lineHeight: "var(--ec-leading-relaxed)" }}>
          Канал создан и закреплён за сервером. Голосовая связь подключится автоматически,
          когда в этой версии Eclipse Chat появится LiveKit-интеграция (планируется
          в <strong style={{ color: "var(--ec-text)" }}>v0.5.3</strong>).
        </p>

        <div style={list}>
          <div style={listRow}>
            <span style={checkmark} aria-hidden>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span><span style={{ color: "var(--ec-text)" }}>Структура каналов</span> — TEXT / VOICE в базе</span>
          </div>
          <div style={listRow}>
            <span style={checkmark} aria-hidden>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span><span style={{ color: "var(--ec-text)" }}>UI и создание</span> — оба типа доступны OWNER / ADMIN</span>
          </div>
          <div style={listRow}>
            <span
              style={{
                ...checkmark,
                background: "var(--ec-surface-3)",
                color: "var(--ec-text-dim)",
                border: "1px dashed var(--ec-border-emphasis)",
              }}
              aria-hidden
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            <span>LiveKit SFU + TURN сервер на VPS</span>
          </div>
          <div style={listRow}>
            <span
              style={{
                ...checkmark,
                background: "var(--ec-surface-3)",
                color: "var(--ec-text-dim)",
                border: "1px dashed var(--ec-border-emphasis)",
              }}
              aria-hidden
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            <span>Voice room UI: участники, mute / deafen, push-to-talk</span>
          </div>
        </div>
      </div>
    </div>
  );
}
