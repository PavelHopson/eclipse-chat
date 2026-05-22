import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { MediaScrubber } from "./MediaScrubber";
import { resolveAssetUrl } from "../lib/assets";
import { useMediaVolume } from "../hooks/useMediaVolume";
import type { MusicSession } from "../hooks/useChannelMusic";

/**
 * MusicMiniPlayer (v1.1.91 redesign) — фирменная капсула «сейчас
 * играет» в шапке канала. Единый язык плеера (см. player.css):
 * violet-«живой сигнал», equalizer-мотив, gold-кольцо ведущего.
 *
 * Render:
 *   [▶/⏸] ≋ Track name  ━━●━━  0:42 / 3:14  (host) +N  [vol][⏭][⤢][✕]
 *
 * Audio element скрыт, управляется через ref (sync с серверной
 * сессией). Latency budget — до ~500ms; late-join slight drift
 * приемлем (как Spotify Group).
 */

type Props = {
  session: MusicSession;
  derivedPositionMs: number;
  onTogglePlayPause: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onSeek: (positionMs: number) => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onExpand?: () => void;
};

function formatTime(ms: number, durationMs?: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const cur = `${m}:${s.toString().padStart(2, "0")}`;
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
    return cur;
  }
  const td = Math.floor(durationMs / 1000);
  const dm = Math.floor(td / 60);
  const ds = td % 60;
  return `${cur} / ${dm}:${ds.toString().padStart(2, "0")}`;
}

export function MusicMiniPlayer({
  session,
  derivedPositionMs,
  onTogglePlayPause,
  onSkip,
  onSeek,
  onStop,
  onExpand,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  // v1.1.58 — общая громкость медиа: shared хук с live-sync + localStorage.
  const [volume, setVolume] = useMediaVolume();
  const lastVolumeRef = useRef(volume > 0 ? volume : 0.7);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (volume > 0) lastVolumeRef.current = volume;
  }, [volume]);

  // Sync audio element с session.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!session.currentTrack) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    // v1.1.87 — видео-сессия (watch-party): синхро-<video> играет в
    // expand-плеере; фоновый <audio> мини-плеера не дублирует звук.
    if (session.currentTrack.mimeType?.startsWith("video/")) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    const src = resolveAssetUrl(session.currentTrack.url) ?? "";
    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }
    const targetSec = Math.max(0, derivedPositionMs / 1000 - 0.15);
    if (Math.abs(audio.currentTime - targetSec) > 1.5) {
      audio.currentTime = targetSec;
    }
    if (session.isPlaying) {
      void audio.play().catch(() => {
        // autoplay блокирован — пользователь должен явно нажать play.
      });
    } else {
      audio.pause();
    }
  }, [
    session.currentTrack?.id,
    session.isPlaying,
    session.startedAt,
    session.updatedAt,
  ]);

  const trackName = session.currentTrack?.filename ?? "Очередь пуста";
  const isVoiceMessage = session.currentTrack
    ? /^voice-message-/i.test(session.currentTrack.filename)
    : false;
  const playing = session.isPlaying;
  const hasTrack = !!session.currentTrack;

  return (
    <div
      className={"ec-player-mini" + (playing && hasTrack ? " is-playing" : "")}
      role="region"
      aria-label="Общий плеер канала"
    >
      <button
        type="button"
        className="ec-player-play"
        onClick={() => void onTogglePlayPause()}
        title={playing ? "Пауза" : "Воспроизвести"}
        aria-label={playing ? "Пауза" : "Воспроизвести"}
        disabled={!hasTrack}
      >
        {playing ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Мини-эквалайзер «now playing» — живой ритм при игре. */}
      {hasTrack && (
        <span
          className={"ec-eq" + (playing ? " ec-eq--playing" : "")}
          aria-hidden
        >
          <span />
          <span />
          <span />
        </span>
      )}

      <button
        type="button"
        className="ec-player-mini__name"
        onClick={onExpand}
        disabled={!onExpand}
        title={onExpand ? `${trackName} — открыть плеер` : trackName}
      >
        {isVoiceMessage ? "Голосовое" : trackName}
      </button>

      <MediaScrubber
        positionMs={derivedPositionMs}
        durationMs={durationMs ?? 0}
        onSeek={(ms) => void onSeek(ms)}
        disabled={!hasTrack}
      />

      <span className="ec-player-mini__time">
        {formatTime(derivedPositionMs, durationMs ?? undefined)}
      </span>

      <span
        className="ec-player-mini__host"
        title={`Запустил: ${session.host.displayName}`}
      >
        <Avatar
          url={session.host.avatar}
          name={session.host.displayName}
          size={16}
        />
      </span>

      {session.queue.length > 0 && (
        <span
          className="ec-player-mini__queue"
          title={`В очереди: ${session.queue.length}`}
        >
          +{session.queue.length}
        </span>
      )}

      {/* Громкость — слайдер раскрывается по наведению на группу. */}
      <span className="ec-player-mini__vol">
        <button
          type="button"
          className="ec-player-ctrl"
          onClick={() => setVolume(volume > 0 ? 0 : lastVolumeRef.current || 0.7)}
          title={volume > 0 ? "Заглушить музыку" : "Включить звук"}
          aria-label={volume > 0 ? "Заглушить музыку" : "Включить звук"}
        >
          {volume === 0 ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              {volume >= 0.55 && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
            </svg>
          )}
        </button>
        <input
          className="ec-player-range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Громкость музыки"
          title={`Громкость: ${Math.round(volume * 100)}%`}
        />
      </span>

      <button
        type="button"
        className="ec-player-ctrl"
        onClick={() => void onSkip()}
        title="Следующий"
        aria-label="Следующий трек"
        disabled={session.queue.length === 0 && !hasTrack}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M5 4l10 8-10 8z" />
          <rect x="17" y="4" width="2" height="16" />
        </svg>
      </button>

      {onExpand && (
        <button
          type="button"
          className="ec-player-ctrl"
          onClick={onExpand}
          title="Открыть плеер"
          aria-label="Открыть расширенный плеер"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      )}

      <button
        type="button"
        className="ec-player-ctrl"
        onClick={() => void onStop()}
        title="Завершить"
        aria-label="Завершить сессию"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <audio
        ref={audioRef}
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          if (Number.isFinite(audio.duration)) {
            setDurationMs(audio.duration * 1000);
          }
        }}
        preload="metadata"
        style={{ display: "none" }}
      />
    </div>
  );
}
