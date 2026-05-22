import { useEffect, useRef, useState } from "react";
import { MediaScrubber } from "./MediaScrubber";
import { useMediaVolume } from "../hooks/useMediaVolume";

/**
 * VideoPlayer (v1.1.91 redesign) — кастомный фирменный плеер для
 * видео-вложений. Нативные controls заменены целиком: единый язык
 * плеера (player.css) — `.ec-player-ctrl`, `.ec-player-play`,
 * общий `MediaScrubber`. Панель управления авто-скрывается во время
 * воспроизведения и возвращается на hover; есть фирменное
 * loading-кольцо вместо браузерного спиннера.
 *
 * Воспроизведение локальное. Синхро watch-party — MusicExpandModal.
 * onNext/onPrev — переход к соседнему видео в лайтбокс-галерее.
 */

type Props = {
  src: string;
  poster?: string;
  onNext?: () => void;
  onPrev?: () => void;
};

function fmt(sec: number): string {
  const t = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ src, poster, onNext, onPrev }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [bufferedMs, setBufferedMs] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [volume, setVolume] = useMediaVolume();
  const lastVol = useRef(volume > 0 ? volume : 0.7);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
    if (volume > 0) lastVol.current = volume;
  }, [volume]);

  useEffect(() => {
    const onFs = () =>
      setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };
  const seek = (ms: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, ms) / 1000;
    setCurrentMs(Math.max(0, ms));
  };
  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void el.requestFullscreen().catch(() => undefined);
    }
  };

  return (
    <div
      ref={containerRef}
      className="ec-video-player"
      data-playing={playing ? "true" : "false"}
      data-fullscreen={fullscreen ? "true" : "false"}
    >
      <video
        ref={videoRef}
        className="ec-video-player__video"
        src={src}
        poster={poster}
        autoPlay
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          setPlaying(true);
          setLoading(false);
        }}
        onCanPlay={() => setLoading(false)}
        onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length === 0) return;
          let end = 0;
          for (let i = 0; i < b.length; i++) end = Math.max(end, b.end(i));
          setBufferedMs(end * 1000);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDurationMs(d * 1000);
        }}
        onEnded={() => {
          setPlaying(false);
          if (onNext) onNext();
        }}
      />

      {/* Фирменный radar-ping loader «ищу сигнал» — не браузерный спиннер. */}
      {loading && (
        <div className="ec-video-player__loader ec-signal-loader" aria-hidden>
          <span className="ec-signal-loader__core" />
        </div>
      )}

      {/* Центральная play-кнопка — на паузе, когда не грузится. */}
      {!playing && !loading && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Воспроизвести"
          data-state="paused"
          className="ec-player-play ec-player-play--lg ec-video-player__center"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Панель управления — фирменная, авто-скрывается при игре. */}
      <div className="ec-video-player__bar">
        <button
          type="button"
          className="ec-player-ctrl"
          onClick={togglePlay}
          title={playing ? "Пауза" : "Воспроизвести"}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        {onPrev && (
          <button type="button" className="ec-player-ctrl" onClick={onPrev} title="Предыдущее" aria-label="Предыдущее видео">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M19 20L9 12l10-8z" />
              <rect x="5" y="4" width="2" height="16" />
            </svg>
          </button>
        )}
        {onNext && (
          <button type="button" className="ec-player-ctrl" onClick={onNext} title="Следующее" aria-label="Следующее видео">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M5 4l10 8-10 8z" />
              <rect x="17" y="4" width="2" height="16" />
            </svg>
          </button>
        )}
        <div className="ec-video-player__scrub">
          <MediaScrubber
            positionMs={currentMs}
            durationMs={durationMs}
            bufferedMs={bufferedMs}
            onSeek={seek}
            width="100%"
          />
        </div>
        <span className="ec-video-player__time">
          {fmt(currentMs / 1000)} / {fmt(durationMs / 1000)}
        </span>
        <button
          type="button"
          className="ec-player-ctrl"
          onClick={() => setVolume(volume > 0 ? 0 : lastVol.current || 0.7)}
          title={volume > 0 ? "Заглушить" : "Включить звук"}
          aria-label={volume > 0 ? "Заглушить" : "Включить звук"}
        >
          {volume === 0 ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
          aria-label="Громкость"
          style={{ width: 64 }}
        />
        <button
          type="button"
          className="ec-player-ctrl"
          onClick={toggleFullscreen}
          title={fullscreen ? "Выйти из полноэкранного" : "Полный экран"}
          aria-label={fullscreen ? "Выйти из полноэкранного" : "Полный экран"}
        >
          {fullscreen ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
