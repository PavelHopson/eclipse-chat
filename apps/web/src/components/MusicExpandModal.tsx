import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MediaViewport } from "./MediaViewport";
import { useMediaVolume } from "../hooks/useMediaVolume";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { PlayerStateIcon } from "./PlayerStateIcon";
import type { QueueEdit } from "../lib/mediaPresentation";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/csr/ArrowUp";
import { ArrowDownIcon } from "@phosphor-icons/react/dist/csr/ArrowDown";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { SkipForwardIcon } from "@phosphor-icons/react/dist/csr/SkipForward";
import { StopIcon } from "@phosphor-icons/react/dist/csr/Stop";
import { Avatar } from "./Avatar";
import { musicTrackTitle } from "../lib/voicePresentation";
import { boundedMediaPosition } from "../lib/musicTiming";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { Modal } from "./Modal";
import { apiJson } from "../lib/api";
import { resolveAssetUrl } from "../lib/assets";
import { MediaScrubber } from "./MediaScrubber";
import type { MusicSession } from "../hooks/useChannelMusic";
import {
  attachAnalyser,
  getAttachedAnalyser,
  getCurrentMusicAudio,
} from "../hooks/useMusicAnalyser";

import { useInteractionMotion } from "../hooks/useInteractionMotion";

const LIVE_BARS = 64;

/**
 * MusicExpandModal (v1.1.91 redesign) — расширенный плеер, «сигнальный
 * пульт». Showpiece фирменного медиа-языка (см. player.css):
 * компактная waveform-дорожка в золотом акценте Eclipse,
 * выразительный transport, очередь с подсветкой «следующего».
 *
 * Host (или MOD на backend) перематывает кликом/перетаскиванием по
 * вейвформе — server-side seek, все слушатели ре-синхронятся.
 * Для видео-трека (watch-party) — синхро-<video> + MediaScrubber.
 */

/** v1.5.14 — server audio library entry (subset of useServerAudioLibrary). */
export type LibraryTrack = {
  id: string;
  filename: string;
  channel: { id: string; name: string };
  uploader: { id: string; displayName: string };
};

type Props = {
  session: MusicSession;
  derivedPositionMs: number;
  currentUserId: string;
  canModerate?: boolean;
  onEditQueue?: (edit: QueueEdit) => Promise<boolean>;
  /** v1.5.14 — все audio attachments сервера (для playlist section).
   *  Empty array если ещё не loaded или сервер не имеет треков. */
  library?: LibraryTrack[];
  libraryLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onTogglePlayPause: () => unknown | Promise<unknown>;
  onSkip: () => unknown | Promise<unknown>;
  onSeek: (positionMs: number) => unknown | Promise<unknown>;
  onStop: () => unknown | Promise<unknown>;
  /** v1.5.14 — click трека из library: replace current + clear queue. */
  onStartTrack?: (attachmentId: string) => unknown | Promise<unknown>;
  /** v1.5.14 — добавить трек в очередь без замены current. */
  onAddToQueue?: (attachmentId: string) => unknown | Promise<unknown>;
  /** v1.5.14 — проиграть весь library / выборку: first = current,
   *  rest replace queue. */
  onStartPlaylist?: (attachmentIds: string[]) => unknown | Promise<unknown>;
};

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicExpandModal({
  session,
  derivedPositionMs,
  currentUserId,
  canModerate = false,
  onEditQueue,
  library,
  libraryLoading,
  error,
  onClose,
  onTogglePlayPause,
  onSkip,
  onSeek,
  onStop,
  onStartTrack,
  onAddToQueue,
  onStartPlaylist,
}: Props) {
  const [volume, setVolume] = useMediaVolume();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaFailure, setMediaFailure] = useState(false);
  const [queueNotice, setQueueNotice] = useState("");
  const [queueSnapshot, setQueueSnapshot] = useState<string[]>([]);
  const queueListRef = useRef<HTMLOListElement>(null);
  const queueRects = useRef(new Map<string, DOMRect>());
  const [tab, setTab] = useState<"queue" | "library">("queue");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [localBlocked, setLocalBlocked] = useState(false);
  const [queueError, setQueueError] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueRevision, setQueueRevision] = useState(0);
  const run = async (action: () => unknown) => {
    if (pendingRef.current) return;
    pendingRef.current = true; setPending(true); setActionError(null);
    try { const result = await action(); if (result === false) setActionError("Действие не выполнено. Проверь подключение и права ведущего."); }
    catch { setActionError("Действие не выполнено. Попробуй ещё раз."); }
    finally { pendingRef.current = false; setPending(false); }
  };
  const filteredLibrary = (library ?? []).filter(track => musicTrackTitle(track.filename).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  // v1.5.14 — отслеживаем какие треки сейчас в queue для UI badge'ев.
  const queuedIds = new Set(session.queue);
  const currentId = session.currentTrack?.id;
  const tracksTotal = library?.length ?? 0;
  const track = session.currentTrack;
  // v1.1.87 — watch-party: видео-трек в той же синхро-сессии.
  const isVideoTrack = !!track && track.mimeType.startsWith("video/");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<SVGSVGElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [queueTracks, setQueueTracks] = useState<
    { id: string; filename: string; queueIndex?: number }[]
  >([]);

  // Probe длительности аудио-трека.
  useEffect(() => {
    if (!track || isVideoTrack) return;
    const a = audioRef.current;
    if (!a) return;
    setDurationMs(null); setMediaLoading(true); setMediaFailure(false);
    a.src = resolveAssetUrl(track.url) ?? "";
    a.load();
  }, [track?.url, isVideoTrack]);

  // v1.1.87 — синхро-видео (watch-party): <video> следует за серверной
  // позицией сессии — тот же алгоритм, что у <audio> мини-плеера.
  useEffect(() => {
    const v = videoElRef.current;
    if (!v || !isVideoTrack || !track) return;
    const src = resolveAssetUrl(track.url) ?? "";
    if (v.getAttribute("src") !== src) {
      v.src = src;
      v.load();
    }
    const targetSec = boundedMediaPosition(derivedPositionMs - 150, Number.isFinite(v.duration) ? v.duration * 1000 : null) / 1000;
    if (Math.abs(v.currentTime - targetSec) > 1.5) {
      v.currentTime = targetSec;
    }
    if (session.isPlaying) {
      void v.play().catch(cause => { if (cause?.name !== "AbortError") setLocalBlocked(true); });
    } else {
      v.pause();
    }
  }, [
    isVideoTrack,
    track?.id,
    session.isPlaying,
    session.startedAt,
    session.updatedAt,
    session.serverNow,
  ]);

  // Резолв очереди (attachment IDs → имена).
  const queueKey = session.queue.join(",");
  useEffect(() => {
    let cancelled = false;
    setQueueError(false); setQueueLoading(false);
    if (session.queue.length === 0) {
      setQueueTracks([]);
      return;
    }
    setQueueLoading(true);
    void apiJson<{ queue: { id: string; filename: string; queueIndex?: number }[]; snapshot?: string[] }>(
      `/api/channels/${encodeURIComponent(session.channelId)}/music/queue`,
    )
      .then((d) => {
        if (!cancelled) { setQueueTracks(d.queue); setQueueSnapshot(d.snapshot ?? session.queue); }
      })
      .catch(() => {
        if (!cancelled) { setQueueTracks([]); setQueueError(true); }
      }).finally(() => { if (!cancelled) setQueueLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [session.channelId, queueKey, queueRevision]);

  // Fallback peaks для legacy attachments без сохранённых waveformPeaks.
  const peaks = useMemo<number[]>(() => {
    if (track?.waveformPeaks && track.waveformPeaks.length > 0) {
      return track.waveformPeaks;
    }
    return Array.from({ length: LIVE_BARS }, () => 24);
  }, [track?.waveformPeaks]);

  // v1.2.13 — live audio-reactive peaks через Web Audio AnalyserNode.
  // Активны только когда: трек играет + не reduced-motion + audio
  // прицеплен к analyser (MiniPlayer на play вызывает attachAnalyser).
  // Иначе fallback — статичные pre-rendered peaks (поведение v1.2.0).


  useEffect(() => {
    const media = isVideoTrack ? videoElRef.current : getCurrentMusicAudio();
    if (!media) return;
    const update = () => setLocalBlocked(session.isPlaying && media.paused && !media.ended);
    update();
    media.addEventListener("playing", update); media.addEventListener("pause", update); media.addEventListener("ended", update);
    return () => { media.removeEventListener("playing", update); media.removeEventListener("pause", update); media.removeEventListener("ended", update); };
  }, [session.isPlaying, track?.id, isVideoTrack]);
  const resumeLocal = async () => {
    const media = isVideoTrack ? videoElRef.current : getCurrentMusicAudio();
    if (!media) return;
    try { await media.play(); setLocalBlocked(false); setActionError(null); }
    catch { setActionError("Не удалось воспроизвести трек на этом устройстве. Попробуй ещё раз."); }
  };

  const isHost = session.host.id === currentUserId || canModerate;
  const seekable = isHost && durationMs != null && durationMs > 0 && !!track && !pending;

  const basePos =
    durationMs && derivedPositionMs >= 0
      ? Math.min(1, Math.max(0, derivedPositionMs / durationMs))
      : 0;
  const progress = dragFrac != null ? dragFrac : basePos;
  const previewFrac = dragFrac != null ? dragFrac : hoverFrac;

  const fracFromClientX = (clientX: number): number => {
    const el = waveformRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const onWavePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!seekable || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragFrac(fracFromClientX(e.clientX));
  };
  const onWavePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!seekable) return;
    const f = fracFromClientX(e.clientX);
    if (dragFrac != null) setDragFrac(f);
    else setHoverFrac(f);
  };
  const onWavePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragFrac == null || durationMs == null) return;
    const committed = fracFromClientX(e.clientX);
    setDragFrac(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    void run(() => onSeek(committed * durationMs));
  };

  const playing = session.isPlaying && !localBlocked && !mediaFailure;
  useEffect(() => { if (videoElRef.current) videoElRef.current.volume = volume; }, [volume, isVideoTrack]);
  const motionEnabled = useInteractionMotion();

  // Real spectrum. Update transforms only; no per-frame React tree rerenders.
  useEffect(() => {
    if (!playing || isVideoTrack || !motionEnabled) return;
    const audio = getCurrentMusicAudio();
    if (!audio || audio.paused) return;
    const analyser = getAttachedAnalyser(audio) ?? attachAnalyser(audio);
    if (!analyser) return;
    const bars = Array.from(waveformRef.current?.querySelectorAll<SVGRectElement>("rect") ?? []);
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0, last = 0;
    const tick = (now: number) => {
      if (now - last >= 40 && !audio.paused) {
        last = now; analyser.getByteFrequencyData(buffer);
        bars.forEach((bar, index) => {
          const value = buffer[Math.floor(index / Math.max(1, bars.length) * buffer.length)] ?? 0;
          const height = Number(bar.getAttribute("height")) || 24;
          bar.style.transform = "scaleY(" + Math.max(.05, Math.sqrt(value / 255) * 90 / height) + ")";
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); bars.forEach(bar => { bar.style.transform = ""; }); };
  }, [playing, isVideoTrack, motionEnabled, track?.id, peaks]);

  const displayPeaks = peaks;
  useLayoutEffect(() => {
    const rows = Array.from(queueListRef.current?.querySelectorAll<HTMLElement>("[data-queue-entry]") ?? []);
    const boxes = rows.map(row => ({ row, key: row.dataset.queueEntry!, rect: row.getBoundingClientRect() }));
    const animations: Animation[] = [];
    for (const { row, key, rect } of boxes) {
      const previous = queueRects.current.get(key);
      if (motionEnabled && previous && Math.abs(previous.top - rect.top) > 1) {
        const delta = Math.max(-120, Math.min(120, previous.top - rect.top));
        animations.push(row.animate([{ transform: "translateY(" + delta + "px)", opacity: .6 }, { transform: "none", opacity: 1 }],
          { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }));
      }
    }
    queueRects.current = new Map(boxes.map(({ key, rect }) => [key, rect]));
    return () => animations.forEach(animation => animation.cancel());
  }, [queueTracks, motionEnabled]);
  const editQueued = (from: number, action: "move" | "remove", to?: number) => {
    if (!onEditQueue || !isHost || pending || queueLoading) return;
    void run(async () => {
      const result = await onEditQueue({ action, from, ...(action === "move" ? { to } : {}), expectedQueue: queueSnapshot });
      if (result) {
        setQueueNotice(action === "remove" ? "Трек удалён из очереди" : "Порядок треков изменён");
        queueListRef.current?.focus();
      }
      setQueueRevision(value => value + 1);
      return result;
    });
  };

  return (
    <Modal
      title={isVideoTrack ? "Совместный просмотр" : "Совместное прослушивание"}
      width={760}
      className="ec-player-dialog"
      onClose={onClose}
    >
      <div className="ec-player-expand ec-player-expand--refined" aria-busy={pending} data-playing={playing}>
        <div className="ec-player-context"><span>{isVideoTrack ? "ВИДЕО" : "АУДИО"} / ОБЩИЙ ПЛЕЕР</span><span data-active={playing}>{mediaFailure ? "Нет сигнала" : localBlocked ? "Ожидает включения" : playing ? "Воспроизведение" : "На паузе"}</span></div>
        {/* Заголовок — трек + ведущий + часы. */}
        <div className="ec-player-expand__head">
          <div style={{ minWidth: 0 }}>
            <h3
              className="ec-player-expand__title"
              title={track?.filename ?? "Очередь пуста"}
            >
              {track ? musicTrackTitle(track.filename) : "Очередь пуста"}
            </h3>
            <div className="ec-player-expand__host">
              <span className="ec-player-expand__host-ring">
                <Avatar
                  url={session.host.avatar}
                  name={session.host.displayName}
                  size={18}
                />
              </span>
              <span className="ec-player-expand__host-tag">Ведущий</span>
              <span>· {session.host.displayName}</span>
            </div>
          </div>
          <span className="ec-player-expand__clock">
            <b>
              {formatClock(
                dragFrac != null && durationMs
                  ? dragFrac * durationMs
                  : boundedMediaPosition(derivedPositionMs, durationMs),
              )}
            </b>
            {durationMs ? ` / ${formatClock(durationMs)}` : ""}
          </span>
        </div>

        {/* Сцена — waveform / синхро-видео + атмосферная подложка. */}
        <div
          className={"ec-player-expand__stage" + (playing ? " is-playing" : "")}
        >
          {isVideoTrack ? (
            <>
              <div className="ec-player-shared-video"><MediaViewport width={dimensions.width} height={dimensions.height}>
              <video
                ref={videoElRef}
                className="ec-player-expand__video"
                playsInline
                onWaiting={() => setMediaLoading(true)}
                onPlaying={() => { setMediaLoading(false); setMediaFailure(false); }}
                onError={() => { setMediaFailure(true); setMediaLoading(false); }}
                onEnded={() => { if (session.host.id === currentUserId) void run(onSkip); }}
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d)) setDurationMs(d * 1000);
                  setDimensions({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight });
                  setMediaLoading(false);
                }}
              /></MediaViewport></div>
              <div style={{ marginTop: "var(--ec-space-3)" }}>
                <MediaScrubber
                  positionMs={derivedPositionMs}
                  durationMs={durationMs ?? 0}
                  onSeek={(ms) => void onSeek(ms)}
                  disabled={!isHost || pending}
                  width="100%"
                />
              </div>
              <div className="ec-player-expand__hint">
                {isHost
                  ? "Перемотка по дорожке — синхронно для всех зрителей"
                  : "Смотрите синхронно — перемоткой управляет ведущий"}
              </div>
            </>
          ) : (
            <>
              {/* Большая waveform — accent на сыгранном, остальное
                  приглушено.
                  v1.2.13: бары теперь audio-reactive — при playing
                  читаем frequency-bin'ы из AnalyserNode (Web Audio
                  API), не чаще 30fps. На pause / reduced-motion / без
                  AudioContext'a — fallback на статичные peaks трека
                  (поведение v1.2.0). Playhead: линия + узел движется
                  с прогрессом. Host кликает/тащит → server-side seek;
                  hover показывает время до коммита. */}
              <div className="ec-player-expand__wave-wrap">
                <svg
                  ref={waveformRef}
                  role={seekable ? "slider" : "img"}
                  aria-label={seekable ? "Позиция общего трека" : "Звуковая дорожка"}
                  tabIndex={seekable ? 0 : undefined}
                  aria-valuemin={seekable ? 0 : undefined}
                  aria-valuemax={seekable ? durationMs ?? undefined : undefined}
                  aria-valuenow={seekable ? boundedMediaPosition(derivedPositionMs, durationMs) : undefined}
                  aria-valuetext={seekable ? formatClock(boundedMediaPosition(derivedPositionMs, durationMs)) : undefined}
                  onKeyDown={event => {
                    if (!seekable || !durationMs) return;
                    const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? 5000 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -5000 : 0;
                    if (!delta && event.key !== "Home" && event.key !== "End") return;
                    event.preventDefault();
                    const target = event.key === "Home" ? 0 : event.key === "End" ? durationMs : derivedPositionMs + delta;
                    void run(() => onSeek(boundedMediaPosition(target, durationMs)));
                  }}
                  className="ec-player-expand__wave"
                  viewBox={`0 0 ${displayPeaks.length * 4} 100`}
                  preserveAspectRatio="none"
                  style={{ cursor: seekable ? "pointer" : "default" }}
                  onPointerDown={onWavePointerDown}
                  onPointerMove={onWavePointerMove}
                  onPointerUp={onWavePointerUp}
                  onPointerCancel={() => setDragFrac(null)}
                  onLostPointerCapture={() => setDragFrac(null)}
                  onPointerLeave={() => setHoverFrac(null)}
                >
                  {displayPeaks.map((p, i) => {
                    const h = Math.max(2, p);
                    const y = (100 - h) / 2;
                    const played = i / displayPeaks.length <= progress;
                    return (
                      <rect
                        key={i}
                        x={i * 4 + 0.5}
                        y={y}
                        width={3}
                        height={h}
                        style={{ transformBox: "view-box", transformOrigin: "center" }}
                        rx={1.5}
                        fill={played ? "var(--ec-accent)" : "var(--ec-text-dim)"}
                        opacity={played ? 0.96 : 0.36}
                      />
                    );
                  })}
                  {previewFrac != null && seekable && (
                    <line
                      x1={displayPeaks.length * 4 * previewFrac}
                      y1={0}
                      x2={displayPeaks.length * 4 * previewFrac}
                      y2={100}
                      stroke="var(--ec-text-strong)"
                      strokeWidth={1.5}
                      opacity={0.55}
                      strokeDasharray="3 4"
                    />
                  )}
                  <line
                    x1={displayPeaks.length * 4 * progress}
                    y1={0}
                    x2={displayPeaks.length * 4 * progress}
                    y2={100}
                    stroke="var(--ec-accent)"
                    strokeWidth={dragFrac != null ? 2.6 : 1.8}
                    opacity={dragFrac != null ? 1 : 0.9}
                  />
                  <circle
                    cx={displayPeaks.length * 4 * progress}
                    cy={6}
                    r={dragFrac != null ? 5 : 4}
                    fill="var(--ec-accent)"
                    className="ec-wave-node"
                  />
                </svg>
                {previewFrac != null && durationMs && seekable && (
                  <div
                    className="ec-player-expand__wave-tip"
                    style={{ left: `${previewFrac * 100}%` }}
                  >
                    {formatClock(previewFrac * durationMs)}
                  </div>
                )}
              </div>
              {seekable && (
                <div className="ec-player-expand__hint">
                  Перемотка меняет позицию для всех участников
                </div>
              )}
            </>
          )}
        </div>

        {mediaLoading && <span className="ec-media-inline-status" role="status">Загружаем медиа…</span>}
        {mediaFailure && <p className="ec-player-notice" role="alert">Не удалось загрузить медиа. <button type="button" onClick={() => {
          setMediaFailure(false); setMediaLoading(true);
          (isVideoTrack ? videoElRef.current : audioRef.current)?.load();
        }}>Повторить</button></p>}
        {localBlocked && <button type="button" className="ec-btn ec-player-local-resume" onClick={() => void resumeLocal()}>
          {isVideoTrack ? "Включить просмотр на этом устройстве" : "Включить прослушивание на этом устройстве"}
        </button>}
        {/* Transport stays visible while the library scrolls. */}
        <div className="ec-player-expand__transport">
          <button
            type="button"
            className="ec-player-ctrl ec-player-ctrl--lg"
            onClick={() => void run(onSkip)}
            title="Следующий трек"
            aria-label="Следующий"
            disabled={!isHost || pending}
          >
            <SkipForwardIcon size={19} weight="fill" aria-hidden />
          </button>
          <button
            type="button"
            className={"ec-player-play ec-player-play--lg" + (playing ? " is-playing" : "")}
            data-state={playing ? "playing" : "paused"}
            onClick={() => void run(onTogglePlayPause)}
            title={playing ? "Пауза" : "Воспроизвести"}
            aria-label={playing ? "Пауза" : "Воспроизвести"}
            disabled={!track || pending || !isHost}
          >
            <PlayerStateIcon playing={playing} size={24} />
          </button>
          <button
            type="button"
            className="ec-player-ctrl ec-player-ctrl--lg"
            onClick={() => void run(onStop)}
            title="Завершить сессию"
            aria-label="Завершить"
            disabled={pending || !isHost}
          >
            <StopIcon size={18} weight="fill" aria-hidden />
          </button>
          <label className="ec-player-local-volume"><SpeakerHighIcon size={16} aria-hidden />
            <input type="range" min={0} max={1} step={.05} value={volume} aria-label="Громкость плеера на этом устройстве" onChange={event => setVolume(Number(event.target.value))} />
            <span>{Math.round(volume * 100)}%</span>
          </label>
        </div>
        {!isHost && <p className="ec-media-inline-status">Воспроизведением управляет ведущий. Громкость меняется только у тебя.</p>}

        {(error || actionError) && <p className="ec-player-notice" role="alert">{error || actionError}</p>}
        <div className="ec-player-browser-tools">
          <div role="tablist" aria-label="Содержимое плеера" onKeyDown={event => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next = event.key === "Home" ? "queue" : event.key === "End" ? "library" : tab === "queue" ? "library" : "queue";
              setTab(next); event.currentTarget.querySelector<HTMLButtonElement>('[data-tab="' + next + '"]')?.focus();
            }
          }}>
            <button type="button" role="tab" id="ec-music-queue-tab" data-tab="queue" aria-controls="ec-music-browser" aria-selected={tab === "queue"} tabIndex={tab === "queue" ? 0 : -1} onClick={() => setTab("queue")}>Очередь <span>{session.queue.length}</span></button>
            <button type="button" role="tab" id="ec-music-library-tab" data-tab="library" aria-controls="ec-music-browser" aria-selected={tab === "library"} tabIndex={tab === "library" ? 0 : -1} onClick={() => setTab("library")}>Аудиотека <span>{tracksTotal}</span></button>
          </div>
          {tab === "library" && <input aria-label="Найти трек" placeholder="Найти трек" value={query} onChange={e => setQuery(e.target.value)} />}
        </div>
        <div className="ec-player-browser" id="ec-music-browser" role="tabpanel" aria-labelledby={tab === "queue" ? "ec-music-queue-tab" : "ec-music-library-tab"} tabIndex={0}>
        {tab === "library" && libraryLoading && <p role="status">Загружаем аудиотеку…</p>}
        {/* v1.5.14 — Аудиотека сервера: всё audio из чатов в одном
            плейлисте. Click — play. Plus — добавить в очередь. «Все» —
            проигрывать подряд (replace queue). */}
        {tab === "library" && library && library.length > 0 && (
          <div className="ec-player-library">
            <div className="ec-player-library__header">
              <span className="ec-player-library__label">
                Аудиотека · {tracksTotal} {tracksTotal === 1 ? "трек" : tracksTotal < 5 ? "трека" : "треков"}
              </span>
              {onStartPlaylist && (
                <button
                  type="button"
                  className="ec-btn ec-btn--primary ec-btn--sm"
                  onClick={() => {
                    const ids = filteredLibrary.map((t) => t.id);
                    void run(() => onStartPlaylist(ids));
                  }}
                  disabled={pending || !isHost || filteredLibrary.length === 0}
                  title="Запустить все треки подряд (заменит очередь)"
                >
                  <PlayIcon size={14} aria-hidden /> Проиграть список
                </button>
              )}
            </div>
            <ul className="ec-player-library__list">
              {filteredLibrary.map((t) => {
                const isCurrent = currentId === t.id;
                const isQueued = queuedIds.has(t.id);
                return (
                  <li
                    key={t.id}
                    className={
                      "ec-player-library-row" +
                      (isCurrent ? " ec-player-library-row--current" : "")
                    }
                  >
                    <div className="ec-player-library-row__meta">
                      <span className="ec-player-library-row__name" title={musicTrackTitle(t.filename)}>
                        {musicTrackTitle(t.filename)}
                      </span>
                      <span className="ec-player-library-row__sub">
                        #{t.channel.name} · {t.uploader.displayName}
                      </span>
                    </div>
                    {isCurrent ? (
                      <span className="ec-player-library-row__badge ec-player-library-row__badge--current">
                        {playing ? "играет" : "на паузе"}
                      </span>
                    ) : isQueued ? (
                      <span className="ec-player-library-row__badge">
                        в очереди
                      </span>
                    ) : (
                      <div className="ec-player-library-row__actions">
                        {onAddToQueue && (
                          <button
                            type="button"
                            className="ec-icon-btn ec-icon-btn--sm"
                            disabled={pending}
                            onClick={() => void run(() => onAddToQueue(t.id))}
                            title="В очередь"
                            aria-label="Добавить в очередь"
                          >
                            <PlusIcon size={16} aria-hidden />
                          </button>
                        )}
                        {onStartTrack && (
                          <button
                            type="button"
                            className="ec-icon-btn ec-icon-btn--sm"
                            disabled={pending || !isHost}
                            onClick={() => void run(() => onStartTrack(t.id))}
                            title="Воспроизвести"
                            aria-label="Воспроизвести"
                          >
                            <PlayIcon size={16} aria-hidden />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {tab === "library" && filteredLibrary.length === 0 && !libraryLoading && (
          <p className="ec-player-library__empty">
            {query ? "По этому запросу треков нет." : "В пространстве пока нет аудиофайлов."}
          </p>
        )}

        {/* Очередь — список ближайших треков, «следующий» подсвечен. */}
        {tab === "queue" && queueTracks.length > 0 && (
          <div className="ec-player-queue">
            <div className="ec-player-queue__label">
              Очередь · {queueTracks.length}
            </div>
            <ol ref={queueListRef} tabIndex={-1} aria-label="Очередь треков" className="ec-player-queue__list">
              {queueTracks.map((t, i) => (
                <li
                  key={t.id + ":" + queueTracks.slice(0, i).filter(row => row.id === t.id).length}
                  data-queue-entry={t.id + ":" + queueTracks.slice(0, i).filter(row => row.id === t.id).length}
                  className={
                    "ec-player-queue-row" +
                    (i === 0 ? " ec-player-queue-row--next" : "")
                  }
                >
                  <span className="ec-player-queue-row__idx">{i + 1}</span>
                  <span className="ec-player-queue-row__name" title={musicTrackTitle(t.filename)}>
                    {musicTrackTitle(t.filename)}
                  </span>
                  {i === 0 && <span className="ec-player-queue-row__tag">Далее</span>}
                  {isHost && onEditQueue && <div className="ec-player-queue-row__actions">
                    <button type="button" disabled={pending || queueLoading || i === 0} aria-label={"Поднять трек " + (i + 1)} onClick={() => editQueued(t.queueIndex ?? i, "move", (t.queueIndex ?? i) - 1)}><ArrowUpIcon size={15} aria-hidden /></button>
                    <button type="button" disabled={pending || queueLoading || i === queueTracks.length - 1} aria-label={"Опустить трек " + (i + 1)} onClick={() => editQueued(t.queueIndex ?? i, "move", (t.queueIndex ?? i) + 1)}><ArrowDownIcon size={15} aria-hidden /></button>
                    <button type="button" disabled={pending || queueLoading} aria-label={"Удалить трек " + (i + 1) + " из очереди"} onClick={() => editQueued(t.queueIndex ?? i, "remove")}><TrashIcon size={15} aria-hidden /></button>
                  </div>}
                </li>
              ))}
            </ol>
          </div>
        )}

        <span className="ec-sr-only" role="status">{queueNotice}</span>
        {tab === "queue" && queueLoading && <p role="status">Загружаем очередь…</p>}
        {tab === "queue" && queueError && <p role="alert">Не удалось загрузить очередь. <button type="button" onClick={() => setQueueRevision(value => value + 1)}>Повторить</button></p>}
        {tab === "queue" && !queueLoading && !queueError && queueTracks.length === 0 && <div className="ec-player-browser-empty"><strong>Дальше пока ничего нет</strong><p>Выбери следующий трек в аудиотеке.</p><button type="button" className="ec-btn ec-btn--ghost" onClick={() => setTab("library")}>Открыть аудиотеку</button></div>}
        </div>
        {!track && (
          <p className="ec-player-empty">
            Очередь пуста. Добавь audio-attachment в чат и нажми «Слушать
            вместе».
          </p>
        )}

        {/* Спрятанный audio для probe duration. */}
        <audio
          ref={audioRef}
          preload="metadata"
          onError={() => { setMediaFailure(true); setMediaLoading(false); }}
          style={{ display: "none" }}
          onLoadedMetadata={(e) => {
            const a = e.currentTarget;
            if (Number.isFinite(a.duration)) {
              setDurationMs(a.duration * 1000); setMediaLoading(false);
            }
          }}
        />
      </div>
    </Modal>
  );
}
