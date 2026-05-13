import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { ParticipantContextMenu } from "./ParticipantContextMenu";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
import { VoiceStatsOverlay } from "./VoiceStatsOverlay";
import type { useVoice as useVoiceHook, VoiceParticipant, VoiceVisualTrack } from "../hooks/useVoice";
import { keyCodeToLabel } from "../hooks/useAudioDevices";
import type { MemberRow } from "../hooks/useMembers";
import {
  CameraLensIcon,
  HeadsetIcon,
  HangupIcon,
  MicStateIcon,
  ScreenShareIcon,
  StatsPulseIcon,
  TuningIcon,
  VoiceChannelIcon,
} from "./icons/EclipseIcons";

type Props = {
  channelId: string;
  channelName: string;
  members: MemberRow[];
  occupants?: MemberRow[];
  activeVoiceChannelName?: string | null;
  voice: ReturnType<typeof useVoiceHook>;
};

const wrap: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  background:
    "radial-gradient(ellipse 68% 50% at 20% -10%, hsl(195 70% 16% / 0.42) 0%, transparent 55%), radial-gradient(ellipse 52% 40% at 100% 100%, hsl(252 60% 22% / 0.22) 0%, transparent 62%), var(--ec-bg)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "var(--ec-space-4) var(--ec-space-5)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "hsl(205 18% 9% / 0.78)",
  backdropFilter: "blur(18px)",
};

const body: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "var(--ec-space-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-5)",
};

const heroGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.95fr)",
  gap: "var(--ec-space-4)",
  alignItems: "stretch",
};

const panel: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: "var(--ec-radius-xl)",
  border: "1px solid var(--ec-border-default)",
  background:
    "linear-gradient(180deg, hsl(208 16% 10% / 0.92), hsl(210 14% 8% / 0.98))",
  boxShadow: "var(--ec-shadow-lg)",
};

const panelBody: CSSProperties = {
  position: "relative",
  zIndex: 1,
  padding: "var(--ec-space-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-4)",
  minHeight: 0,
};

const stageBoard: CSSProperties = {
  ...panel,
  minHeight: 400,
};

const stageBoardBody: CSSProperties = {
  ...panelBody,
  minHeight: 400,
  justifyContent: "space-between",
};

const boardGlow: CSSProperties = {
  position: "absolute",
  inset: "-10% auto auto -5%",
  width: 300,
  height: 240,
  borderRadius: "50%",
  background: "radial-gradient(circle, hsl(195 70% 60% / 0.18) 0%, transparent 72%)",
  pointerEvents: "none",
};

const boardRing: CSSProperties = {
  position: "absolute",
  right: -80,
  bottom: -110,
  width: 240,
  height: 240,
  borderRadius: "50%",
  border: "1px solid hsl(195 70% 60% / 0.16)",
  boxShadow: "0 0 0 28px hsl(195 70% 60% / 0.04), inset 0 0 40px hsl(195 70% 60% / 0.08)",
  pointerEvents: "none",
};

const metricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "var(--ec-space-2)",
};

const metricCard: CSSProperties = {
  borderRadius: "var(--ec-radius-lg)",
  border: "1px solid var(--ec-border-subtle)",
  background: "hsl(210 14% 10% / 0.82)",
  padding: "var(--ec-space-3)",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const tag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0.28rem 0.6rem",
  borderRadius: "var(--ec-radius-full)",
  border: "1px solid var(--ec-border-default)",
  background: "hsl(195 70% 60% / 0.08)",
  color: "var(--ec-text-muted)",
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-wide)",
  textTransform: "uppercase",
};

const statusList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

const statusRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-2)",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-subtle)",
  padding: "0.75rem 0.9rem",
  background: "hsl(210 12% 10% / 0.75)",
};

const previewOccupants: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--ec-space-2)",
};

const occupantPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "0.32rem 0.55rem 0.32rem 0.32rem",
  borderRadius: "var(--ec-radius-full)",
  border: "1px solid var(--ec-border-default)",
  background: "hsl(210 12% 11% / 0.88)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-xs)",
};

const videoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "var(--ec-space-3)",
  alignContent: "start",
};

const videoTileWrap: CSSProperties = {
  position: "relative",
  minHeight: 214,
  borderRadius: "var(--ec-radius-xl)",
  overflow: "hidden",
  border: "1px solid var(--ec-border-default)",
  background:
    "radial-gradient(circle at 50% 20%, hsl(195 70% 60% / 0.18), transparent 48%), linear-gradient(180deg, hsl(208 14% 13%), hsl(210 12% 8%))",
};

const videoCanvas: CSSProperties = {
  position: "absolute",
  inset: 0,
};

const videoOverlay: CSSProperties = {
  position: "absolute",
  inset: "auto 0 0",
  padding: "var(--ec-space-3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-2)",
  background:
    "linear-gradient(180deg, transparent, hsl(210 12% 7% / 0.92) 52%, hsl(210 12% 7% / 0.98))",
};

const audioGrid: CSSProperties = {
  display: "grid",
  gap: "var(--ec-space-3)",
  gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))",
};

const audioTile: CSSProperties = {
  position: "relative",
  background: "hsl(210 12% 10% / 0.9)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  padding: "var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  transition:
    "border-color var(--ec-dur-fast) var(--ec-ease), box-shadow var(--ec-dur-fast) var(--ec-ease), transform var(--ec-dur-fast) var(--ec-ease)",
};

const audioTileSpeaking: CSSProperties = {
  ...audioTile,
  borderColor: "var(--ec-accent)",
  boxShadow: "0 0 0 1px var(--ec-accent), 0 0 24px -3px hsl(195 70% 60% / 0.45)",
  transform: "translateY(-1px)",
};

const muteOverlay: CSSProperties = {
  position: "absolute",
  bottom: 12,
  right: 12,
  width: 24,
  height: 24,
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-danger)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  border: "2px solid hsl(210 12% 10%)",
};

const controlsBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-3) var(--ec-space-5)",
  borderTop: "1px solid var(--ec-border-subtle)",
  background: "hsl(208 14% 9% / 0.88)",
  backdropFilter: "blur(18px)",
  flexWrap: "wrap",
};

const controlBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "var(--ec-radius-full)",
  display: "grid",
  placeItems: "center",
  background: "var(--ec-surface-2)",
  color: "var(--ec-text)",
  border: "1px solid var(--ec-border-default)",
  cursor: "pointer",
  transition:
    "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease), transform var(--ec-dur-fast) var(--ec-ease)",
};

const controlBtnDanger: CSSProperties = {
  ...controlBtn,
  background: "var(--ec-danger)",
  color: "#fff",
  borderColor: "var(--ec-danger)",
};

const controlBtnAccent: CSSProperties = {
  ...controlBtn,
  background: "var(--ec-accent-soft)",
  color: "var(--ec-accent)",
  borderColor: "var(--ec-accent)",
  boxShadow: "0 0 0 1px var(--ec-border-accent), 0 0 18px -2px hsl(195 70% 60% / 0.42)",
};

const emptyHero: CSSProperties = {
  display: "grid",
  placeItems: "center",
  minHeight: 220,
  borderRadius: "var(--ec-radius-xl)",
  border: "1px solid hsl(195 70% 60% / 0.16)",
  background:
    "radial-gradient(circle at 50% 30%, hsl(195 70% 60% / 0.16) 0%, transparent 54%), linear-gradient(180deg, hsl(210 12% 10% / 0.92), hsl(210 12% 8% / 0.98))",
};

function resolveConnectionBadge(isConnected: boolean, isReconnecting: boolean, isConnecting: boolean, pttActive: boolean) {
  if (isConnected) return pttActive ? "Передача" : "В эфире";
  if (isReconnecting) return "Переподключение";
  if (isConnecting) return "Подключаемся";
  return "Готов";
}
function AudioTile({
  participant,
  lookupAvatar,
  isLocallyMuted,
  participantVolume,
  onContextMenu,
}: {
  participant: VoiceParticipant;
  lookupAvatar: (identity: string) => string | null;
  isLocallyMuted: boolean;
  participantVolume: number;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const avatar = lookupAvatar(participant.identity);
  const speaking = participant.isSpeaking && !participant.isMicMuted && !isLocallyMuted;
  const dimmed = isLocallyMuted || participantVolume < 1;

  return (
    <div
      style={{
        ...(speaking ? audioTileSpeaking : audioTile),
        ...(dimmed && !participant.isLocal ? { opacity: 0.78 } : {}),
        cursor: participant.isLocal ? "default" : "context-menu",
      }}
      onContextMenu={participant.isLocal ? undefined : onContextMenu}
    >
      <Avatar url={avatar} name={participant.name} size={88} />
      {participant.isMicMuted && (
        <span style={muteOverlay} aria-label="Микрофон выключен" title="Микрофон выключен">
          <MicStateIcon size={12} off />
        </span>
      )}
      {isLocallyMuted && (
        <span
          style={{
            ...muteOverlay,
            bottom: 12,
            left: 12,
            right: "auto",
            background: "var(--ec-text-muted)",
          }}
          aria-label="Заглушено локально"
          title="Заглушено локально для тебя"
        >
          <HeadsetIcon size={12} off />
        </span>
      )}
      <span
        style={{
          fontSize: "var(--ec-text-sm)",
          fontWeight: 600,
          color: speaking ? "var(--ec-accent)" : "var(--ec-text)",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {participant.name}
        {participant.isLocal && (
          <span style={{ color: "var(--ec-text-dim)", fontWeight: 500, marginLeft: 4 }}>(ты)</span>
        )}
        {!participant.isLocal && participantVolume !== 1 && (
          <span
            style={{
              color: "var(--ec-text-dim)",
              fontWeight: 500,
              marginLeft: 4,
              fontFamily: "var(--ec-font-mono)",
              fontSize: "0.6rem",
            }}
          >
            · {Math.round(participantVolume * 100)}%
          </span>
        )}
      </span>
      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
        {speaking ? "Передаёт голос" : participant.isMicMuted ? "Mic off" : "Слушает эфир"}
      </span>
    </div>
  );
}

function VideoTrackTile({
  visual,
  lookupAvatar,
}: {
  visual: VoiceVisualTrack;
  lookupAvatar: (identity: string) => string | null;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const element = visual.track.attach() as HTMLVideoElement;
    element.autoplay = true;
    element.playsInline = true;
    element.controls = false;
    element.muted = visual.isLocal;
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.objectFit = visual.source === "screen" ? "contain" : "cover";
    element.style.background = "#070b0f";
    host.appendChild(element);

    return () => {
      try {
        visual.track.detach(element);
      } catch {
        /* no-op */
      }
      element.srcObject = null;
      element.remove();
    };
  }, [visual]);

  const avatar = lookupAvatar(visual.identity);
  const isScreen = visual.source === "screen";

  return (
    <article
      style={{
        ...videoTileWrap,
        ...(isScreen
          ? {
              minHeight: 320,
              gridColumn: "1 / -1",
            }
          : null),
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            visual.source === "screen"
              ? "radial-gradient(circle at 50% 0%, hsl(195 70% 60% / 0.18), transparent 48%)"
              : "radial-gradient(circle at 50% 0%, hsl(220 40% 40% / 0.12), transparent 48%)",
        }}
      />
      <div ref={mountRef} style={videoCanvas} />
      <div style={videoOverlay}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar url={avatar} name={visual.name} size={30} />
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: "block",
                color: "var(--ec-text-strong)",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {visual.name}
              {visual.isLocal ? " · ты" : ""}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)" }}>
              {isScreen ? <ScreenShareIcon size={12} /> : <CameraLensIcon size={12} />}
              {isScreen ? "Демонстрация экрана" : "Камера"}
            </span>
          </span>
        </span>
        <span style={tag}>
          {isScreen ? "Screen" : "Video"}
        </span>
      </div>
    </article>
  );
}

type ContextMenuState = {
  identity: string;
  name: string;
  avatar: string | null;
  x: number;
  y: number;
};

export function VoiceRoom({
  channelId,
  channelName,
  members,
  occupants = [],
  activeVoiceChannelName,
  voice,
}: Props) {
  const v = voice;
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "Backquote") {
        e.preventDefault();
        setShowStats((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const lookupAvatar = (identity: string): string | null => {
    const member = members.find((row) => row.userId === identity);
    return member?.user.avatar ?? null;
  };

  const isConnected = v.state === "connected" && v.activeChannelId === channelId;
  const isConnecting = v.state === "connecting" && v.activeChannelId === channelId;
  const isReconnecting = v.state === "reconnecting" && v.activeChannelId === channelId;
  const isJoinedHere = isConnected || isConnecting || isReconnecting;
  const isInAnotherVoice =
    Boolean(v.activeChannelId) &&
    v.activeChannelId !== channelId &&
    (v.state === "connected" || v.state === "connecting" || v.state === "reconnecting");

  const screenTracks = v.visualTracks.filter((track) => track.source === "screen");
  const cameraTracks = v.visualTracks.filter((track) => track.source === "camera");
  const connectionBadgeText = resolveConnectionBadge(isConnected, isReconnecting, isConnecting, v.pttActive);

  return (
    <div style={wrap} className="ec-voice-room">
      <div style={header}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: "var(--ec-accent)",
            background: "hsl(195 70% 60% / 0.12)",
            border: "1px solid var(--ec-border-accent)",
          }}
          aria-hidden
        >
          <VoiceChannelIcon size={16} />
        </span>
        <div style={{ minWidth: 0 }}>
          <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-base)" }}>#{channelName}</strong>
          <div style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-xs)", marginTop: 2 }}>
            Голосовой узел системы
          </div>
        </div>
        <span
          className={isConnected ? "ec-badge ec-badge--accent" : "ec-badge"}
          style={{ marginLeft: 6, fontSize: "0.62rem" }}
        >
          {connectionBadgeText}
        </span>
        {v.settings.micActivationMode === "push_to_talk" && isJoinedHere && (
          <span
            className="ec-badge"
            title={`Push-to-talk: зажми ${keyCodeToLabel(v.settings.pttKey)} чтобы говорить`}
            style={{ fontSize: "0.62rem", borderColor: "var(--ec-accent)", color: "var(--ec-accent)" }}
          >
            PTT · {keyCodeToLabel(v.settings.pttKey)}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
          {isJoinedHere ? `${v.participants.length} в комнате` : occupants.length > 0 ? `${occupants.length} уже в эфире` : "комната свободна"}
        </span>
      </div>

      <div style={body} className="ec-voice-room__body">
        {!isJoinedHere ? (
          <section style={heroGrid} className="ec-voice-room__hero">
            <div style={stageBoard}>
              <div style={boardGlow} aria-hidden />
              <div style={boardRing} aria-hidden />
              <div style={stageBoardBody}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)", maxWidth: 520 }}>
                  <span style={tag}>
                    <VoiceChannelIcon size={12} />
                    Voice Preview
                  </span>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "clamp(1.35rem, 2vw, 1.8rem)",
                      lineHeight: 1.05,
                      letterSpacing: "var(--ec-tracking-tight)",
                      color: "var(--ec-text-strong)",
                    }}
                  >
                    Голос теперь не втягивает автоматически.
                  </h2>
                  <p style={{ margin: 0, color: "var(--ec-text-muted)", maxWidth: 44 * 8, lineHeight: "var(--ec-leading-relaxed)" }}>
                    Открывай комнату, смотри кто уже в эфире, и входи осознанно. Это убирает ощущение, что интерфейс сам
                    перекидывает тебя в голосовой режим, и одновременно готовит сцену под камеру и screen share.
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ec-space-2)" }}>
                  <button
                    type="button"
                    onClick={() => void v.join(channelId)}
                    disabled={v.busy}
                    className="ec-btn ec-btn--primary"
                    style={{ padding: "0.85rem 1.4rem" }}
                  >
                    {v.busy
                      ? "Подключаемся…"
                      : isInAnotherVoice
                      ? "Переключиться в этот эфир"
                      : "Войти в голосовой канал"}
                  </button>
                  {isInAnotherVoice && activeVoiceChannelName && (
                    <span style={{ ...tag, alignSelf: "center" }}>
                      Уже в #{activeVoiceChannelName}
                    </span>
                  )}
                </div>

                {occupants.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
                    <span style={{ fontSize: "var(--ec-text-xs)", color: "var(--ec-text-dim)", letterSpacing: "var(--ec-tracking-wide)", textTransform: "uppercase" }}>
                      Уже в комнате
                    </span>
                    <div style={previewOccupants}>
                      {occupants.map((occupant) => (
                        <span key={occupant.id} style={occupantPill}>
                          <Avatar url={occupant.user.avatar} name={occupant.user.displayName} size={24} />
                          <span>{occupant.user.displayName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside style={panel}>
              <div style={panelBody}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={tag}>
                    <StatsPulseIcon size={12} />
                    Системный статус
                  </span>
                  <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-lg)" }}>
                    Видео и демонстрация готовы
                  </strong>
                  <span style={{ color: "var(--ec-text-muted)", lineHeight: "var(--ec-leading-relaxed)" }}>
                    Камера и screen share работают в той же LiveKit-комнате. Не нужен отдельный режим, только явный вход.
                  </span>
                </div>

                <div style={metricGrid}>
                  <div style={metricCard}>
                    <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)", textTransform: "uppercase", letterSpacing: "var(--ec-tracking-wide)" }}>Состояние</span>
                    <strong style={{ color: "var(--ec-text-strong)" }}>{isInAnotherVoice ? "Другой эфир" : "Готов к входу"}</strong>
                  </div>
                  <div style={metricCard}>
                    <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)", textTransform: "uppercase", letterSpacing: "var(--ec-tracking-wide)" }}>Формат</span>
                    <strong style={{ color: "var(--ec-text-strong)" }}>Voice + Video + Share</strong>
                  </div>
                </div>

                <div style={statusList}>
                  <div style={statusRow}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <MicStateIcon size={14} />
                      Микрофон
                    </span>
                    <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)" }}>
                      {v.settings.micActivationMode === "push_to_talk"
                        ? `PTT · ${keyCodeToLabel(v.settings.pttKey)}`
                        : v.settings.micActivationMode === "voice_activity"
                        ? "Voice activity"
                        : "Open mic"}
                    </span>
                  </div>
                  <div style={statusRow}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <CameraLensIcon size={14} />
                      Камера
                    </span>
                    <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)" }}>Можно включить после входа</span>
                  </div>
                  <div style={statusRow}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <ScreenShareIcon size={14} />
                      Демонстрация
                    </span>
                    <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)" }}>Отдельная кнопка в эфире</span>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        ) : (
          <>
            <section style={heroGrid} className="ec-voice-room__hero">
              <div style={stageBoard}>
                <div style={boardGlow} aria-hidden />
                <div style={boardRing} aria-hidden />
                <div style={stageBoardBody}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--ec-space-3)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={tag}>
                        <VoiceChannelIcon size={12} />
                        Active Room
                      </span>
                      <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-lg)" }}>
                        {screenTracks.length > 0 ? "Визуальный поток активен" : cameraTracks.length > 0 ? "Видео-связь в работе" : "Эфир без видео"}
                      </strong>
                    </div>
                    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
                      <span style={tag}>
                        <MicStateIcon size={12} off={v.isMicMuted} />
                        {v.isMicMuted ? "Mic off" : "Mic live"}
                      </span>
                      <span style={tag}>
                        <CameraLensIcon size={12} off={!v.isCameraEnabled} />
                        {v.isCameraEnabled ? "Camera on" : "Camera off"}
                      </span>
                      <span style={tag}>
                        <ScreenShareIcon size={12} off={!v.isScreenShareEnabled} />
                        {v.isScreenShareEnabled ? "Screen live" : "Share off"}
                      </span>
                    </div>
                  </div>

                  {screenTracks.length > 0 || cameraTracks.length > 0 ? (
                    <div style={videoGrid} className="ec-voice-room__video-grid">
                      {screenTracks.map((track) => (
                        <VideoTrackTile key={track.id} visual={track} lookupAvatar={lookupAvatar} />
                      ))}
                      {cameraTracks.map((track) => (
                        <VideoTrackTile key={track.id} visual={track} lookupAvatar={lookupAvatar} />
                      ))}
                    </div>
                  ) : (
                    <div style={emptyHero}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--ec-space-3)", textAlign: "center", maxWidth: 420 }}>
                        <span
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            background: "hsl(195 70% 60% / 0.12)",
                            border: "1px solid hsl(195 70% 60% / 0.22)",
                            color: "var(--ec-accent)",
                            boxShadow: "0 0 0 1px hsl(195 70% 60% / 0.18), 0 0 28px hsl(195 70% 60% / 0.2)",
                          }}
                          aria-hidden
                        >
                          <VoiceChannelIcon size={28} />
                        </span>
                        <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-lg)" }}>
                          Голосовая комната активна
                        </strong>
                        <span style={{ color: "var(--ec-text-muted)", lineHeight: "var(--ec-leading-relaxed)" }}>
                          Сейчас это чистый audio-mode. Включи камеру для видеозвонка или начни демонстрацию экрана, чтобы вывести room в визуальный режим.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside style={panel}>
                <div style={panelBody}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={tag}>
                      <StatsPulseIcon size={12} />
                      Live telemetry
                    </span>
                    <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-lg)" }}>
                      Системная сводка комнаты
                    </strong>
                  </div>

                  <div style={metricGrid}>
                    <div style={metricCard}>
                      <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)", textTransform: "uppercase", letterSpacing: "var(--ec-tracking-wide)" }}>Участники</span>
                      <strong style={{ color: "var(--ec-text-strong)" }}>{v.participants.length}</strong>
                    </div>
                    <div style={metricCard}>
                      <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)", textTransform: "uppercase", letterSpacing: "var(--ec-tracking-wide)" }}>Видео-потоки</span>
                      <strong style={{ color: "var(--ec-text-strong)" }}>{v.visualTracks.length}</strong>
                    </div>
                  </div>

                  <div style={statusList}>
                    <div style={statusRow}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <HeadsetIcon size={14} off={v.isDeafened} />
                        Прослушивание
                      </span>
                      <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)" }}>
                        {v.isDeafened ? "Звук отключён" : `${Math.round(v.settings.masterOutputVolume * 100)}%`}
                      </span>
                    </div>
                    <div style={statusRow}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <MicStateIcon size={14} off={v.isMicMuted} />
                        Передача
                      </span>
                      <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)" }}>
                        {v.settings.micActivationMode === "push_to_talk"
                          ? `PTT · ${keyCodeToLabel(v.settings.pttKey)}`
                          : v.settings.micActivationMode === "voice_activity"
                          ? "Voice activity"
                          : v.isMicMuted
                          ? "Пауза"
                          : "Открытый микрофон"}
                      </span>
                    </div>
                    <div style={statusRow}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <ScreenShareIcon size={14} off={!v.isScreenShareEnabled} />
                        Демонстрация
                      </span>
                      <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)" }}>
                        {v.isScreenShareEnabled ? "Идёт трансляция" : "Не активна"}
                      </span>
                    </div>
                  </div>
                </div>
              </aside>
            </section>

            <section style={panel}>
              <div style={{ ...panelBody, paddingBottom: "var(--ec-space-5)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--ec-space-3)", flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-base)" }}>Голос в комнате</strong>
                    <div style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-xs)", marginTop: 4 }}>
                      Отдельно от видео-потоков, чтобы аудио-участники не терялись.
                    </div>
                  </div>
                  <span style={tag}>
                    {v.participants.length} participants
                  </span>
                </div>

                <div style={audioGrid} className="ec-voice-room__audio-grid">
                  {v.participants.map((participant) => {
                    const isMuted = v.settings.mutedParticipants.includes(participant.identity);
                    const volume = v.settings.participantVolumes[participant.identity] ?? 1;
                    return (
                      <AudioTile
                        key={participant.identity}
                        participant={participant}
                        lookupAvatar={lookupAvatar}
                        isLocallyMuted={isMuted}
                        participantVolume={volume}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (participant.isLocal) return;
                          setCtxMenu({
                            identity: participant.identity,
                            name: participant.name,
                            avatar: lookupAvatar(participant.identity),
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {v.error && (
        <p
          style={{
            margin: 0,
            padding: "var(--ec-space-2) var(--ec-space-5)",
            color: "var(--ec-danger)",
            background: "var(--ec-danger-soft)",
            borderTop: "1px solid var(--ec-border-subtle)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          {v.error}
        </p>
      )}

      <div style={controlsBar} className="ec-voice-room__controls">
        {!isJoinedHere ? (
          <button
            type="button"
            onClick={() => void v.join(channelId)}
            disabled={v.busy}
            className="ec-btn ec-btn--primary"
            style={{ padding: "0.78rem 1.4rem" }}
          >
            {v.busy
              ? "Подключаемся…"
              : isInAnotherVoice
              ? "Переключиться в этот канал"
              : "Войти в голосовой канал"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void v.toggleMic()}
              style={
                v.pttActive
                  ? controlBtnAccent
                  : v.isMicMuted
                  ? controlBtnDanger
                  : controlBtn
              }
              title={
                v.settings.micActivationMode === "push_to_talk"
                  ? `Push-to-talk · ${keyCodeToLabel(v.settings.pttKey)}`
                  : v.settings.micActivationMode === "voice_activity"
                  ? "Микрофон автогейт по голосу"
                  : v.isMicMuted
                  ? "Включить микрофон"
                  : "Выключить микрофон"
              }
              aria-label={v.isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
              disabled={v.settings.micActivationMode === "push_to_talk" || !isConnected}
            >
              <MicStateIcon off={v.isMicMuted} />
            </button>

            <button
              type="button"
              onClick={() => v.toggleDeafen()}
              style={v.isDeafened ? controlBtnDanger : controlBtn}
              title={v.isDeafened ? "Включить звук" : "Заглушить всех"}
              aria-label={v.isDeafened ? "Включить звук" : "Заглушить всех"}
            >
              <HeadsetIcon off={v.isDeafened} />
            </button>

            <button
              type="button"
              onClick={() => void v.toggleCamera()}
              style={v.isCameraEnabled ? controlBtnAccent : controlBtn}
              title={v.isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
              aria-label={v.isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
              disabled={!isConnected}
            >
              <CameraLensIcon off={!v.isCameraEnabled} />
            </button>

            <button
              type="button"
              onClick={() => void v.toggleScreenShare()}
              style={v.isScreenShareEnabled ? controlBtnAccent : controlBtn}
              title={v.isScreenShareEnabled ? "Остановить демонстрацию экрана" : "Начать демонстрацию экрана"}
              aria-label={v.isScreenShareEnabled ? "Остановить демонстрацию экрана" : "Начать демонстрацию экрана"}
              disabled={!isConnected}
            >
              <ScreenShareIcon off={!v.isScreenShareEnabled} />
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--ec-surface-2)",
                border: "1px solid var(--ec-border-default)",
                borderRadius: "var(--ec-radius-full)",
                padding: "0 12px",
                height: 44,
              }}
              title={`Громкость воспроизведения · ${Math.round(v.settings.masterOutputVolume * 100)}%`}
            >
              <HeadsetIcon size={14} />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(v.settings.masterOutputVolume * 100)}
                onChange={(e) => v.setMasterOutputVolume(Number(e.target.value) / 100)}
                style={{ width: 90, accentColor: "var(--ec-accent)" }}
                aria-label="Громкость воспроизведения"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowStats((s) => !s)}
              style={showStats ? controlBtnAccent : controlBtn}
              title="Сетевая диагностика (Ctrl+Shift+`)"
              aria-label="Сетевая диагностика"
              aria-pressed={showStats}
            >
              <StatsPulseIcon />
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              style={controlBtn}
              title="Настройки голоса"
              aria-label="Настройки голоса"
            >
              <TuningIcon />
            </button>

            <button
              type="button"
              onClick={() => void v.leave()}
              style={controlBtnDanger}
              title="Покинуть голосовой канал"
              aria-label="Покинуть голосовой канал"
            >
              <HangupIcon />
            </button>
          </>
        )}
      </div>

      {showSettings && <VoiceSettingsModal onClose={() => setShowSettings(false)} />}

      {showStats && (
        <VoiceStatsOverlay
          participants={v.participants}
          getRemoteStats={v.getRemoteStats}
          onClose={() => setShowStats(false)}
        />
      )}

      {ctxMenu && (
        <ParticipantContextMenu
          identity={ctxMenu.identity}
          name={ctxMenu.name}
          avatar={ctxMenu.avatar}
          volume={v.settings.participantVolumes[ctxMenu.identity] ?? 1}
          isMuted={v.settings.mutedParticipants.includes(ctxMenu.identity)}
          anchorX={ctxMenu.x}
          anchorY={ctxMenu.y}
          onVolumeChange={(volume) => v.setParticipantVolume(ctxMenu.identity, volume)}
          onResetVolume={() => v.resetParticipantVolume(ctxMenu.identity)}
          onToggleMute={() => v.toggleParticipantMute(ctxMenu.identity)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

