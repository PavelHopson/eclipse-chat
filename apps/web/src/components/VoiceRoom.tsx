import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { ParticipantContextMenu } from "./ParticipantContextMenu";
import { VoiceNotePanel } from "./VoiceNotePanel";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
import { VoiceStatsOverlay } from "./VoiceStatsOverlay";
import type { useVoice as useVoiceHook, VoiceParticipant, VoiceVisualTrack } from "../hooks/useVoice";
import { keyCodeToLabel } from "../hooks/useAudioDevices";
import type { MemberRow } from "../hooks/useMembers";
import { useTelemetry } from "../hooks/useTelemetry";
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
  /** v0.88 #23 phase 1a: socket для shared voice-note realtime updates.
   *  Если undefined — VoiceNotePanel скрыт. */
  socket?: import("socket.io-client").Socket | null;
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
    "radial-gradient(ellipse 70% 55% at 22% -8%, hsl(258 70% 18% / 0.5) 0%, transparent 58%)," +
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
    "linear-gradient(180deg, var(--ec-surface-1), transparent)",
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
  background: "var(--ec-overlay-bg)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow:
    "0 18px 48px hsl(210 40% 2% / 0.6), 0 0 0 1px hsl(258 30% 40% / 0.12), inset 0 1px 0 hsl(258 90% 66% / 0.06)",
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
  background: "var(--ec-surface-3)",
  color: "var(--ec-text)",
  border: "1px solid var(--ec-border-subtle)",
  cursor: "pointer",
  transition:
    "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease), transform var(--ec-dur-fast) var(--ec-ease)",
};

const controlBtnDanger: CSSProperties = {
  ...controlBtn,
  background: "var(--ec-danger)",
  color: "var(--ec-accent-text)",
  borderColor: "var(--ec-danger)",
};

const controlBtnAccent: CSSProperties = {
  ...controlBtn,
  background: "var(--ec-accent-soft)",
  color: "var(--ec-accent)",
  borderColor: "var(--ec-accent)",
  boxShadow: "0 0 0 1px var(--ec-border-accent), 0 0 18px -2px hsl(258 90% 66% / 0.42)",
};

// v1.5.16 — helper для mapping inline style ref → semantic className.
// Reference identity check works because controlBtn*-объекты module-scoped
// и ternary возвращают тот же ref, не новый объект.
function ctrlClassFor(style: CSSProperties): string {
  if (style === controlBtnDanger) return "ec-vr-ctrl ec-vr-ctrl--danger";
  if (style === controlBtnAccent) return "ec-vr-ctrl ec-vr-ctrl--accent";
  return "ec-vr-ctrl";
}

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
      ? "radial-gradient(ellipse at 50% 30%, hsl(258 90% 66% / 0.16), var(--ec-surface-2))"
      : "var(--ec-surface-2)",
    boxShadow: speaking
      ? "0 0 0 1px hsl(258 90% 66% / 0.4), 0 12px 40px -8px hsl(258 70% 50% / 0.35)"
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
  color: "var(--ec-accent-text)",
  display: "grid",
  placeItems: "center",
  border: "2px solid var(--ec-bg)",
};

/* ===== Video stage ========================================= */

/*
 * v0.42: CSS Grid auto-fit для предсказуемого multi-cam layout. Раньше
 * был flex 1 1 420px — на 3+ участников ломалось (некоторые тайлы
 * растягивались гораздо шире 420px, некоторые шли на новый ряд непредсказуемо).
 *
 * Grid auto-fit с minmax(280px, 1fr):
 *  - 1 cam: full-width row (max-width лимитирует через child)
 *  - 2 cams: 2 columns если ≥640px шире
 *  - 3-4 cams: 2x2 на средних viewports, 3-col на широких
 *  - N cams: auto-fit заполняет рядами по 280px+
 *
 * На mobile (≤640) — single column через responsive.css (existing rule).
 */
const videoStage: CSSProperties = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "var(--ec-space-3)",
  alignContent: "center",
  justifyItems: "center",
  alignItems: "center",
  minHeight: 0,
  padding: "var(--ec-space-2) 0",
};

const videoTileWrap: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 760,
  aspectRatio: "16 / 9",
  borderRadius: "var(--ec-radius-xl)",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 50% 18%, hsl(258 90% 66% / 0.12), transparent 55%), linear-gradient(180deg, hsl(208 14% 12%), hsl(210 12% 7%))",
  boxShadow: "0 10px 30px -16px hsl(210 40% 2% / 0.5)",
  transition: "box-shadow var(--ec-dur-base) var(--ec-ease-out)",
};

const videoCanvas: CSSProperties = { position: "absolute", inset: 0 };

// v1.5.31 — overlay chip: солидный pill в top-left с backdrop-blur. Читается
// против любого видео-контента (включая чёрные кадры recursive screen-share).
// Прежний gradient-overlay сливался с тёмными источниками.
const videoChip: CSSProperties = {
  position: "absolute",
  top: 12,
  left: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  borderRadius: "var(--ec-radius-full)",
  background: "hsla(220, 22%, 6%, 0.78)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  color: "hsl(0 0% 100%)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  border: "1px solid hsl(0 0% 100% / 0.14)",
  boxShadow: "0 4px 14px -4px hsl(210 70% 2% / 0.45)",
  maxWidth: "calc(100% - 24px)",
  minWidth: 0,
};

// v1.5.31 — centered placeholder показывается пока aspect-ratio ещё не пришло
// (loadedmetadata не fired). Большой avatar + name + статусная подпись чтобы
// user видел КТО шарит до того как первый frame пришёл.
const videoPlaceholder: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  padding: "var(--ec-space-4)",
  color: "hsl(0 0% 100% / 0.84)",
  textAlign: "center",
  pointerEvents: "none",
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
    background: "var(--ec-surface-2)",
    boxShadow: speaking
      ? "0 0 0 1px hsl(258 90% 66% / 0.45), 0 0 14px -3px hsl(258 70% 55% / 0.5)"
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
          ? "0 0 0 2.5px var(--ec-accent), 0 0 26px hsl(258 90% 66% / 0.6)"
          : "0 0 0 1px hsl(258 30% 50% / 0.1)",
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
            border: "1.5px solid hsl(258 70% 65% / 0.55)",
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
  // v1.1.68 — натуральные пропорции источника (см. ниже).
  const [aspect, setAspect] = useState<number | null>(null);

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
    // important — защита от любого CSS, который мог бы навязать cover-кроп.
    element.style.setProperty("object-fit", "contain", "important");
    element.style.background = "var(--ec-void)";

    // v1.1.68 fix «обрезано»: тайл подстраивается под натуральные пропорции
    // источника (videoWidth/videoHeight) → box совпадает с content → нет ни
    // обрезки (cover), ни чёрных полос (contain), ни искажения (fill).
    // resize ловит смену разрешения screen-share (другое окно / ресайз).
    const syncAspect = () => {
      if (element.videoWidth > 0 && element.videoHeight > 0) {
        setAspect(element.videoWidth / element.videoHeight);
      }
    };
    syncAspect();
    element.addEventListener("loadedmetadata", syncAspect);
    element.addEventListener("resize", syncAspect);

    host.appendChild(element);
    return () => {
      element.removeEventListener("loadedmetadata", syncAspect);
      element.removeEventListener("resize", syncAspect);
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
      className={`ec-vr-video-tile${isScreen ? " ec-vr-video-tile--screen" : ""}`}
      style={{
        ...videoTileWrap,
        // v1.1.68 — пропорции тайла = пропорции источника (fallback 16:9 пока
        // не пришла metadata). Источник больше не «обрезается» под 16:9.
        aspectRatio: aspect ?? videoTileWrap.aspectRatio,
        // v1.5.29/31 — screen-share tile:
        //  - gridColumn 1/-1 → tile занимает ВСЮ строку grid (раньше пытались
        //    flexBasis на grid item, тихо ignored, tile оставался clamped).
        //  - justifySelf: stretch → перебивает родительский justify-items:
        //    center (без этого grid item с width:100% всё равно мог shrink
        //    до intrinsic, derived из aspect-ratio × max-height).
        //  - maxWidth: none → не упирается в videoTileWrap.maxWidth=760.
        //  - width: 100% → forced full row width.
        //  - maxHeight: 64vh → если источник 16:9 + грид широкий, height не
        //    превышает viewport (иначе нижние controls vanish).
        ...(isScreen
          ? {
              gridColumn: "1 / -1",
              justifySelf: "stretch",
              width: "100%",
              maxWidth: "none",
              maxHeight: "64vh",
            }
          : null),
      }}
    >
      <div ref={mountRef} style={videoCanvas} />
      {/* v1.5.31 — placeholder пока aspect не пришло (loadedmetadata
       *  not fired). Большой avatar + имя + статус — user видит КТО шарит
       *  до того как первый frame отрендерился. Hide когда aspect loaded. */}
      {aspect == null && (
        <div style={videoPlaceholder} aria-hidden>
          <Avatar url={avatar} name={visual.name} size={64} />
          <span
            style={{
              color: "hsl(0 0% 100%)",
              fontWeight: 600,
              fontSize: "var(--ec-text-base)",
            }}
          >
            {visual.name}
            {visual.isLocal ? " · ты" : ""}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "hsl(0 0% 100% / 0.72)",
              fontSize: "var(--ec-text-2xs)",
            }}
          >
            {isScreen ? <ScreenShareIcon size={12} /> : <CameraLensIcon size={12} />}
            {isScreen ? "Демонстрация экрана · подключается…" : "Камера · подключается…"}
          </span>
        </div>
      )}
      {/* v1.5.31 — overlay chip: top-left solid pill с blur. Читается
       *  на любом видео (включая black frames recursive screenshare). */}
      <div style={videoChip}>
        <Avatar url={avatar} name={visual.name} size={22} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {visual.name}
          {visual.isLocal ? " · ты" : ""}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "hsl(0 0% 100% / 0.82)",
            paddingLeft: 6,
            borderLeft: "1px solid hsl(0 0% 100% / 0.18)",
          }}
          aria-label={isScreen ? "Демонстрация экрана" : "Камера"}
        >
          {isScreen ? <ScreenShareIcon size={11} /> : <CameraLensIcon size={11} />}
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
  socket,
}: Props) {
  const v = voice;
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  // UXR2 — серверная телеметрия (ПАМ/ЦП/связь) переехала из глобального
  // topbar в voice diagnostics, где объясняет качество связи/нагрузку.
  // Реальные значения из /api/health; null/offline → честный «нет данных».
  const tele = useTelemetry();

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

  /**
   * v0.56 multi-publisher harden: tile budget. Когда total visual tracks
   * превышает TILE_LIMIT, мы priority-sort'им cameras и оставляем top-N в
   * main grid; остальные cameras падают в overflow presence-strip как чипы
   * с avatar + "камера" hint. Screens НИКОГДА не collapse'ятся — это самый
   * информативный источник в operational session.
   *
   * Priority в camera grid: local first (ты должен видеть себя), затем
   * speaking, затем остальные. Это даёт стабильный layout при 5+
   * участниках с камерами + screen-share поверх (типичный engineering
   * design review сценарий).
   */
  const TILE_LIMIT = 6;
  const screenSpots = Math.min(screenTracks.length, TILE_LIMIT);
  const cameraSpots = Math.max(0, TILE_LIMIT - screenSpots);

  const speakingIdentities = new Set(
    v.participants
      .filter((p) => p.isSpeaking && !p.isMicMuted)
      .map((p) => p.identity),
  );
  const sortedCameras = [...cameraTracks].sort((a, b) => {
    if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
    const aSpeaking = speakingIdentities.has(a.identity);
    const bSpeaking = speakingIdentities.has(b.identity);
    if (aSpeaking !== bSpeaking) return aSpeaking ? -1 : 1;
    return 0;
  });
  const visibleCameraTracks = sortedCameras.slice(0, cameraSpots);
  const overflowCameraIdentities = new Set(
    sortedCameras.slice(cameraSpots).map((t) => t.identity),
  );

  // Участник с ЛЮБЫМ ВИДИМЫМ visual-треком (камера в budget ИЛИ экран) уже
  // представлен в видео-сцене — не дублируем его presence-чипом (был дубль
  // «Павел · ты» при screen-share без камеры).
  const visibleVisualIdentities = new Set([
    ...screenTracks.map((t) => t.identity),
    ...visibleCameraTracks.map((t) => t.identity),
  ]);
  const audioOnlyParticipants = v.participants.filter(
    (p) =>
      !visibleVisualIdentities.has(p.identity) &&
      !overflowCameraIdentities.has(p.identity),
  );
  // Overflow camera participants — те у кого есть камера, но не попали в
  // budget. Рендерим как presence-чипы с camera-mark (отличаются от
  // audio-only визуально).
  const overflowCameraParticipants = v.participants.filter((p) =>
    overflowCameraIdentities.has(p.identity),
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
            background: "hsl(258 90% 66% / 0.12)",
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
              {visibleCameraTracks.map((t) => (
                <VideoTrackTile key={t.id} visual={t} lookupAvatar={lookupAvatar} />
              ))}
            </div>
            {(audioOnlyParticipants.length > 0 || overflowCameraParticipants.length > 0) && (
              <div style={presenceStrip}>
                {/* Overflow cameras: участники с published cameras, не вошедшие
                    в TILE_LIMIT — отдельный визуальный маркер (small camera glyph). */}
                {overflowCameraParticipants.map((p) => {
                  const muted = v.settings.mutedParticipants.includes(p.identity);
                  const speaking = p.isSpeaking && !p.isMicMuted && !muted;
                  return (
                    <span
                      key={`cam-${p.identity}`}
                      style={stripChipStyle(speaking)}
                      onContextMenu={(e) => openCtxMenu(p, e)}
                      title={`${p.name} — камера (свернута)`}
                    >
                      <PresenceAvatar
                        name={p.name}
                        avatar={lookupAvatar(p.identity)}
                        size={28}
                        speaking={speaking}
                        muted={p.isMicMuted}
                      />
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CameraLensIcon size={11} />
                        {p.name}
                      </span>
                      {p.isLocal && (
                        <span style={{ color: "var(--ec-text-dim)", fontWeight: 500 }}>
                          {" "}· ты
                        </span>
                      )}
                    </span>
                  );
                })}
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
                  className={
                    "ec-vr-presence-card" +
                    (speaking ? " ec-vr-presence-card--speaking" : "")
                  }
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
                  "radial-gradient(circle at 50% 40%, hsl(258 90% 66% / 0.22), hsl(258 90% 66% / 0.04) 70%)",
                boxShadow: "0 0 60px -6px hsl(258 70% 55% / 0.4)",
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
                  : "Войди первым — другие участники пространства увидят тебя в эфире."}
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
              className="ec-btn ec-btn--primary ec-voice-room__join ec-voice-room__join--hero"
              style={{ padding: "0.85rem 1.6rem", fontSize: "var(--ec-text-md)" }}
            >
              {v.busy
                ? "Подключаемся…"
                : isInAnotherVoice
                ? "Переключиться в этот эфир"
                : "Войти в голосовую комнату"}
            </button>
            {isInAnotherVoice && activeVoiceChannelName && (
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                Сейчас ты в #{activeVoiceChannelName}
              </span>
            )}
          </div>
        )}
        {/* v0.88 #23 phase 1a: shared voice-room notepad. Видна всегда (даже
            до join'а) — operators могут готовить agenda до встречи. */}
        {socket !== undefined && (
          <div
            style={{
              marginTop: "var(--ec-space-4)",
              display: "flex",
              flexDirection: "column",
              minHeight: 240,
            }}
          >
            <VoiceNotePanel channelId={channelId} socket={socket ?? null} />
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

      {/* ── DIAGNOSTICS PANEL (v0.41 troubleshooting helper) ─── */}
      {showDiagnostics && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 16,
            maxWidth: 340,
            padding: "var(--ec-space-3) var(--ec-space-4)",
            background: "var(--ec-surface-2)",
            borderRadius: "var(--ec-radius-md)",
            boxShadow: "var(--ec-elev-1)",
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-muted)",
            zIndex: 4,
            fontFamily: "var(--ec-font-mono)",
            lineHeight: 1.6,
          }}
          role="status"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <strong style={{ color: "var(--ec-text)" }}>Voice diagnostics</strong>
            <button
              type="button"
              onClick={() => setShowDiagnostics(false)}
              style={{
                background: "transparent",
                border: 0,
                color: "var(--ec-text-dim)",
                cursor: "pointer",
                padding: 2,
              }}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>
          <div>state: <span style={{ color: "var(--ec-text)" }}>{v.state}</span></div>
          <div>active channel: <span style={{ color: "var(--ec-text)" }}>{v.activeChannelId ?? "—"}</span></div>
          <div>mic: <span style={{ color: v.isMicMuted ? "var(--ec-warn)" : "var(--ec-status-exec)" }}>{v.isMicMuted ? "muted" : "live"}</span> · deafened: {v.isDeafened ? "yes" : "no"}</div>
          <div>mode: <span style={{ color: "var(--ec-text)" }}>{v.settings.micActivationMode}</span></div>
          <div>noise: <span style={{ color: "var(--ec-text)" }}>{v.settings.noiseSuppression}</span></div>
          <div>input device: <span style={{ color: "var(--ec-text)" }}>{v.settings.inputDeviceId ? v.settings.inputDeviceId.slice(0, 8) + "…" : "default"}</span></div>
          <div>output device: <span style={{ color: "var(--ec-text)" }}>{v.settings.outputDeviceId ? v.settings.outputDeviceId.slice(0, 8) + "…" : "default"}</span></div>
          <div>master volume: <span style={{ color: "var(--ec-text)" }}>{Math.round(v.settings.masterOutputVolume * 100)}%</span></div>
          <div>mic gain: <span style={{ color: "var(--ec-text)" }}>{Math.round(v.settings.micGain * 100)}%</span></div>
          <div>participants: <span style={{ color: "var(--ec-text)" }}>{v.participants.length}</span> · visual: <span style={{ color: "var(--ec-text)" }}>{v.visualTracks.length}</span> (screens: <span style={{ color: "var(--ec-status-exec)" }}>{screenTracks.length}</span> · cameras: <span style={{ color: "var(--ec-accent)" }}>{cameraTracks.length}</span>)</div>
          <div>tile budget: <span style={{ color: "var(--ec-text)" }}>{screenTracks.length + visibleCameraTracks.length}/{TILE_LIMIT}</span>{overflowCameraParticipants.length > 0 && (<span style={{ color: "var(--ec-status-warn)" }}> · {overflowCameraParticipants.length} камер свернуто</span>)}</div>
          <div>speaking: <span style={{ color: "var(--ec-status-exec)" }}>{speakingIdentities.size}</span></div>
          <div style={{ marginTop: 6, color: "var(--ec-text-dim)" }}>— нагрузка сервера / связь —</div>
          <div>
            ПАМ (сервер):{" "}
            <span
              style={{
                color:
                  tele.memPercent == null
                    ? "var(--ec-text-dim)"
                    : tele.memStatus === "risk"
                    ? "var(--ec-danger)"
                    : tele.memStatus === "warn"
                    ? "var(--ec-status-warn)"
                    : "var(--ec-text)",
              }}
            >
              {tele.memPercent != null ? `${tele.memPercent.toFixed(0)}%` : "нет данных"}
            </span>
          </div>
          <div>
            ЦП (сервер):{" "}
            <span
              style={{
                color:
                  tele.cpuPercent == null
                    ? "var(--ec-text-dim)"
                    : tele.cpuStatus === "risk"
                    ? "var(--ec-danger)"
                    : tele.cpuStatus === "warn"
                    ? "var(--ec-status-warn)"
                    : "var(--ec-text)",
              }}
            >
              {tele.cpuPercent != null ? `${tele.cpuPercent.toFixed(0)}%` : "нет данных"}
            </span>
          </div>
          <div>
            связь:{" "}
            <span style={{ color: tele.online ? "var(--ec-status-exec)" : "var(--ec-warn)" }}>
              {tele.online ? "онлайн" : "оффлайн"}
            </span>
            {tele.pgActive != null ? <> · pg.active={tele.pgActive}</> : null}
          </div>
          {v.error && (
            <div style={{ marginTop: 6, color: "var(--ec-danger)" }}>error: {v.error}</div>
          )}
          <div style={{ marginTop: 8, fontFamily: "inherit", color: "var(--ec-text-dim)", fontSize: "0.65rem" }}>
            Если voice сломан: открой Настройки голоса → «Сбросить голосовые настройки» в самом низу. Это вернёт все umolchaniya и обычно лечит застрявшие state'ы.
          </div>
        </div>
      )}

      {/* ── CONTROLS DOCK — floating ─────────────────────────── */}
      <div style={controlsDock} className="ec-voice-room__controls">
        {!isJoinedHere ? (
          <button
            type="button"
            onClick={() => void v.join(channelId)}
            disabled={v.busy}
            className="ec-btn ec-btn--primary ec-voice-room__join ec-voice-room__join--dock"
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
              className={ctrlClassFor(
                v.pttActive ? controlBtnAccent : v.isMicMuted ? controlBtnDanger : controlBtn,
              )}
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
              className={ctrlClassFor(v.isDeafened ? controlBtnDanger : controlBtn)}
              title={v.isDeafened ? "Включить звук" : "Заглушить всех"}
              aria-label={v.isDeafened ? "Включить звук" : "Заглушить всех"}
            >
              <HeadsetIcon off={v.isDeafened} />
            </button>

            <button
              type="button"
              onClick={() => void v.toggleCamera()}
              style={v.isCameraEnabled ? controlBtnAccent : controlBtn}
              className={ctrlClassFor(v.isCameraEnabled ? controlBtnAccent : controlBtn)}
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
              className={ctrlClassFor(v.isScreenShareEnabled ? controlBtnAccent : controlBtn)}
              title={v.isScreenShareEnabled ? "Остановить демонстрацию" : "Демонстрация экрана"}
              aria-label={v.isScreenShareEnabled ? "Остановить демонстрацию" : "Демонстрация экрана"}
              disabled={!isConnected}
            >
              <ScreenShareIcon off={!v.isScreenShareEnabled} />
            </button>

            <div
              className="ec-vr-volume"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--ec-surface-3)",
                border: "1px solid var(--ec-border-subtle)",
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
              className={ctrlClassFor(showStats ? controlBtnAccent : controlBtn)}
              title="Сетевая диагностика (Ctrl+Shift+`)"
              aria-label="Сетевая диагностика"
              aria-pressed={showStats}
            >
              <StatsPulseIcon />
            </button>

            <button
              type="button"
              onClick={() => setShowDiagnostics((s) => !s)}
              style={showDiagnostics ? controlBtnAccent : controlBtn}
              className={ctrlClassFor(showDiagnostics ? controlBtnAccent : controlBtn)}
              title="Voice diagnostics — состояние подключения и настроек"
              aria-label="Voice diagnostics"
              aria-pressed={showDiagnostics}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              style={controlBtn}
              className="ec-vr-ctrl"
              title="Настройки голоса"
              aria-label="Настройки голоса"
            >
              <TuningIcon />
            </button>

            <button
              type="button"
              onClick={() => void v.leave()}
              style={controlBtnDanger}
              className="ec-vr-ctrl ec-vr-ctrl--danger"
              title="Покинуть голосовую комнату"
              aria-label="Покинуть голосовую комнату"
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
