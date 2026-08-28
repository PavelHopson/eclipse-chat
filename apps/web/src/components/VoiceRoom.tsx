import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useInteractionMotion } from "../hooks/useInteractionMotion";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaViewport } from "./MediaViewport";
import { VoiceDeviceControl } from "./VoiceDeviceControl";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { RowsIcon } from "@phosphor-icons/react/dist/csr/Rows";
import { VoiceMicCheck, type VoiceMicCheckHandle } from "./VoiceMicCheck";
import { VoiceVisualStage } from "./VoiceVisualStage";
import { VoiceChatDivider } from "./VoiceChatDivider";
import { VoiceChatContext, VoiceMusicGainContext } from "./VoiceRoomContext";
import { musicSpeechGain, musicTrackTitle, speechLevel } from "../lib/voicePresentation";
import { MusicNotesIcon } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useVoiceRoomLayout } from "../hooks/useVoiceRoomLayout";
import { Avatar } from "./Avatar";
import { ParticipantContextMenu } from "./ParticipantContextMenu";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
import { VoiceStatsOverlay } from "./VoiceStatsOverlay";
import type { useVoice as useVoiceHook, VoiceParticipant, VoiceVisualTrack } from "../hooks/useVoice";
import { keyCodeToLabel } from "../hooks/useAudioDevices";
import type { MusicSession } from "../hooks/useChannelMusic";
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
  musicSession?: MusicSession | null;
  /** The existing transport is rendered once, inside this room. */
  musicPlayer?: ReactNode;
  embedded?: boolean;
  toolbarTarget?: HTMLElement | null;
  focusControl?: ReactNode;
  onOpenMusicPicker?: () => void;
  onOpenMusicExpand?: () => void;
  onOpenProfile?: (userId: string) => void;
  messages?: ReactNode;
  composer?: ReactNode;
};


/* ===== Layout ============================================== */

const controlBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "var(--ec-radius-full)",
  display: "grid",
  placeItems: "center",
  background: "var(--ec-surface-3)",
  color: "var(--ec-text)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--ec-border-subtle)",
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
  boxShadow: "0 0 0 1px var(--ec-border-accent)",
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
const videoTileWrap: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 980,
  aspectRatio: "16 / 9",
  borderRadius: "var(--ec-radius-xl)",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 50% 18%, hsl(258 90% 66% / 0.12), transparent 55%), linear-gradient(180deg, hsl(208 14% 12%), hsl(210 12% 7%))",
  boxShadow: "0 10px 30px -16px hsl(210 40% 2% / 0.5)",
  transition: "box-shadow var(--ec-dur-base) var(--ec-ease-out)",
};

const videoCanvas: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "#000",
};

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
function resolveConnectionBadge(isConnected: boolean, isReconnecting: boolean, isConnecting: boolean, pttActive: boolean) {
  if (isConnected) return pttActive ? "Передача" : "В эфире";
  if (isReconnecting) return "Переподключение";
  if (isConnecting) return "Подключаемся";
  return "Готов";
}

function formatRoomAudience(count: number): string {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} участника`;
  return `${count} участников`;
}

function connectionQualityLabel(quality: VoiceParticipant["connectionQuality"]): string {
  if (quality === "excellent") return "сеть отличная";
  if (quality === "good") return "сеть хорошая";
  if (quality === "poor") return "сеть слабая";
  if (quality === "lost") return "связь потеряна";
  return "сеть";
}

function FullscreenGlyph({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      {active ? (
        <>
          <path d="M9 4v5H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 20v-5H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 20v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M8 4H4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 4h4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 20H4v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 20h4v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/* ===== Speaking avatar (presence layer) ==================== */

function PresenceAvatar({ name, avatar, size, speaking, muted, getLevel }: {
  name: string; avatar: string | null; size: number; speaking: boolean; muted: boolean; getLevel?: () => number;
}) {
  const motionEnabled = useInteractionMotion();
  const corona = useRef<HTMLSpanElement>(null);
  const levelReader = useRef(getLevel);
  levelReader.current = getLevel;
  useEffect(() => {
    const node = corona.current;
    if (!node) return;
    let frame = 0;
    let level = 0;
    let last = 0;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      cancelAnimationFrame(frame);
      if (!speaking || muted || document.hidden) { node.style.opacity = "0"; return; }
      if (motion.matches || !motionEnabled) { node.style.transform = "none"; node.style.opacity = ".7"; return; }
      const tick = (now: number) => {
        if (now - last >= 70) {
          last = now;
          const target = speechLevel(levelReader.current?.() ?? 0);
          level += (target - level) * .4;
          node.style.transform = "scale(" + (1 + level * .24) + ")";
          node.style.opacity = String(.3 + level * .65);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    update();
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
  }, [speaking, muted, motionEnabled]);
  return <span className="ec-voice-avatar" data-speaking={speaking && !muted || undefined}>
    <Avatar url={avatar} name={name} size={size} />
    <span className="ec-voice-corona" ref={corona} aria-hidden />
    {muted && <span style={muteBadge} aria-label="Микрофон выключен" title="Микрофон выключен"><MicStateIcon size={11} off /></span>}
  </span>;
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
  const tileRef = useRef<HTMLElement | null>(null);
  // v1.1.68 — натуральные пропорции источника (см. ниже).
  const [aspect, setAspect] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === tileRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

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
        setDimensions({ width: element.videoWidth, height: element.videoHeight });
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
  const fullscreenLabel = isFullscreen ? "Выйти из полного экрана" : "Открыть на весь экран";

  const toggleFullscreen = () => {
    const tile = tileRef.current;
    if (!tile) return;
    if (document.fullscreenElement === tile) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void tile.requestFullscreen().catch(() => undefined);
  };

  return (
    <article
      ref={tileRef}
      className={
        `ec-vr-video-tile${isScreen ? " ec-vr-video-tile--screen" : " ec-vr-video-tile--camera"}` +
        (aspect == null ? " ec-vr-video-tile--loading" : "") +
        (isFullscreen ? " ec-vr-video-tile--fullscreen-active" : "")
      }
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
              alignSelf: "stretch",
              width: "100%",
              maxWidth: "none",
              maxHeight: "min(72vh, 760px)",
            }
          : null),
      }}
    >
      <MediaViewport width={dimensions.width} height={dimensions.height} enabled={isScreen}><div ref={mountRef} style={videoCanvas} /></MediaViewport>
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
      <div className="ec-vr-video-tile__fullscreen-head" aria-hidden={!isFullscreen}>
        <span className="ec-vr-video-tile__fullscreen-title">
          {visual.name}
          {visual.isLocal ? " · ты" : ""}
        </span>
        <span className="ec-vr-video-tile__fullscreen-source">
          {isScreen ? "Демонстрация экрана" : "Камера"} · Esc для выхода
        </span>
      </div>
      <button
        type="button"
        className="ec-vr-video-tile__fullscreen"
        onClick={toggleFullscreen}
        title={fullscreenLabel}
        aria-label={fullscreenLabel}
        aria-pressed={isFullscreen}
      >
        <FullscreenGlyph active={isFullscreen} />
        <span>{isFullscreen ? "Свернуть" : "На весь экран"}</span>
      </button>
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

type StagePresenceParticipant = {
  identity: string;
  name: string;
  avatar: string | null;
  isLocal: boolean;
  isLive: boolean;
  isSpeaking: boolean;
  isMicMuted: boolean;
  connectionQuality: VoiceParticipant["connectionQuality"];
  live?: VoiceParticipant;
};

export function VoiceRoom({
  channelId,
  channelName,
  members,
  occupants = [],
  activeVoiceChannelName,
  voice,
  musicSession,
  musicPlayer,
  embedded = false,
  toolbarTarget,
  focusControl,
  onOpenMusicPicker,
  onOpenMusicExpand,
  onOpenProfile,
  messages,
  composer,
}: Props) {
  const v = voice;
  const [controlPending, setControlPending] = useState<string[]>([]);
  const pendingRef = useRef(new Set<string>());
  const runControl = async (name: string, action: () => unknown) => {
    const pending = pendingRef.current;
    if (pending.has(name) || (["mic", "audio"].includes(name) && (pending.has("mic") || pending.has("audio")))) return;
    pending.add(name); setControlPending([...pending]);
    try { await action(); } finally { pending.delete(name); setControlPending([...pending]); }
  };
  const micCheckRef = useRef<VoiceMicCheckHandle>(null);
  const [joinMuted, setJoinMuted] = useState(false);
  const [unread, setUnread] = useState({ total: 0, mentions: 0 });
  const reportUnread = useCallback((next: { total: number; mentions: number }) =>
    setUnread(old => old.total === next.total && old.mentions === next.mentions ? old : next), []);
  const [duckMusic, setDuckMusic] = useState(() => {
    try { return localStorage.getItem("ec.voice.musicDucking") === "true"; } catch { return false; }
  });
  const [speechActive, setSpeechActive] = useState(false);
  const joinRoom = () => { micCheckRef.current?.stop(); void v.join(channelId, { muted: joinMuted }); };
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) optionsRef.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const hasRoomChat = Boolean(messages || composer);
  const { layout: effectiveLayoutMode, compact, selectLayout, audioCompact, selectAudioCompact } = useVoiceRoomLayout(channelId, roomRef, hasRoomChat);
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

  const roomParticipants = isJoinedHere ? v.participants : [];
  const anyoneSpeaking = roomParticipants.some(person => person.isSpeaking && !person.isMicMuted
    && !v.settings.mutedParticipants.includes(person.identity));
  useEffect(() => {
    if (anyoneSpeaking) { setSpeechActive(true); return; }
    const timeout = window.setTimeout(() => setSpeechActive(false), 600);
    return () => clearTimeout(timeout);
  }, [anyoneSpeaking]);
  const speechGain = musicSpeechGain(duckMusic, isConnected && !v.isDeafened, speechActive);
  const roomVisualTracks = isJoinedHere ? v.visualTracks : [];
  const liveIdentitySet = new Set(roomParticipants.map((p) => p.identity));
  const fallbackOccupants: StagePresenceParticipant[] = occupants
    .filter((member) => !liveIdentitySet.has(member.userId))
    .map((member) => ({
      identity: member.userId,
      name: member.user.displayName,
      avatar: member.user.avatar ?? null,
      isLocal: false,
      isLive: false,
      isSpeaking: false,
      isMicMuted: false,
      connectionQuality: "unknown",
    }));
  const stageParticipants: StagePresenceParticipant[] = [
    ...roomParticipants.map((p) => ({
      identity: p.identity,
      name: p.name,
      avatar: lookupAvatar(p.identity),
      isLocal: p.isLocal,
      isLive: true,
      isSpeaking: p.isSpeaking,
      isMicMuted: p.isMicMuted,
      connectionQuality: p.connectionQuality,
      live: p,
    })),
    ...fallbackOccupants,
  ];

  const screenTracks = roomVisualTracks.filter((t) => t.source === "screen");
  const cameraTracks = roomVisualTracks.filter((t) => t.source === "camera");
  const hasVisual = screenTracks.length > 0 || cameraTracks.length > 0;

  const speakingIdentities = new Set(roomParticipants.filter(person => person.isSpeaking && !person.isMicMuted).map(person => person.identity));

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

  const headcount = Math.max(stageParticipants.length, occupants.length);
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

  const toolbar = (
      <div className="ec-voice-room__topbar ec-voice-room--refined">
        {!embedded && <h2 className="ec-voice-room__title"><VoiceChannelIcon />{channelName}</h2>}
        <span className="ec-voice-room__status" style={{ color: statusColor }} role="status">
          <span className="ec-voice-room__status-dot" aria-hidden />
          {connectionBadgeText}
        </span>
        <span className="ec-voice-room__audience"><UsersIcon size={16} aria-hidden />{formatRoomAudience(headcount)}</span>
        {v.settings.micActivationMode === "push_to_talk" && isJoinedHere && (
          <span className="ec-voice-room__ptt">Зажми {keyCodeToLabel(v.settings.pttKey)}, чтобы говорить</span>
        )}
        {isJoinedHere && v.isScreenShareEnabled && <span className="ec-voice-sharing" role="status"><ScreenShareIcon size={14} aria-hidden />Экран в эфире</span>}
        {!hasVisual && isJoinedHere && <button type="button" className="ec-voice-density" aria-pressed={audioCompact}
          aria-label={audioCompact ? "Показать карточки участников" : "Компактный список участников"} onClick={() => selectAudioCompact(!audioCompact)}>
          {audioCompact ? <SquaresFourIcon size={15} aria-hidden /> : <RowsIcon size={15} aria-hidden />}
          <span>{audioCompact ? "Карточки" : "Компактно"}</span>
        </button>}
        {focusControl}
        {!musicSession && onOpenMusicPicker && (
          <button type="button" className="ec-voice-room__music-trigger" onClick={onOpenMusicPicker}>
            <MusicNotesIcon size={17} aria-hidden />Музыка
          </button>
        )}
        {hasRoomChat && (
          <div className="ec-voice-room__layout-switch" role="group" aria-label="Режим голосовой комнаты">
            {([
              ["split", "Звонок и чат"],
              ["stage", "Звонок"],
              ["chat", "Чат"],
            ] as const).filter(([mode]) => !compact || mode !== "split").map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={"ec-voice-room__layout-option" + (effectiveLayoutMode === mode ? " ec-voice-room__layout-option--active" : "")}
                onClick={() => selectLayout(mode)}
                aria-pressed={effectiveLayoutMode === mode}
              >{label}{mode === "chat" && unread.total > 0 && <span className="ec-voice-unread" aria-label={"Новых сообщений: " + unread.total}>{unread.total}</span>}
                {mode === "chat" && unread.mentions > 0 && <span className="ec-voice-mention" aria-label={"Упоминаний: " + unread.mentions}>@{unread.mentions}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
  );

  return (
    <div
      ref={roomRef}
      data-layout={effectiveLayoutMode}
      data-audio-density={audioCompact ? "compact" : "cards"}
      data-compact={compact || undefined}
      className={"ec-voice-room ec-voice-room--refined" + (hasVisual ? " ec-voice-room--visual" : " ec-voice-room--audio")}
    >
      {toolbarTarget ? createPortal(toolbar, toolbarTarget) : toolbar}

      {musicSession && (
        <section className="ec-voice-room__music" aria-label="Общий музыкальный плеер">
          <span className="ec-voice-room__music-label"><MusicNotesIcon size={18} aria-hidden />
            <span>{speechGain < 1 ? "Тише для тебя" : musicSession.isPlaying ? "Играет" : "На паузе"}</span>
          </span>
          <div className="ec-voice-room__transport">
            <VoiceMusicGainContext.Provider value={speechGain}>
            {musicPlayer ?? (
              <button type="button" className="ec-voice-room__track-fallback" onClick={onOpenMusicExpand} disabled={!onOpenMusicExpand}>
                {musicSession.currentTrack ? musicTrackTitle(musicSession.currentTrack.filename) : "Открыть очередь"}
              </button>
            )}
            </VoiceMusicGainContext.Provider>
          </div>
          {onOpenMusicPicker && (
            <button type="button" className="ec-voice-room__music-trigger" onClick={onOpenMusicPicker}>Сменить трек</button>
          )}
        </section>
      )}

      <div
        className={
          "ec-voice-room__split" +
          (hasVisual ? " ec-voice-room__split--visual" : " ec-voice-room__split--audio") +
          ` ec-voice-room__split--layout-${effectiveLayoutMode}`
        }
      >
        <section className="ec-voice-room__stage-column" aria-label="Эфир голосовой комнаты">
          {/* ── ROOM CANVAS — immersive ──────────────────────────── */}
          <div
            key={hasVisual ? "visual" : "audio"}
            className={"ec-voice-room__body" + (hasVisual ? " ec-voice-room__body--visual" : "")}
          >
        {hasVisual ? (
          <VoiceVisualStage channelId={channelId} tracks={roomVisualTracks}
            participants={roomParticipants} avatar={lookupAvatar}
            renderTrack={track => <VideoTrackTile key={track.id} visual={track} lookupAvatar={lookupAvatar} />}
            openParticipant={openCtxMenu} />
        ) : isJoinedHere ? (
          /* Atmospheric presence room — floating avatars, speaking glow */
          <div className="ec-voice-room__presence-grid" data-count={stageParticipants.length}>
            {stageParticipants.length === 0 && (
              <div className="ec-voice-room__pending" role="status">
                <VoiceChannelIcon size={32} />
                <strong>{isConnecting ? "Подключаемся к комнате…" : isReconnecting ? "Восстанавливаем связь…" : "Ожидаем участников"}</strong>
                <span>Чат остаётся доступен.</span>
              </div>
            )}
            {stageParticipants.map((p) => {
              const muted = p.isLive && v.settings.mutedParticipants.includes(p.identity);
              const volume = p.isLive ? v.settings.participantVolumes[p.identity] ?? 1 : 1;
              const speaking = p.isLive && p.isSpeaking && !p.isMicMuted && !muted;
              const qualityLabel = p.isLive
                ? connectionQualityLabel(p.connectionQuality)
                : "Участник есть в комнате, live-сигнал синхронизируется";
              return (
                <button
                  type="button"
                  key={p.identity}
                  className={
                    "ec-vr-presence-card" +
                    (speaking ? " ec-vr-presence-card--speaking" : "") +
                    (muted || volume < 1 ? " ec-vr-presence-card--muted" : "") +
                    (!p.isLive ? " ec-vr-presence-card--pending" : "")
                  }
                  onClick={() => onOpenProfile?.(p.identity)}
                  onContextMenu={p.live && !p.isLocal ? (e) => openCtxMenu(p.live!, e) : undefined}
                  aria-label={`Открыть профиль: ${p.name}`}
                >
                  <PresenceAvatar
                    name={p.name}
                    avatar={p.avatar}
                    size={audioCompact || compact && stageParticipants.length > 1 ? 48 : 72}
                    getLevel={() => v.getSpeechLevel(p.identity)}
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
                    {isReconnecting
                      ? "восстанавливаем связь"
                      : !p.isLive
                      ? "в комнате"
                      : speaking
                      ? "говорит"
                      : p.isMicMuted
                      ? "микрофон выключен"
                      : "в эфире"}
                  </span>
                  <span
                    className={`ec-vr-connection ec-vr-connection--${p.connectionQuality}`}
                    title={qualityLabel}
                    aria-label={qualityLabel}
                  >
                    <span aria-hidden />
                    {qualityLabel}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Не подключён — ambient room с превью присутствующих + CTA */
          <div
            className="ec-voice-room__welcome"
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
            <span className="ec-voice-room__welcome-icon" aria-hidden><VoiceChannelIcon size={36} /></span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 440 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--ec-text-xl)",
                  color: "var(--ec-text-strong)",
                  letterSpacing: "var(--ec-tracking-tight)",
                }}
              >
                {occupants.length > 0 ? "Разговор уже начался" : "Начнём разговор?"}
              </h2>
              <p style={{ margin: 0, color: "var(--ec-text-muted)", lineHeight: "var(--ec-leading-relaxed)" }}>
                {occupants.length > 0
                  ? "Подключись, чтобы услышать остальных. Камера и демонстрация экрана включаются уже внутри."
                  : "Подключись к голосу или напиши в чат. Камеру и экран можно включить позже."}
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
                  <button
                    type="button"
                    key={o.id}
                    className="ec-vr-occupant-profile"
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                    title={o.user.displayName}
                    onClick={() => onOpenProfile?.(o.userId)}
                    aria-label={`Открыть профиль: ${o.user.displayName}`}
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
                  </button>
                ))}
              </div>
            )}

            <VoiceMicCheck ref={micCheckRef} deviceId={v.settings.inputDeviceId}
              onDevice={v.setInputDevice} muted={joinMuted} onMuted={setJoinMuted} />
            <button
              type="button"
              onClick={joinRoom}
              disabled={v.busy}
              className="ec-btn ec-btn--primary ec-voice-room__join ec-voice-room__join--hero"
              style={{ padding: "0.85rem 1.6rem", fontSize: "var(--ec-text-md)" }}
            >
              {v.busy
                ? "Подключаемся…"
                : isInAnotherVoice
                ? "Переключиться в этот эфир"
                : "Подключиться к разговору"}
            </button>
            {isInAnotherVoice && activeVoiceChannelName && (
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                Сейчас ты в #{activeVoiceChannelName}
              </span>
            )}
          </div>
        )}
          </div>

        </section>

        {hasRoomChat && <VoiceChatDivider roomRef={roomRef} channelId={channelId} visual={hasVisual} compactAudio={!hasVisual && audioCompact} />}
        {(messages || composer) && (
          <aside className="ec-voice-room__chat-column" aria-label="Чат голосовой комнаты">
            <VoiceChatContext.Provider value={{ visible: effectiveLayoutMode !== "stage", reportUnread }}>
            {messages && <div className="ec-voice-room__messages">{messages}</div>}
            {composer && <div className="ec-voice-room__composer">{composer}</div>}
            </VoiceChatContext.Provider>
          </aside>
        )}
      </div>

          {v.error && (
            <p role="alert"
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
                zIndex: 8,
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
            <strong style={{ color: "var(--ec-text)" }}>Состояние подключения</strong>
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
              <XIcon size={16} aria-hidden />
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
          <div>Источники видео: {roomVisualTracks.length} · на сцене: {hasVisual ? 1 : 0}</div>
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
            Если связь не восстановилась, проверь устройства в настройках голоса.
          </div>
            </div>
          )}


      {/* One persistent call bar, also available in chat-only mode. */}
      {(isJoinedHere || effectiveLayoutMode === "chat") && (
          <div
            className="ec-voice-room__controls"
            role="group"
            aria-label="Управление голосовой комнатой"
            aria-busy={controlPending.length > 0}
            data-pending={controlPending.join(" ") || undefined}
          >
        {!isJoinedHere ? (
          <button
            type="button"
            onClick={joinRoom}
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
            <VoiceDeviceControl kind="input" selected={v.settings.inputDeviceId} onSelect={v.setInputDevice} onSettings={() => setShowSettings(true)}>
            <button
              type="button"
              onClick={() => void runControl("mic", v.toggleMic)}
              style={
                v.pttActive ? controlBtnAccent : v.isMicMuted ? controlBtnAccent : controlBtn
              }
              className={ctrlClassFor(
                v.pttActive ? controlBtnAccent : v.isMicMuted ? controlBtnAccent : controlBtn,
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
              aria-pressed={!v.isMicMuted}
              disabled={v.settings.micActivationMode === "push_to_talk" || !isConnected || (controlPending.includes("mic") || controlPending.includes("audio"))}
            >
              <MicStateIcon key={String(v.isMicMuted)} off={v.isMicMuted} />
              <span className="ec-voice-control-label">{v.settings.micActivationMode === "push_to_talk" ? "Речь: " + keyCodeToLabel(v.settings.pttKey) : controlPending.includes("mic") ? "Переключаем…" : v.isMicMuted ? "Микрофон выкл." : "Микрофон вкл."}</span>
            </button>
            </VoiceDeviceControl>

            <VoiceDeviceControl kind="output" selected={v.settings.outputDeviceId} onSelect={v.setOutputDevice} onSettings={() => setShowSettings(true)}>
            <button
              type="button"
              onClick={() => void runControl("audio", v.toggleDeafen)}
              disabled={!isConnected || controlPending.includes("mic") || controlPending.includes("audio")}
              style={v.isDeafened ? controlBtnAccent : controlBtn}
              className={ctrlClassFor(v.isDeafened ? controlBtnAccent : controlBtn)}
              title={v.isDeafened ? "Включить звук" : "Заглушить всех"}
              aria-label={v.isDeafened ? "Включить звук" : "Заглушить всех"}
              aria-pressed={v.isDeafened}
            >
              <HeadsetIcon key={String(v.isDeafened)} off={v.isDeafened} />
              <span className="ec-voice-control-label">{v.isDeafened ? "Звук выкл." : "Звук вкл."}</span>
            </button>
            </VoiceDeviceControl>

            <span className="ec-vr-control-separator" aria-hidden />

            <button
              type="button"
              onClick={() => void runControl("camera", v.toggleCamera)}
              style={v.isCameraEnabled ? controlBtnAccent : controlBtn}
              className={ctrlClassFor(v.isCameraEnabled ? controlBtnAccent : controlBtn)}
              title={v.isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
              aria-label={v.isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
              aria-pressed={v.isCameraEnabled}
              disabled={!isConnected || controlPending.includes("camera")}
            >
              <CameraLensIcon key={String(v.isCameraEnabled)} off={!v.isCameraEnabled} />
              <span className="ec-voice-control-label">{controlPending.includes("camera") ? "Подключаем…" : v.isCameraEnabled ? "Камера вкл." : "Камера"}</span>
            </button>

            <button
              type="button"
              onClick={() => void runControl("screen", v.toggleScreenShare)}
              style={v.isScreenShareEnabled ? controlBtnAccent : controlBtn}
              className={ctrlClassFor(v.isScreenShareEnabled ? controlBtnAccent : controlBtn)}
              title={v.isScreenShareEnabled ? "Остановить демонстрацию" : "Демонстрация экрана"}
              aria-label={v.isScreenShareEnabled ? "Остановить демонстрацию" : "Демонстрация экрана"}
              aria-pressed={v.isScreenShareEnabled}
              disabled={!isConnected || controlPending.includes("screen")}
            >
              <ScreenShareIcon off={!v.isScreenShareEnabled} />
              <span className="ec-voice-control-label">{controlPending.includes("screen") ? "Выбираем…" : v.isScreenShareEnabled ? "Остановить показ" : "Экран"}</span>
            </button>

            <span className="ec-vr-control-separator" aria-hidden />

            <details className="ec-voice-room__options" ref={optionsRef}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}>
              <summary aria-label="Дополнительные настройки звонка"><TuningIcon /></summary>
              <div className="ec-voice-room__options-panel">
                <label className="ec-voice-duck-option"><input type="checkbox" checked={duckMusic}
                  onChange={event => {
                    setDuckMusic(event.target.checked);
                    try { localStorage.setItem("ec.voice.musicDucking", String(event.target.checked)); } catch { /* Local only. */ }
                  }} />Приглушать музыку при речи</label>
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
              <HeadsetIcon size={14} /><span>Громкость</span>
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
              <StatsPulseIcon /><span>Качество связи</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDiagnostics((s) => !s)}
              style={showDiagnostics ? controlBtnAccent : controlBtn}
              className={ctrlClassFor(showDiagnostics ? controlBtnAccent : controlBtn)}
              title="Voice diagnostics — состояние подключения и настроек"
              aria-label="Состояние подключения"
              aria-pressed={showDiagnostics}
            >
              <InfoIcon size={18} aria-hidden /><span>Состояние подключения</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              style={controlBtn}
              className="ec-vr-ctrl"
              title="Настройки голоса"
              aria-label="Настройки голоса"
            >
              <TuningIcon /><span>Настройки голоса</span>
            </button>


              </div>
            </details>

            <span className="ec-vr-control-separator ec-vr-control-separator--danger" aria-hidden />

            <button
              type="button"
              onClick={() => void v.leave()}
              style={controlBtnDanger}
              className="ec-vr-ctrl ec-vr-ctrl--danger"
              title="Покинуть голосовую комнату"
              aria-label="Покинуть голосовую комнату"
            >
              <HangupIcon />
              <span className="ec-voice-control-label">Выйти из звонка</span>
            </button>
          </>
        )}
          </div>
      )}

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
