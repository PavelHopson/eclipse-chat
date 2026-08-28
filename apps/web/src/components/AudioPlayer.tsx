import { useEffect, useRef, useState, type ReactNode } from "react";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlashIcon } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { PlayerStateIcon } from "./PlayerStateIcon";
import { MediaScrubber } from "./MediaScrubber";
import { useMediaVolume } from "../hooks/useMediaVolume";
import { boundedSeek, mediaTime } from "../lib/mediaPresentation";

/** Local attachment player; never changes the shared room's playback speed. */
export function AudioPlayer({ src, title, detail, peaks, actions, children }: {
  src: string; title: string; detail?: string; peaks?: number[] | null; actions?: ReactNode; children?: ReactNode;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useMediaVolume();
  const lastVolume = useRef(volume || .7);
  const wave = (peaks ?? []).slice(0, 256).map(value => Number.isFinite(value) ? Math.max(2, Math.min(100, value)) : 2);
  const progress = duration > 0 ? position / duration : 0;
  useEffect(() => {
    if (audio.current) { audio.current.volume = volume; audio.current.playbackRate = rate; }
    if (volume) lastVolume.current = volume;
  }, [volume, rate, src]);
  useEffect(() => {
    setPlaying(false); setLoading(false); setError(""); setFailed(false);
    setPosition(0); setDuration(0); setBuffered(0);
  }, [src]);
  const toggle = async () => {
    const media = audio.current;
    if (!media) return;
    setError("");
    if (failed) { media.load(); setFailed(false); }
    if (!media.paused) { media.pause(); return; }
    setLoading(true);
    try { await media.play(); }
    catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setLoading(false); setPlaying(false); setError("Не удалось включить аудио. Нажми воспроизведение ещё раз.");
    }
  };
  const seek = (ms: number) => {
    if (!audio.current || duration <= 0) return;
    const next = boundedSeek(ms, duration);
    audio.current.currentTime = next / 1000; setPosition(next);
  };
  return <div className="ec-audio-player" data-playing={playing} data-native-cursor>
    <audio ref={audio} src={src} preload="metadata"
      onPlay={() => { setPlaying(true); setError(""); }}
      onPlaying={() => setLoading(false)} onWaiting={() => setLoading(true)}
      onCanPlay={() => setLoading(false)} onPause={() => { setPlaying(false); setLoading(false); }}
      onEnded={() => { setPlaying(false); setLoading(false); }}
      onError={() => { setFailed(true); setPlaying(false); setLoading(false); setError("Аудиофайл недоступен или формат не поддерживается."); }}
      onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration * 1000 : 0)}
      onTimeUpdate={event => setPosition(boundedSeek(event.currentTarget.currentTime * 1000, event.currentTarget.duration * 1000))}
      onProgress={event => {
        const ranges = event.currentTarget.buffered;
        setBuffered(ranges.length ? ranges.end(ranges.length - 1) * 1000 : 0);
      }} />
    <button type="button" className="ec-audio-player__play" onClick={() => void toggle()}
      aria-label={(failed ? "Повторить загрузку: " : playing ? "Приостановить: " : "Воспроизвести: ") + title}
      aria-busy={loading}><PlayerStateIcon playing={playing} size={22} /></button>
    <div className="ec-audio-player__body">
      <div className="ec-audio-player__title" title={title}>{title}</div>
      <div className="ec-audio-player__track" data-waveform={wave.length > 0}>
        {wave.length > 0 && <svg className="ec-audio-player__wave" viewBox={"0 0 " + wave.length * 4 + " 100"} preserveAspectRatio="none" aria-hidden>
          {wave.map((value, index) => <rect key={index} x={index * 4} y={(100 - value) / 2} width={2.8} height={value} rx={1}
            fill={index / wave.length <= progress ? "var(--ec-accent-gold, #d4af37)" : "var(--ec-text-muted)"} opacity={index / wave.length <= progress ? 1 : .35} />)}
        </svg>}
        <MediaScrubber positionMs={position} durationMs={duration} bufferedMs={buffered} onSeek={seek} width="100%" disabled={failed} />
      </div>
      <div className="ec-audio-player__meta"><span>{mediaTime(position)} / {mediaTime(duration)}</span><span>{loading ? "Загрузка…" : playing ? "Воспроизведение" : duration && position >= duration ? "Завершено" : detail}</span></div>
      <div className="ec-audio-player__tools">
        <button type="button" onClick={() => setVolume(volume ? 0 : lastVolume.current)} aria-label={volume ? "Выключить звук аудио" : "Включить звук аудио"}>
          {volume ? <SpeakerHighIcon size={17} aria-hidden /> : <SpeakerSlashIcon size={17} aria-hidden />}</button>
        <input aria-label="Громкость аудио" type="range" min={0} max={1} step={.05} value={volume} onChange={event => setVolume(Number(event.target.value))} />
        <label className="ec-media-speed"><span className="ec-sr-only">Скорость аудио</span>
          <select aria-label="Скорость аудио" value={rate} onChange={event => setRate(Number(event.target.value))}>
            {[.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
        {actions}
      </div>
      {error && <p className="ec-player-notice" role="alert">{error}</p>}
      {children}
    </div>
  </div>;
}
