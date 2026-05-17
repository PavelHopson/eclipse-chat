import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { resolveAssetUrl } from "../lib/assets";
import type { MusicSession } from "../hooks/useChannelMusic";

/**
 * MusicMiniPlayer (v0.61) — floating audio player в шапке канала.
 *
 * Render:
 *   ▶/⏸  Track name · host  ━━━●━━  0:42 / 3:14  [⏭] [✕]
 *
 * Audio element скрыт (visibility:hidden), управляется через ref:
 *   - При isPlaying=true и есть currentTrack — audio.play() с currentTime
 *     = derivedPositionMs/1000.
 *   - При pause — audio.pause().
 *   - При смене track — audio.src обновляется, currentTime сбрасывается.
 *
 * Latency budget: разница между server-time и client-time может быть
 * до 500ms (без NTP). Late-join slight drift приемлем (Spotify Group тоже
 * допускает ~1с). v2 — periodic position-sync emit + auto-seek correction
 * если drift > 1.5s.
 */

type Props = {
  session: MusicSession;
  derivedPositionMs: number;
  currentUserId: string;
  onTogglePlayPause: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  /** v0.74 #32 phase 3: open big expand-view modal. */
  onExpand?: () => void;
};

const wrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "0.4rem 0.7rem",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-full)",
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
  flexShrink: 0,
  minWidth: 0,
};

const iconBtn: CSSProperties = {
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--ec-radius-full)",
  background: "transparent",
  border: 0,
  color: "var(--ec-text)",
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
  flexShrink: 0,
};

const playBtn: CSSProperties = {
  ...iconBtn,
  background: "var(--ec-accent)",
  color: "var(--ec-accent-text, #fff)",
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
  currentUserId,
  onTogglePlayPause,
  onSkip,
  onStop,
  onExpand,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

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
    const src = resolveAssetUrl(session.currentTrack.url) ?? "";
    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }
    // Seek к серверной позиции (минус ~150ms на reasonable latency
    // компенсацию — лучше слушать раньше, чем позже).
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
    // session.updatedAt включаем в deps чтобы re-sync при server-side
    // изменениях (даже если тот же track).
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
  const isHost = session.host.id === currentUserId;
  const progressPct =
    durationMs && derivedPositionMs >= 0
      ? Math.min(100, Math.max(0, (derivedPositionMs / durationMs) * 100))
      : 0;

  return (
    <div className="ec-music-mini-player" style={wrap} role="region" aria-label="Общий плеер канала">
      <button
        type="button"
        onClick={() => void onTogglePlayPause()}
        style={playBtn}
        title={session.isPlaying ? "Пауза" : "Воспроизвести"}
        aria-label={session.isPlaying ? "Пауза" : "Воспроизвести"}
        disabled={!session.currentTrack}
      >
        {session.isPlaying ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={onExpand}
        disabled={!onExpand}
        style={{
          minWidth: 0,
          maxWidth: 200,
          color: "var(--ec-text-strong)",
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          background: "transparent",
          border: 0,
          padding: 0,
          cursor: onExpand ? "pointer" : "default",
          fontSize: "inherit",
          textAlign: "left",
        }}
        title={onExpand ? `${trackName} — открыть плеер` : trackName}
      >
        {isVoiceMessage ? "Голосовое" : trackName}
      </button>
      <span
        style={{
          width: 70,
          height: 3,
          background: "var(--ec-surface-3)",
          borderRadius: "var(--ec-radius-full)",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
        aria-hidden
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            width: `${progressPct}%`,
            background: "var(--ec-accent)",
            borderRadius: "var(--ec-radius-full)",
            transition: "width 400ms linear",
          }}
        />
      </span>
      <span
        style={{
          fontFamily: "var(--ec-font-mono)",
          fontFeatureSettings: '"tnum"',
          fontSize: "0.65rem",
          color: "var(--ec-text-dim)",
          minWidth: 55,
        }}
      >
        {formatTime(derivedPositionMs, durationMs ?? undefined)}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "var(--ec-text-dim)",
          fontSize: "var(--ec-text-2xs)",
        }}
        title={`Запустил: ${session.host.displayName}`}
      >
        <Avatar url={session.host.avatar} name={session.host.displayName} size={16} />
      </span>
      {session.queue.length > 0 && (
        <span
          style={{
            padding: "0 0.45rem",
            background: "var(--ec-surface-3)",
            borderRadius: "var(--ec-radius-full)",
            color: "var(--ec-text-muted)",
            fontSize: "0.6rem",
            fontWeight: 700,
          }}
          title={`В очереди: ${session.queue.length}`}
        >
          +{session.queue.length}
        </span>
      )}
      {(isHost || true) /* host или MOD+, проверяется на backend */ && (
        <>
          <button
            type="button"
            onClick={() => void onSkip()}
            style={iconBtn}
            title="Следующий"
            aria-label="Следующий трек"
            disabled={session.queue.length === 0 && !session.currentTrack}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M5 4l10 8-10 8z" />
              <rect x="17" y="4" width="2" height="16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void onStop()}
            style={iconBtn}
            title="Завершить"
            aria-label="Завершить сессию"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </>
      )}
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
