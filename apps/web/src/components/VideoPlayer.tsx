import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MediaScrubber } from "./MediaScrubber";
import { useMediaVolume } from "../hooks/useMediaVolume";

/**
 * VideoPlayer (v1.1.86 — медиа-плеер, слайс 3) — кастомный анимированный
 * плеер для видео-вложений. Нативные controls заменены: перемотка через
 * общий MediaScrubber (слайс 1), своя панель play/volume/fullscreen,
 * hover-glow из дизайн-макета eclipse-os-v1.
 *
 * Воспроизведение локальное (видео-файл играет в браузере зрителя).
 * Синхронный watch-party в голосовой комнате — отдельный слайс 4.
 *
 * onNext/onPrev — переход к соседнему видео (кнопки видны, если заданы;
 * onEnded авто-переходит на следующее).
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

const ctrlBtn: CSSProperties = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--ec-radius-md)",
  background: "transparent",
  border: 0,
  color: "var(--ec-text-strong)",
  cursor: "pointer",
  flexShrink: 0,
};

export function VideoPlayer({ src, poster, onNext, onPrev }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
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
      style={{
        position: "relative",
        display: "inline-flex",
        background: "#000",
        borderRadius: fullscreen ? 0 : "var(--ec-radius-lg)",
        overflow: "hidden",
        maxWidth: "92vw",
        maxHeight: "88vh",
        lineHeight: 0,
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDurationMs(d * 1000);
        }}
        onEnded={() => {
          setPlaying(false);
          if (onNext) onNext();
        }}
        style={{
          display: "block",
          maxWidth: "92vw",
          maxHeight: "88vh",
          cursor: "pointer",
        }}
      />

      {/* Центральная play-кнопка — когда на паузе. */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Воспроизвести"
          className="ec-video-player__big-play"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 72,
            height: 72,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            background: "hsl(258 90% 66% / 0.92)",
            color: "#fff",
            border: 0,
            cursor: "pointer",
            boxShadow: "0 0 0 1px hsl(258 90% 80% / 0.4), 0 0 32px hsl(258 90% 60% / 0.55)",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Панель управления — поверх нижней кромки, со scrim'ом. */}
      <div
        className="ec-video-player__bar"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          lineHeight: 1.4,
          background:
            "linear-gradient(180deg, transparent, hsl(220 30% 3% / 0.82))",
        }}
      >
        <button
          type="button"
          onClick={togglePlay}
          style={ctrlBtn}
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
          <button type="button" onClick={onPrev} style={ctrlBtn} title="Предыдущее" aria-label="Предыдущее видео">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M19 20L9 12l10-8z" />
              <rect x="5" y="4" width="2" height="16" />
            </svg>
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} style={ctrlBtn} title="Следующее" aria-label="Следующее видео">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M5 4l10 8-10 8z" />
              <rect x="17" y="4" width="2" height="16" />
            </svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 40 }}>
          <MediaScrubber
            positionMs={currentMs}
            durationMs={durationMs}
            onSeek={seek}
            width="100%"
          />
        </div>
        <span
          style={{
            fontFamily: "var(--ec-font-mono)",
            fontFeatureSettings: '"tnum"',
            fontSize: "0.7rem",
            color: "var(--ec-text)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {fmt(currentMs / 1000)} / {fmt(durationMs / 1000)}
        </span>
        <button
          type="button"
          onClick={() => setVolume(volume > 0 ? 0 : lastVol.current || 0.7)}
          style={ctrlBtn}
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
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Громкость"
          style={{ width: 64, accentColor: "var(--ec-accent)", cursor: "pointer", flexShrink: 0 }}
        />
        <button
          type="button"
          onClick={toggleFullscreen}
          style={ctrlBtn}
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
