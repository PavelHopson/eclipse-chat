import type { CSSProperties } from "react";
import type { useVoice as useVoiceHook } from "../hooks/useVoice";
import {
  CameraLensIcon,
  HeadsetIcon,
  HangupIcon,
  MicStateIcon,
  ScreenShareIcon,
  VoiceChannelIcon,
} from "./icons/EclipseIcons";

type Props = {
  voice: ReturnType<typeof useVoiceHook>;
  channelName: string;
  onOpenVoiceChannel: () => void;
};

const wrap: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background:
    "linear-gradient(180deg, hsl(195 40% 14% / 0.42), hsl(210 18% 7% / 0.96))",
  borderTop: "1px solid var(--ec-border-subtle)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  position: "relative",
  overflow: "hidden",
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
  transition:
    "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const leaveBtn: CSSProperties = {
  ...ctrlBtn,
  background: "var(--ec-danger)",
  color: "var(--ec-accent-text)",
  borderColor: "var(--ec-danger)",
};

const statusPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "0.2rem 0.45rem",
  borderRadius: "var(--ec-radius-full)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-accent-soft)",
  color: "var(--ec-text-muted)",
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-wide)",
  textTransform: "uppercase",
};

export function VoiceMiniBar({ voice, channelName, onOpenVoiceChannel }: Props) {
  return (
    <div style={wrap} role="region" aria-label="Голосовое подключение">
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-25% auto auto -4%",
          width: 220,
          height: 140,
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(195 70% 60% / 0.14) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

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
          minWidth: 0,
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
            background: "var(--ec-accent-soft)",
            color: "var(--ec-accent)",
            boxShadow: voice.pttActive
              ? "0 0 0 1.5px var(--ec-accent), 0 0 12px hsl(195 70% 60% / 0.48)"
              : "none",
            transition: "box-shadow var(--ec-dur-fast) var(--ec-ease)",
          }}
        >
          <VoiceChannelIcon size={14} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ color: "var(--ec-text-strong)", fontWeight: 600 }}>В эфире</span>
          <span
            style={{
              color: "var(--ec-text-muted)",
              marginLeft: 6,
              display: "inline-block",
              maxWidth: 180,
              overflow: "hidden",
              textOverflow: "ellipsis",
              verticalAlign: "bottom",
              whiteSpace: "nowrap",
            }}
          >
            #{channelName}
          </span>
        </span>
      </button>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
        {voice.isCameraEnabled && (
          <span style={statusPill} title="Камера включена">
            <CameraLensIcon size={11} />
            Cam
          </span>
        )}
        {voice.isScreenShareEnabled && (
          <span style={statusPill} title="Демонстрация экрана активна">
            <ScreenShareIcon size={11} />
            Share
          </span>
        )}
        <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
          {voice.participants.length} в комнате
        </span>
      </div>

      <button
        type="button"
        onClick={() => void voice.toggleCamera()}
        style={
          voice.isCameraEnabled
            ? {
                ...ctrlBtn,
                background: "var(--ec-accent-soft)",
                color: "var(--ec-accent)",
                borderColor: "var(--ec-accent)",
              }
            : ctrlBtn
        }
        title={voice.isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
        aria-label={voice.isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
      >
        <CameraLensIcon size={14} off={!voice.isCameraEnabled} />
      </button>

      <button
        type="button"
        onClick={() => void voice.toggleMic()}
        style={
          voice.isMicMuted
            ? {
                ...ctrlBtn,
                background: "var(--ec-danger-soft)",
                color: "var(--ec-danger)",
                borderColor: "var(--ec-danger)",
              }
            : ctrlBtn
        }
        title={voice.isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
        aria-label={voice.isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
        disabled={voice.settings.micActivationMode === "push_to_talk"}
      >
        <MicStateIcon size={14} off={voice.isMicMuted} />
      </button>

      <button
        type="button"
        onClick={() => voice.toggleDeafen()}
        style={
          voice.isDeafened
            ? {
                ...ctrlBtn,
                background: "var(--ec-danger-soft)",
                color: "var(--ec-danger)",
                borderColor: "var(--ec-danger)",
              }
            : ctrlBtn
        }
        title={voice.isDeafened ? "Включить звук" : "Заглушить всех"}
        aria-label={voice.isDeafened ? "Включить звук" : "Заглушить всех"}
      >
        <HeadsetIcon size={14} off={voice.isDeafened} />
      </button>

      <button
        type="button"
        onClick={() => void voice.toggleScreenShare()}
        style={
          voice.isScreenShareEnabled
            ? {
                ...ctrlBtn,
                background: "var(--ec-accent-soft)",
                color: "var(--ec-accent)",
                borderColor: "var(--ec-accent)",
              }
            : ctrlBtn
        }
        title={voice.isScreenShareEnabled ? "Остановить демонстрацию экрана" : "Начать демонстрацию экрана"}
        aria-label={voice.isScreenShareEnabled ? "Остановить демонстрацию экрана" : "Начать демонстрацию экрана"}
      >
        <ScreenShareIcon size={14} off={!voice.isScreenShareEnabled} />
      </button>

      <button
        type="button"
        onClick={() => void voice.leave()}
        style={leaveBtn}
        title="Покинуть голосовую комнату"
        aria-label="Покинуть голосовую комнату"
      >
        <HangupIcon size={14} />
      </button>
    </div>
  );
}
