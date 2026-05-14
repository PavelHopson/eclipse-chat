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

/**
 * VoiceRoom — **immersive voice experience** (operational redesign Фаза A.5).
 *
 * Не dashboard-grid. Это:
 *   ┌─ TOP BAR     — минимально: комната · LIVE · участники
 *   ├─ ROOM CANVAS — full immersive: presence layer (floating avatars +
 *   │                speaking glow) ИЛИ cinematic video stage. Ambient
 *   │                gradients, дышащая атмосфера. Без card-in-card.
 *   └─ CONTROLS DOCK — floating bar внизу
 *
 * Убрано из старой версии: giant telemetry box, boxed hero card, boxed
 * «Голос в комнате» grid. Участники теперь — live presence layer в центре,
 * не тяжёлые dashboard-карточки. Intelligence/context живёт в правой
 * collapsible-панели (IntelligencePanel), не ломая immersion.
 */

type Props = {
  channelId: string;
  channelName: string;
  members: MemberRow[];
  occupants?: MemberRow[];
  activeVoiceChannelName?: string | null;
  voice: ReturnType<typeof useVoiceHook>;
};

/* ===== Layout ============================================== */

const roomWrap: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(ellipse 70% 55% at 22% -8%, hsl(195 70% 18% / 0.5) 0%, transparent 58%)," +
    "radial-gradient(ellipse 55% 45% at 100% 108%, hsl(252 60% 24% / 0.32) 0%, transparent 64%)," +
    "var(--ec-bg)",
};

const topBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "0 var(--ec-space-5)",
  height: 52,
  flexShrink: 0,
  position: "relative",
  zIndex: 2,
  // отделяем не рамкой, а мягкой тенью-градиентом (atmospheric depth)
  background:
    "linear-gradient(180deg, hsl(205 20% 7% / 0.92), hsl(205 20% 7% / 0))",
};

const canvas: CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: "relative",
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
  padding: "var(--ec-space-5)",
  zIndex: 1,
};

const controlsDock: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--ec-space-2)",
  margin: "0 auto var(--ec-space-4)",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  borderRadius: "var(--ec-radius-full)",
  background: "hsl(208 16% 9% / 0.82)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow:
    "0 18px 48px hsl(210 40% 2% / 0.6), 0 0 0 1px hsl(195 30% 40% / 0.12), inset 0 1px 0 hsl(195 70% 60% / 0.06)",
  position: "relative",
  zIndex: 2,
  flexWrap: "wrap",
  maxWidth: "calc(100% - var(--ec-space-8))",
};

const controlBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "var(--ec-radius-full)",
  display: "grid",
  placeItems: "center",
  background: "hsl(210 14% 14% / 0.9)",
  color: "var(--ec-text)",
  border: "1px solid hsl(195 30% 50% / 0.12)",
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

/* ===== Presence layer ====================================== */

const presenceLayer: CSSProperties = {
  flex: 1,
  display: "flex",
  flexWrap: "wrap",
  alignContent: "center",
  justifyContent: "center",
  gap: "var(--ec-space-5)",
  padding: "var(--ec-space-6) var(--ec-space-4)",
  minHeight: 0,
};

function presenceCardStyle(speaking: boolean, dimmed: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--ec-space-2)",
    padding: "var(--ec-space-4) var(--ec-space-3)",
    minWidth: 132,
    borderRadius: "var(--ec-radius-xl)",
    // no hard box — мягкая подложка + тень для depth
    background: speaking
      ? "radial-gradient(ellipse at 50% 30%, hsl(195 70% 60% / 0.16), hsl(208 16% 11% / 0.55))"
      : "hsl(208 16% 11% / 0.45)",
    boxShadow: speaking
      ? "0 0 0 1px hsl(195 70% 60% / 0.4), 0 12px 40px -8px hsl(195 70% 50% / 0.35)"
      : "0 10px 30px -12px hsl(210 40% 2% / 0.7)",
    opacity: dimmed ? 0.7 : 1,
    transition:
      "background 140ms var(--ec-ease), box-shadow 140ms var(--ec-ease), opacity var(--ec-dur-fast) var(--ec-ease)",
  };
}

const muteBadge: CSSProperties = {
  position: "absolute",
  bottom: -2,
  right: -2,
  width: 22,
  height: 22,
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-danger)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  border: "2px solid hsl(208 16% 9%)",
};

/* ===== Video stage ========================================= */

const videoStage: CSSProperties = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "var(--ec-space-3)",
  alignContent: "start",
  minHeight: 0,
};

const videoTileWrap: CSSProperties = {
  position: "relative",
  minHeight: 220,
  borderRadius: "var(--ec-radius-xl)",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 50% 18%, hsl(195 70% 60% / 0.16), transparent 50%), linear-gradient(180deg, hsl(208 14% 12%), hsl(210 12% 7%))",
  boxShadow: "0 18px 44px -14px hsl(210 40% 2% / 0.7)",
};

const videoCanvas: CSSProperties = { position: "absolute", inset: 0 };

const videoOverlay: CSSProperties = {
  position: "absolute",
  inset: "auto 0 0",
  padding: "var(--ec-space-3)",
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  background:
    "linear-gradient(180deg, transparent, hsl(210 12% 6% / 0.94) 60%)",
};

/* presence strip — компактные участники без видео под видео-сценой */
const presenceStrip: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--ec-space-2)",
  marginTop: "var(--ec-space-4)",
};

function stripChipStyle(speaking: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "0.3rem 0.7rem 0.3rem 0.3rem",
    borderRadius: "var(--ec-radius-full)",
    background: "hsl(208 16% 11% / 0.7)",
    boxShadow: speaking
      ? "0 0 0 1px hsl(195 70% 60% / 0.45), 0 0 14px -3px hsl(195 70% 55% / 0.5)"
      : "0 6px 18px -10px hsl(210 40% 2% / 0.7)",
    color: speaking ? "var(--ec-accent)" : "var(--ec-text)",
    fontSize: "var(--ec-text-xs)",
    fontWeight: speaking ? 600 : 400,
    transition: "box-shadow 140ms var(--ec-ease), color 140ms var(--ec-ease)",
  };
}

function resolveConnectionBadge(isConnected: boolean, isReconnecting: boolean, isConnecting: boolean, pttActive: boolean) {
  if (isConnected) return pttActive ? "Передача" : "В эфире";
  if (isReconnecting) return "Переподключение";
  if (isConnecting) return "Подключаемся";
  return "Готов";
}

/* ===== Speaking avatar (presence layer) ==================== */

function PresenceAvatar({
  name,
  avatar,
  size,
  speaking,
  muted,
}: {
  name: string;
  avatar: string | null;
  size: number;
  speaking: boolean;
  muted: boolean;
}) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        borderRadius: "var(--ec-radius-full)",
        boxShadow: speaking
          ? "0 0 0 2.5px var(--ec-accent), 0 0 26px hsl(195 70% 60% / 0.6)"
          : "0 0 0 1px hsl(195 30% 50% / 0.1)",
        transition: "box-shadow 120ms var(--ec-ease)",
      }}
    >
      <Avatar url={avatar} name={name} size={size} />
      {/* speaking visualization — мягкое дышащее кольцо */}
      {speaking && (
        <span
          aria-hidden
          className="ec-anim-limbus"
          style={{
            position: "absolute",
            inset: -7,
            borderRadius: "var(--ec-radius-full)",
            border: "1.5px solid hsl(195 70% 65% / 0.55)",
            pointerEvents: "none",
          }}
        />
      )}
      {muted && (
        <span style={muteBadge} aria-label="Микрофон выключен" title="Микрофон выключен">
          <MicStateIcon size={11} off />
        </span>
      )}
    </span>
  );
}

/* ===== Video tile ========================================== */

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
    element.style.objectFit = "contain";
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
        ...(isScreen ? { minHeight: 340, gridColumn: "1 / -1" } : null),
      }}
    >
      <div ref={mountRef} style={videoCanvas} />
      <div style={videoOverlay}>
        <Avatar url={avatar} name={visual.name} size={28} />
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              color: "var(--ec-text-strong)",
              fontWeight: 600,
              fontSize: "var(--ec-text-sm)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {visual.name}
            {visual.isLocal ? " · ты" : ""}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              color: "var(--ec-text-muted)",
              fontSize: "var(--ec-text-2xs)",
            }}
          >
            {isScreen ? <ScreenShareIcon size={11} /> : <CameraLensIcon size={11} />}
            {isScreen ? "Демонстрация экрана" : "Камера"}
          </span>
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

  const lookupAvatar = (identity: string): string | null =>
    members.find((row) => row.userId === identity)?.user.avatar ?? null;

  const isConnected = v.state === "connected" && v.activeChannelId === channelId;
  const isConnecting = v.state === "connecting" && v.activeChannelId === channelId;
  const isReconnecting = v.state === "reconnecting" && v.activeChannelId === channelId;
  const isJoinedHere = isConnected || isConnecting || isReconnecting;
  const isInAnotherVoice =
    Boolean(v.activeChannelId) &&
    v.activeChannelId !== channelId &&
    (v.state === "connected" || v.state === "connecting" || v.state === "reconnecting");

  const screenTracks = v.visualTracks.filter((t) => t.source === "screen");
  const cameraTracks = v.visualTracks.filter((t) => t.source === "camera");
  const hasVisual = screenTracks.length > 0 || cameraTracks.length > 0;

  // Участники с камерой уже в видео-сцене — не дублируем presence-карточкой.
  const cameraIdentities = new Set(cameraTracks.map((t) => t.identity));
  const audioOnlyParticipants = v.participants.filter(
    (p) => !cameraIdentities.has(p.identity),
  );

  const connectionBadgeText = resolveConnectionBadge(
    isConnected,
    isReconnecting,
    isConnecting,
    v.pttActive,
  );
  const statusColor = isConnected
    ? "var(--ec-status-exec)"
    : isReconnecting || isConnecting
    ? "var(--ec-status-warn)"
    : "var(--ec-status-idle)";

  const headcount = isJoinedHere ? v.participants.length : occupants.length;

  const openCtxMenu = (p: VoiceParticipant, e: React.MouseEvent) => {
    e.preventDefault();
    if (p.isLocal) return;
    setCtxMenu({
      identity: p.identity,
      name: p.name,
      avatar: lookupAvatar(p.identity),
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div style={roomWrap} className="ec-voice-room">
      {/* ── TOP BAR — минимально ─────────────────────────────── */}
      <div style={topBar}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: "var(--ec-accent)",
            background: "hsl(195 70% 60% / 0.12)",
            border: "1px solid var(--ec-border-accent)",
          }}
          aria-hidden
        >
          <VoiceChannelIcon size={15} />
        </span>
        <strong
          style={{
            color: "var(--ec-text-strong)",
            fontSize: "var(--ec-text-base)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
        >
          #{channelName}
        </strong>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: "var(--ec-text-2xs)",
            fontWeight: 700,
            letterSpacing: "var(--ec-tracking-caps)",
            textTransform: "uppercase",
            color: statusColor,
          }}
        >
          <span
            className={isConnected ? "ec-signal-dot" : undefined}
            style={
              isConnected
                ? { color: statusColor }
                : {
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "currentColor",
                    display: "inline-block",
                  }
            }
            aria-hidden
          />
          {connectionBadgeText}
        </span>
        {v.settings.micActivationMode === "push_to_talk" && isJoinedHere && (
          <span
            style={{
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-accent)",
              border: "1px solid var(--ec-border-accent)",
              borderRadius: "var(--ec-radius-full)",
              padding: "0.1rem 0.5rem",
            }}
            title={`Push-to-talk: зажми ${keyCodeToLabel(v.settings.pttKey)}`}
          >
            PTT · {keyCodeToLabel(v.settings.pttKey)}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-dim)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            whiteSpace: "nowrap",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
          </svg>
          {headcount}
        </span>
      </div>

      {/* ── ROOM CANVAS — immersive ──────────────────────────── */}
      <div style={canvas} className="ec-voice-room__body">
        {hasVisual ? (
          /* Cinematic video stage + компактная presence-полоса аудио-участников */
          <>
            <div style={videoStage} className="ec-voice-room__video-grid">
              {screenTracks.map((t) => (
                <VideoTrackTile key={t.id} visual={t} lookupAvatar={lookupAvatar} />
              ))}
              {cameraTracks.map((t) => (
                <VideoTrackTile key={t.id} visual={t} lookupAvatar={lookupAvatar} />
              ))}
            </div>
            {audioOnlyParticipants.length > 0 && (
              <div style={presenceStrip}>
                {audioOnlyParticipants.map((p) => {
                  const muted = v.settings.mutedParticipants.includes(p.identity);
                  const speaking = p.isSpeaking && !p.isMicMuted && !muted;
                  return (
                    <span
                      key={p.identity}
                      style={stripChipStyle(speaking)}
                      onContextMenu={(e) => openCtxMenu(p, e)}
                      title={p.isMicMuted ? `${p.name} — mic off` : p.name}
                    >
                      <PresenceAvatar
                        name={p.name}
                        avatar={lookupAvatar(p.identity)}
                        size={28}
                        speaking={speaking}
                        muted={p.isMicMuted}
                      />
                      {p.name}
                      {p.isLocal && (
                        <span style={{ color: "var(--ec-text-dim)", fontWeight: 500 }}>
                          {" "}· ты
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </>
        ) : isJoinedHere ? (
          /* Atmospheric presence room — floating avatars, speaking glow */
          <div style={presenceLayer}>
            {v.participants.map((p) => {
              const muted = v.settings.mutedParticipants.includes(p.identity);
              const volume = v.settings.participantVolumes[p.identity] ?? 1;
              const speaking = p.isSpeaking && !p.isMicMuted && !muted;
              return (
                <div
                  key={p.identity}
                  style={{
                    ...presenceCardStyle(speaking, muted || volume < 1),
                    cursor: p.isLocal ? "default" : "context-menu",
                  }}
                  onContextMenu={p.isLocal ? undefined : (e) => openCtxMenu(p, e)}
                >
                  <PresenceAvatar
                    name={p.name}
                    avatar={lookupAvatar(p.identity)}
                    size={72}
                    speaking={speaking}
                    muted={p.isMicMuted}
                  />
                  <span
                    style={{
                      fontSize: "var(--ec-text-sm)",
                      fontWeight: 600,
                      color: speaking ? "var(--ec-accent)" : "var(--ec-text-strong)",
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                    }}
                  >
                    {p.name}
                    {p.isLocal && (
                      <span style={{ color: "var(--ec-text-dim)", fontWeight: 500 }}> · ты</span>
                    )}
                  </span>
                  <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                    {speaking
                      ? "говорит"
                      : p.isMicMuted
                      ? "микрофон выключен"
                      : "в эфире"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Не подключён — ambient room с превью присутствующих + CTA */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--ec-space-5)",
              textAlign: "center",
              padding: "var(--ec-space-6)",
            }}
          >
            <span
              className="ec-anim-limbus"
              aria-hidden
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                color: "var(--ec-accent)",
                background:
                  "radial-gradient(circle at 50% 40%, hsl(195 70% 60% / 0.22), hsl(195 70% 60% / 0.04) 70%)",
                boxShadow: "0 0 60px -6px hsl(195 70% 55% / 0.4)",
              }}
            >
              <VoiceChannelIcon size={36} />
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 440 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--ec-text-xl)",
                  color: "var(--ec-text-strong)",
                  letterSpacing: "var(--ec-tracking-tight)",
                }}
              >
                {occupants.length > 0 ? "В комнате идёт эфир" : "Голосовая комната"}
              </h2>
              <p style={{ margin: 0, color: "var(--ec-text-muted)", lineHeight: "var(--ec-leading-relaxed)" }}>
                {occupants.length > 0
                  ? "Подключись, чтобы услышать остальных. Камера и демонстрация экрана включаются уже внутри."
                  : "Войди первым — другие участники сервера увидят тебя в эфире."}
              </p>
            </div>

            {occupants.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "var(--ec-space-3)",
                }}
              >
                {occupants.map((o) => (
                  <div
                    key={o.id}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                    title={o.user.displayName}
                  >
                    <PresenceAvatar
                      name={o.user.displayName}
                      avatar={o.user.avatar}
                      size={52}
                      speaking={false}
                      muted={false}
                    />
                    <span
                      style={{
                        fontSize: "var(--ec-text-2xs)",
                        color: "var(--ec-text-muted)",
                        maxWidth: 90,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {o.user.displayName}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void v.join(channelId)}
              disabled={v.busy}
              className="ec-btn ec-btn--primary"
              style={{ padding: "0.85rem 1.6rem", fontSize: "var(--ec-text-md)" }}
            >
              {v.busy
                ? "Подключаемся…"
                : isInAnotherVoice
                ? "Переключиться в этот эфир"
                : "Войти в голосовой канал"}
            </button>
            {isInAnotherVoice && activeVoiceChannelName && (
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                Сейчас ты в #{activeVoiceChannelName}
              </span>
            )}
          </div>
        )}
      </div>

      {v.error && (
        <p
          style={{
            margin: "0 var(--ec-space-5) var(--ec-space-2)",
            padding: "var(--ec-space-2) var(--ec-space-3)",
            color: "var(--ec-danger)",
            background: "var(--ec-danger-soft)",
            borderRadius: "var(--ec-radius-md)",
            fontSize: "var(--ec-text-sm)",
            position: "relative",
            zIndex: 2,
          }}
        >
          {v.error}
        </p>
      )}

      {/* ── CONTROLS DOCK — floating ─────────────────────────── */}
      <div style={controlsDock} className="ec-voice-room__controls">
        {!isJoinedHere ? (
          <button
            type="button"
            onClick={() => void v.join(channelId)}
            disabled={v.busy}
            className="ec-btn ec-btn--primary"
            style={{ padding: "0.7rem 1.4rem" }}
          >
            {v.busy
              ? "Подключаемся…"
              : isInAnotherVoice
              ? "Переключиться сюда"
              : "Войти"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void v.toggleMic()}
              style={
                v.pttActive ? controlBtnAccent : v.isMicMuted ? controlBtnDanger : controlBtn
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
              title={v.isScreenShareEnabled ? "Остановить демонстрацию" : "Демонстрация экрана"}
              aria-label={v.isScreenShareEnabled ? "Остановить демонстрацию" : "Демонстрация экрана"}
              disabled={!isConnected}
            >
              <ScreenShareIcon off={!v.isScreenShareEnabled} />
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "hsl(210 14% 14% / 0.9)",
                border: "1px solid hsl(195 30% 50% / 0.12)",
                borderRadius: "var(--ec-radius-full)",
                padding: "0 12px",
                height: 44,
              }}
              title={`Громкость · ${Math.round(v.settings.masterOutputVolume * 100)}%`}
            >
              <HeadsetIcon size={14} />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(v.settings.masterOutputVolume * 100)}
                onChange={(e) => v.setMasterOutputVolume(Number(e.target.value) / 100)}
                style={{ width: 84, accentColor: "var(--ec-accent)" }}
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
