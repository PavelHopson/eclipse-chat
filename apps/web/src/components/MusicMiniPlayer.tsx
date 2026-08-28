import { PlayerStateIcon } from "./PlayerStateIcon";
import { useContext, useEffect, useRef, useState } from "react";
import { VoiceMusicGainContext } from "./VoiceRoomContext";
import { musicTrackTitle } from "../lib/voicePresentation";
import { boundedMediaPosition, mediaClock } from "../lib/musicTiming";
import { Avatar } from "./Avatar";
import { MediaScrubber } from "./MediaScrubber";
import { resolveAssetUrl } from "../lib/assets";
import { useMediaVolume } from "../hooks/useMediaVolume";
import type { MusicSession } from "../hooks/useChannelMusic";
import {
  attachAnalyser,
  setCurrentMusicAudio,
} from "../hooks/useMusicAnalyser";

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
  /** v1.5.14 — host advances queue automatically on track end (avoid
   *  permission 403 storm если не-host listeners тоже вызывают). */
  isHost: boolean;
  canControl?: boolean;
  onTogglePlayPause: () => unknown | Promise<unknown>;
  onSkip: () => unknown | Promise<unknown>;
  onSeek: (positionMs: number) => unknown | Promise<unknown>;
  onStop: () => unknown | Promise<unknown>;
  onExpand?: () => void;
};

function formatTime(ms: number, durationMs?: number): string {
  return mediaClock(ms, durationMs) + (durationMs && Number.isFinite(durationMs) ? " / " + mediaClock(durationMs) : "");
}

export function MusicMiniPlayer({
  session,
  derivedPositionMs,
  isHost,
  canControl = isHost,
  onTogglePlayPause,
  onSkip,
  onSeek,
  onStop,
  onExpand,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const runAction = async (action: () => unknown) => {
    if (!canControl || pendingRef.current) return;
    pendingRef.current = true; setPending(true); setMediaError(null);
    try { if (await action() === false) setMediaError("Действие не выполнено. Открой плеер и повтори."); }
    catch { setMediaError("Нет ответа от сервера. Попробуй ещё раз."); }
    finally { pendingRef.current = false; setPending(false); }
  };
  const advanceKey = useRef<string | null>(null);
  const onSkipRef = useRef(onSkip); onSkipRef.current = onSkip;
  const advance = () => {
    const key = session.id + ":" + session.currentTrack?.id + ":" + session.startedAt;
    setEnded(true);
    if (!isHost || advanceKey.current === key) return;
    advanceKey.current = key;
    void Promise.resolve(onSkipRef.current()).then(result => {
      if (result === false) setMediaError("Не удалось перейти к следующему треку");
    }).catch(() => setMediaError("Не удалось перейти к следующему треку"));
  };
  const speechGain = useContext(VoiceMusicGainContext);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  // v1.2.13 — регистрируем audio как «текущий music-source» для
  // useMusicAnalyser. Expand-modal по этой ссылке найдёт прицепленный
  // AnalyserNode и поедет аудио-реактивная визуализация.
  useEffect(() => {
    setCurrentMusicAudio(audioRef.current);
    return () => setCurrentMusicAudio(null);
  }, []);
  const [bufferedMs, setBufferedMs] = useState(0);
  // v1.1.58 — общая громкость медиа: shared хук с live-sync + localStorage.
  const [volume, setVolume] = useMediaVolume();
  const lastVolumeRef = useRef(volume > 0 ? volume : 0.7);
  const appliedVolumeRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (volume > 0) lastVolumeRef.current = volume;
    if (!audio) return;
    const target = volume * speechGain;
    const nominalChanged = appliedVolumeRef.current !== volume;
    appliedVolumeRef.current = volume;
    // Saved volume and explicit user changes are immediate, never a loud fade-in.
    if (nominalChanged || volume === 0 || document.hidden) { audio.volume = target; return; }
    const from = audio.volume;
    const start = performance.now();
    let frame = 0;
    const ramp = (now: number) => {
      const progress = Math.min(1, (now - start) / (speechGain < 1 ? 160 : 420));
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * progress));
      if (progress < 1) frame = requestAnimationFrame(ramp);
    };
    frame = requestAnimationFrame(ramp);
    const onHidden = () => {
      if (document.hidden) { cancelAnimationFrame(frame); audio.volume = target; }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", onHidden); };
  }, [volume, speechGain]);

  useEffect(() => {
    setDurationMs(null); setBufferedMs(0); setBlocked(false); setMediaError(null); setEnded(false);
    advanceKey.current = null;
  }, [session.currentTrack?.id]);

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
    if (audio.getAttribute("src") !== src) {
      audio.src = src;
      audio.load();
    }
    const targetSec = boundedMediaPosition(derivedPositionMs - 150, Number.isFinite(audio.duration) ? audio.duration * 1000 : null) / 1000;
    setEnded(false);
    if (Math.abs(audio.currentTime - targetSec) > 1.5) {
      audio.currentTime = targetSec;
    }
    if (session.isPlaying) {
      void audio.play().then(() => setBlocked(false)).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "NotAllowedError") setBlocked(true);
        else if (!(error instanceof DOMException && error.name === "AbortError")) setMediaError("Не удалось воспроизвести трек");
      });
    } else {
      audio.pause();
    }
  }, [
    session.currentTrack?.id,
    session.isPlaying,
    session.startedAt,
    session.updatedAt,
    session.serverNow,
  ]);

  const trackName = session.currentTrack ? musicTrackTitle(session.currentTrack.filename) : "Очередь пуста";
  const isVoiceMessage = session.currentTrack
    ? /^voice-message-/i.test(session.currentTrack.filename)
    : false;
  const playing = session.isPlaying && !blocked && !ended && !mediaError;
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
        data-state={playing ? "playing" : "paused"}
        onClick={() => {
          // v1.2.13 — клик-play даёт user-gesture: прицепляем
          // AudioContext + AnalyserNode и зовём resume (браузер
          // создаёт context suspended до первого жеста).
          if (audioRef.current) {
            attachAnalyser(audioRef.current);
          }
          if (blocked && audioRef.current) {
            void audioRef.current.play().then(() => { setBlocked(false); setMediaError(null); }).catch(() => setMediaError("Браузер не разрешил воспроизведение"));
          } else { void runAction(onTogglePlayPause); }
        }}
        title={playing ? "Пауза" : "Воспроизвести"}
        aria-label={blocked ? "Включить прослушивание" : playing ? "Пауза" : "Воспроизвести"}
        disabled={!hasTrack || pending || (!canControl && !blocked)}
      >
        <PlayerStateIcon playing={playing} size={16} />
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
        {(blocked || mediaError || ended) && <small className="ec-player-mini__feedback" role="status">{mediaError ?? (blocked ? "Нажми ▶, чтобы слушать" : isHost ? "Следующий трек…" : "Трек завершён · ждём ведущего")}</small>}
      </button>

      <MediaScrubber
        positionMs={derivedPositionMs}
        durationMs={durationMs ?? 0}
        bufferedMs={bufferedMs}
        onSeek={(ms) => void runAction(() => onSeek(ms))}
        disabled={!hasTrack || pending || !canControl}
        loading={hasTrack && durationMs == null}
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

      {/* Utility-кластер — вторая роль: за hairline, приглушён. */}
      <span className="ec-player-mini__util">
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
        onClick={() => void runAction(onSkip)}
        title="Следующий"
        aria-label="Следующий трек"
        disabled={!canControl || pending || (session.queue.length === 0 && !hasTrack)}
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
        onClick={() => void runAction(onStop)}
        title="Завершить"
        aria-label="Завершить сессию"
        disabled={!canControl || pending}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      </span>

      <audio
        ref={audioRef}
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          if (Number.isFinite(audio.duration)) {
            setDurationMs(audio.duration * 1000);
          }
        }}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length === 0) return;
          let end = 0;
          for (let i = 0; i < b.length; i++) end = Math.max(end, b.end(i));
          setBufferedMs(end * 1000);
        }}
        onEnded={advance}
        onTimeUpdate={event => {
          if (session.isPlaying && event.currentTarget.ended) advance();
        }}
        onError={() => { if (session.currentTrack) setMediaError("Трек недоступен"); }}
        preload="metadata"
        style={{ display: "none" }}
      />
    </div>
  );
}
