import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { SkipBackIcon } from "@phosphor-icons/react/dist/csr/SkipBack";
import { SkipForwardIcon } from "@phosphor-icons/react/dist/csr/SkipForward";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlashIcon } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { CornersInIcon } from "@phosphor-icons/react/dist/csr/CornersIn";
import { PictureInPictureIcon } from "@phosphor-icons/react/dist/csr/PictureInPicture";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { MediaScrubber } from "./MediaScrubber";
import { MediaViewport } from "./MediaViewport";
import { PlayerStateIcon } from "./PlayerStateIcon";
import { useMediaVolume } from "../hooks/useMediaVolume";
import { boundedSeek, mediaTime } from "../lib/mediaPresentation";

type Props = { src: string; poster?: string; onNext?: () => void; onPrev?: () => void };

/** Local playback. Shared sessions retain their server-authoritative transport. */
export function VideoPlayer({ src, poster, onNext, onPrev }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const advanced = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState("");
  const [feedback, setFeedback] = useState("");
  const [controls, setControls] = useState(true);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [bufferedMs, setBufferedMs] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useMediaVolume();
  const lastVol = useRef(volume > 0 ? volume : .7);
  const canPip = typeof document !== "undefined" && document.pictureInPictureEnabled;

  const confirm = (message: string) => {
    clearTimeout(feedbackTimer.current); setFeedback(message);
    feedbackTimer.current = setTimeout(() => setFeedback(""), 850);
  };
  const reveal = useCallback(() => {
    setControls(true); clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current?.paused || containerRef.current?.contains(document.activeElement)) return;
      setControls(false);
    }, 2600);
  }, []);
  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    setProblem("");
    void video.play().catch(cause => {
      if (cause?.name === "AbortError") return;
      setLoading(false); setPlaying(false); reveal();
      setProblem(cause?.name === "NotAllowedError" ? "Нажми воспроизведение, чтобы включить видео на этом устройстве." : "Не удалось воспроизвести видео. Попробуй ещё раз.");
    });
  };
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (failed) { setFailed(false); setLoading(true); video.load(); }
    if (video.paused) play(); else video.pause();
    reveal();
  };
  const seek = (ms: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const next = boundedSeek(ms, video.duration * 1000);
    video.currentTime = next / 1000; setCurrentMs(next); advanced.current = false;
    confirm(mediaTime(next)); reveal();
  };
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement === container) await document.exitFullscreen();
      else await container.requestFullscreen();
    } catch { setProblem("Полноэкранный режим недоступен в этом окне."); }
  };
  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch { setProblem("Не удалось открыть «Картинку в картинке». Можно использовать полный экран."); }
  };

  useEffect(() => {
    setCurrentMs(0); setDurationMs(0); setBufferedMs(0); setDimensions({ width: 0, height: 0 });
    setProblem(""); setFailed(false); setLoading(true); advanced.current = false; reveal();
    play();
  }, [src]);
  useEffect(() => {
    const video = videoRef.current;
    if (video) { video.volume = volume; video.playbackRate = rate; }
    if (volume > 0) lastVol.current = volume;
  }, [volume, rate, src]);
  useEffect(() => {
    const onFullscreen = () => { setFullscreen(document.fullscreenElement === containerRef.current); reveal(); };
    document.addEventListener("fullscreenchange", onFullscreen);
    const video = videoRef.current;
    const enterPip = () => setPip(true), leavePip = () => setPip(false);
    video?.addEventListener("enterpictureinpicture", enterPip);
    video?.addEventListener("leavepictureinpicture", leavePip);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      video?.removeEventListener("enterpictureinpicture", enterPip);
      video?.removeEventListener("leavepictureinpicture", leavePip);
      clearTimeout(hideTimer.current); clearTimeout(feedbackTimer.current);
    };
  }, [reveal]);

  return <div ref={containerRef} className="ec-video-player ec-video-player--refined"
    style={{ "--ec-media-ratio": dimensions.height ? dimensions.width / dimensions.height : 16 / 9 } as CSSProperties}
    role="group" aria-label="Видеоплеер" tabIndex={0} data-native-cursor
    data-playing={playing} data-fullscreen={fullscreen} data-controls={controls || !playing || !!problem || loading}
    onMouseMove={reveal} onPointerDown={reveal} onFocusCapture={reveal}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if ([" ", "k", "ArrowLeft", "ArrowRight", "m", "f"].includes(event.key)) event.preventDefault();
      if (event.key === " " || event.key === "k") togglePlay();
      if (event.key === "ArrowLeft") seek(currentMs - 10000);
      if (event.key === "ArrowRight") seek(currentMs + 10000);
      if (event.key === "m") setVolume(volume > 0 ? 0 : lastVol.current);
      if (event.key === "f") void toggleFullscreen();
    }}>
    <div className="ec-video-player__screen">
      <MediaViewport width={dimensions.width} height={dimensions.height}>
        <video ref={videoRef} className="ec-video-player__video" src={src} poster={poster} playsInline preload="metadata"
          onPlay={() => { setPlaying(true); setProblem(""); confirm("Воспроизведение"); reveal(); }}
          onPause={() => { setPlaying(false); reveal(); }}
          onWaiting={() => { setLoading(true); reveal(); }}
          onPlaying={() => { setPlaying(true); setLoading(false); setProblem(""); }}
          onCanPlay={() => setLoading(false)}
          onError={() => { setFailed(true); setLoading(false); setPlaying(false); setProblem("Видео недоступно или формат не поддерживается."); }}
          onTimeUpdate={event => setCurrentMs(boundedSeek(event.currentTarget.currentTime * 1000, event.currentTarget.duration * 1000))}
          onProgress={event => {
            const buffered = event.currentTarget.buffered;
            setBufferedMs(buffered.length ? buffered.end(buffered.length - 1) * 1000 : 0);
          }}
          onLoadedMetadata={event => {
            const video = event.currentTarget;
            setDurationMs(Number.isFinite(video.duration) ? video.duration * 1000 : 0);
            setDimensions({ width: video.videoWidth, height: video.videoHeight });
          }}
          onEnded={() => {
            setPlaying(false); setLoading(false); reveal(); confirm("Видео завершено");
            if (onNext && !advanced.current) { advanced.current = true; onNext(); }
          }} />
      </MediaViewport>
      {loading && !failed && <div className="ec-media-loading" role="status"><span aria-hidden />Загружаем видео…</div>}
      {!playing && !loading && !failed && <button type="button" className="ec-video-player__center"
        aria-label="Воспроизвести видео" onClick={togglePlay}><PlayerStateIcon playing={false} size={28} /></button>}
      {feedback && <div className="ec-media-feedback" aria-hidden>{feedback}</div>}
      {problem && <div className="ec-media-error" role="alert"><WarningCircleIcon size={20} aria-hidden /><span>{problem}</span>
        <button type="button" onClick={togglePlay}>{failed ? "Повторить" : "Воспроизвести"}</button></div>}
    </div>
    <div className="ec-video-player__bar">
      <div className="ec-video-player__timeline">
        <MediaScrubber positionMs={currentMs} durationMs={durationMs} bufferedMs={bufferedMs} onSeek={seek} width="100%" disabled={failed} />
        <span className="ec-video-player__time">{mediaTime(currentMs)} <span>/ {mediaTime(durationMs)}</span></span>
      </div>
      <div className="ec-video-player__tools">
        <button type="button" className="ec-media-main-control" onClick={togglePlay} aria-label={playing ? "Приостановить видео" : "Воспроизвести видео"}><PlayerStateIcon playing={playing} /></button>
        {onPrev && <button type="button" onClick={onPrev} aria-label="Предыдущее видео"><SkipBackIcon size={18} aria-hidden /></button>}
        <button type="button" onClick={() => seek(currentMs - 10000)} disabled={!durationMs} aria-label="Назад на 10 секунд"><ArrowCounterClockwiseIcon size={18} aria-hidden /><small>10</small></button>
        <button type="button" onClick={() => seek(currentMs + 10000)} disabled={!durationMs} aria-label="Вперёд на 10 секунд"><ArrowClockwiseIcon size={18} aria-hidden /><small>10</small></button>
        {onNext && <button type="button" onClick={onNext} aria-label="Следующее видео"><SkipForwardIcon size={18} aria-hidden /></button>}
        <div className="ec-video-player__volume">
          <button type="button" onClick={() => setVolume(volume > 0 ? 0 : lastVol.current)} aria-label={volume ? "Выключить звук видео" : "Включить звук видео"}>
            {volume ? <SpeakerHighIcon size={19} aria-hidden /> : <SpeakerSlashIcon size={19} aria-hidden />}</button>
          <input type="range" min={0} max={1} step={.05} value={volume} onChange={event => setVolume(Number(event.target.value))} aria-label="Громкость видео" />
        </div>
        <label className="ec-media-speed"><span className="ec-sr-only">Скорость видео</span>
          <select aria-label="Скорость видео" value={rate} onChange={event => { setRate(Number(event.target.value)); confirm(event.target.value + "×"); }}>
            {[.5, .75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
        {canPip && <button type="button" className="ec-media-pip" onClick={() => void togglePip()} disabled={!durationMs || failed}
          aria-pressed={pip} aria-label="Картинка в картинке"><PictureInPictureIcon size={20} aria-hidden /></button>}
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Выйти из полного экрана" : "Видео на весь экран"}>
          {fullscreen ? <CornersInIcon size={20} aria-hidden /> : <CornersOutIcon size={20} aria-hidden />}</button>
      </div>
    </div>
  </div>;
}
