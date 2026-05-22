import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { apiJson } from "../lib/api";
import { resolveAssetUrl } from "../lib/assets";
import { MediaScrubber } from "./MediaScrubber";
import type { MusicSession } from "../hooks/useChannelMusic";

/**
 * MusicExpandModal (v1.1.91 redesign) — расширенный плеер, «сигнальный
 * пульт». Showpiece фирменного медиа-языка (см. player.css):
 * большая waveform-дорожка с атмосферной violet-подложкой,
 * выразительный transport, очередь с подсветкой «следующего».
 *
 * Host (или MOD на backend) перематывает кликом/перетаскиванием по
 * вейвформе — server-side seek, все слушатели ре-синхронятся.
 * Для видео-трека (watch-party) — синхро-<video> + MediaScrubber.
 */

type Props = {
  session: MusicSession;
  derivedPositionMs: number;
  currentUserId: string;
  onClose: () => void;
  onTogglePlayPause: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onSeek: (positionMs: number) => void | Promise<void>;
  onStop: () => void | Promise<void>;
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
  onClose,
  onTogglePlayPause,
  onSkip,
  onSeek,
  onStop,
}: Props) {
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
    { id: string; filename: string }[]
  >([]);

  // Probe длительности аудио-трека.
  useEffect(() => {
    if (!track || isVideoTrack) return;
    const a = audioRef.current;
    if (!a) return;
    a.src = track.url;
    a.load();
  }, [track?.url, isVideoTrack]);

  // v1.1.87 — синхро-видео (watch-party): <video> следует за серверной
  // позицией сессии — тот же алгоритм, что у <audio> мини-плеера.
  useEffect(() => {
    const v = videoElRef.current;
    if (!v || !isVideoTrack || !track) return;
    const src = resolveAssetUrl(track.url) ?? "";
    if (v.src !== src) {
      v.src = src;
      v.load();
    }
    const targetSec = Math.max(0, derivedPositionMs / 1000 - 0.15);
    if (Math.abs(v.currentTime - targetSec) > 1.5) {
      v.currentTime = targetSec;
    }
    if (session.isPlaying) {
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [
    isVideoTrack,
    track?.id,
    session.isPlaying,
    session.startedAt,
    session.updatedAt,
  ]);

  // Резолв очереди (attachment IDs → имена).
  const queueKey = session.queue.join(",");
  useEffect(() => {
    let cancelled = false;
    if (session.queue.length === 0) {
      setQueueTracks([]);
      return;
    }
    void apiJson<{ queue: { id: string; filename: string }[] }>(
      `/api/channels/${encodeURIComponent(session.channelId)}/music/queue`,
    )
      .then((d) => {
        if (!cancelled) setQueueTracks(d.queue);
      })
      .catch(() => {
        if (!cancelled) setQueueTracks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session.channelId, queueKey]);

  // Fallback peaks для legacy attachments без сохранённых waveformPeaks.
  const peaks = useMemo<number[]>(() => {
    if (track?.waveformPeaks && track.waveformPeaks.length > 0) {
      return track.waveformPeaks;
    }
    const N = 64;
    const out: number[] = [];
    for (let i = 0; i < N; i++) {
      out.push(Math.round(45 + 25 * Math.abs(Math.sin((i / N) * Math.PI * 3))));
    }
    return out;
  }, [track?.waveformPeaks]);

  const isHost = session.host.id === currentUserId;
  const seekable = isHost && durationMs != null && durationMs > 0 && !!track;

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
    if (!seekable) return;
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
    void onSeek(committed * durationMs);
  };

  const playing = session.isPlaying;

  return (
    <Modal
      title={isVideoTrack ? "Совместный просмотр" : "Совместное прослушивание"}
      width={620}
      onClose={onClose}
    >
      <div className="ec-player-expand">
        {/* Заголовок — трек + ведущий + часы. */}
        <div className="ec-player-expand__head">
          <div style={{ minWidth: 0 }}>
            <h3
              className="ec-player-expand__title"
              title={track?.filename ?? "Очередь пуста"}
            >
              {track?.filename ?? "Очередь пуста"}
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
                  : derivedPositionMs,
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
              <video
                ref={videoElRef}
                className="ec-player-expand__video"
                playsInline
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d)) setDurationMs(d * 1000);
                }}
              />
              <div style={{ marginTop: "var(--ec-space-3)" }}>
                <MediaScrubber
                  positionMs={derivedPositionMs}
                  durationMs={durationMs ?? 0}
                  onSeek={(ms) => void onSeek(ms)}
                  disabled={!isHost}
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
              {/* Большая waveform — реальные peaks трека: сыгранное в
                  accent, остальное приглушено. Бары статичны (это
                  данные, не декор). Единственный «живой» элемент —
                  playhead: линия + светящийся узел, движется с
                  прогрессом. Host кликает/тащит → server-side seek;
                  hover показывает время точки до коммита. */}
              <div className="ec-player-expand__wave-wrap">
                <svg
                  ref={waveformRef}
                  className="ec-player-expand__wave"
                  viewBox={`0 0 ${peaks.length * 4} 100`}
                  preserveAspectRatio="none"
                  style={{ cursor: seekable ? "pointer" : "default" }}
                  onPointerDown={onWavePointerDown}
                  onPointerMove={onWavePointerMove}
                  onPointerUp={onWavePointerUp}
                  onPointerCancel={() => setDragFrac(null)}
                  onPointerLeave={() => setHoverFrac(null)}
                >
                  {peaks.map((p, i) => {
                    const h = Math.max(2, p);
                    const y = (100 - h) / 2;
                    const played = i / peaks.length <= progress;
                    return (
                      <rect
                        key={i}
                        x={i * 4 + 0.5}
                        y={y}
                        width={3}
                        height={h}
                        rx={1.5}
                        fill={played ? "var(--ec-accent)" : "var(--ec-text-dim)"}
                        opacity={played ? 0.96 : 0.36}
                      />
                    );
                  })}
                  {previewFrac != null && seekable && (
                    <line
                      x1={peaks.length * 4 * previewFrac}
                      y1={0}
                      x2={peaks.length * 4 * previewFrac}
                      y2={100}
                      stroke="var(--ec-text-strong)"
                      strokeWidth={1.5}
                      opacity={0.55}
                      strokeDasharray="3 4"
                    />
                  )}
                  <line
                    x1={peaks.length * 4 * progress}
                    y1={0}
                    x2={peaks.length * 4 * progress}
                    y2={100}
                    stroke="var(--ec-accent)"
                    strokeWidth={dragFrac != null ? 2.6 : 1.8}
                    opacity={dragFrac != null ? 1 : 0.9}
                  />
                  <circle
                    cx={peaks.length * 4 * progress}
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
                  Клик или перетаскивание по дорожке — перемотка для всех
                </div>
              )}
            </>
          )}
        </div>

        {/* Transport — выразительные контролы. */}
        <div className="ec-player-expand__transport">
          <button
            type="button"
            className="ec-player-ctrl ec-player-ctrl--lg"
            onClick={() => void onSkip()}
            title="Следующий трек"
            aria-label="Следующий"
            disabled={!isHost}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M5 4l10 8-10 8z" />
              <rect x="17" y="4" width="2" height="16" />
            </svg>
          </button>
          <button
            type="button"
            className={"ec-player-play ec-player-play--lg" + (playing ? " is-playing" : "")}
            data-state={playing ? "playing" : "paused"}
            onClick={() => void onTogglePlayPause()}
            title={playing ? "Пауза" : "Воспроизвести"}
            aria-label={playing ? "Пауза" : "Воспроизвести"}
            disabled={!track}
          >
            {playing ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="ec-player-ctrl ec-player-ctrl--lg"
            onClick={() => void onStop()}
            title="Завершить сессию"
            aria-label="Завершить"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Очередь — список ближайших треков, «следующий» подсвечен. */}
        {queueTracks.length > 0 && (
          <div className="ec-player-queue">
            <div className="ec-player-queue__label">
              Очередь · {queueTracks.length}
            </div>
            <ol className="ec-player-queue__list">
              {queueTracks.map((t, i) => (
                <li
                  key={`${t.id}-${i}`}
                  className={
                    "ec-player-queue-row" +
                    (i === 0 ? " ec-player-queue-row--next" : "")
                  }
                >
                  <span className="ec-player-queue-row__idx">{i + 1}</span>
                  <span className="ec-player-queue-row__name" title={t.filename}>
                    {t.filename}
                  </span>
                  {i === 0 && (
                    <span className="ec-player-queue-row__tag">Далее</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

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
          style={{ display: "none" }}
          onLoadedMetadata={(e) => {
            const a = e.currentTarget;
            if (Number.isFinite(a.duration)) {
              setDurationMs(a.duration * 1000);
            }
          }}
        />
      </div>
    </Modal>
  );
}
