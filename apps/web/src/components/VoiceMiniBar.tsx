import type { CSSProperties } from "react";
import type { useVoice as useVoiceHook } from "../hooks/useVoice";

type Props = {
  voice: ReturnType<typeof useVoiceHook>;
  channelName: string;
  /** Navigate назад в voice channel. */
  onOpenVoiceChannel: () => void;
};

const wrap: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto auto auto",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background:
    "linear-gradient(180deg, hsl(195 40% 14% / 0.5), hsl(200 8% 10% / 0.95))",
  borderTop: "1px solid var(--ec-border-subtle)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
};

const ctrlBtn: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "var(--ec-radius-full)",
  display: "grid",
  placeItems: "center",
  background: "transparent",
  color: "var(--ec-text)",
  border: "1px solid var(--ec-border-default)",
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const leaveBtn: CSSProperties = {
  ...ctrlBtn,
  background: "var(--ec-danger)",
  color: "#fff",
  borderColor: "var(--ec-danger)",
};

export function VoiceMiniBar({ voice, channelName, onOpenVoiceChannel }: Props) {
  return (
    <div style={wrap} role="region" aria-label="Голосовое подключение">
      <button
        type="button"
        onClick={onOpenVoiceChannel}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: 0,
          color: "inherit",
        }}
        title="Открыть голосовую комнату"
      >
        <span
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 26,
            height: 26,
            borderRadius: "var(--ec-radius-full)",
            background: "hsl(195 60% 55% / 0.18)",
            color: "var(--ec-accent)",
            boxShadow: voice.pttActive
              ? "0 0 0 1.5px var(--ec-accent), 0 0 12px hsl(195 60% 55% / 0.5)"
              : "none",
            transition: "box-shadow var(--ec-dur-fast) var(--ec-ease)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
          </svg>
        </span>
        <span>
          <span style={{ color: "var(--ec-text-strong)", fontWeight: 600 }}>В эфире</span>
          <span style={{ color: "var(--ec-text-muted)", marginLeft: 6 }}>
            #{channelName}
          </span>
        </span>
      </button>
      <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)", justifySelf: "end" }}>
        {voice.participants.length} в комнате
      </span>
      <button
        type="button"
        onClick={() => void voice.toggleMic()}
        style={voice.isMicMuted ? { ...ctrlBtn, background: "var(--ec-danger-soft)", color: "var(--ec-danger)", borderColor: "var(--ec-danger)" } : ctrlBtn}
        title={voice.isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
        aria-label={voice.isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
        disabled={voice.settings.micActivationMode === "push_to_talk"}
      >
        {voice.isMicMuted ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => voice.toggleDeafen()}
        style={voice.isDeafened ? { ...ctrlBtn, background: "var(--ec-danger-soft)", color: "var(--ec-danger)", borderColor: "var(--ec-danger)" } : ctrlBtn}
        title={voice.isDeafened ? "Включить звук" : "Заглушить всех"}
        aria-label={voice.isDeafened ? "Включить звук" : "Заглушить всех"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 18v-6a9 9 0 0118 0v6" />
          <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => void voice.leave()}
        style={leaveBtn}
        title="Покинуть голосовой канал"
        aria-label="Покинуть голосовой канал"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-3.07-3.07" />
          <line x1="22" y1="2" x2="2" y2="22" />
        </svg>
      </button>
    </div>
  );
}
