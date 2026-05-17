import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import type { MusicSession } from "../hooks/useChannelMusic";

/**
 * v0.74 #32 phase 3: MusicMiniPlayer expand view.
 *
 * Большая waveform-дорожка с peaks из Attachment.waveformPeaks (v0.66
 * сохранил их при upload). Click anywhere on the waveform — currently
 * playing read-only (нет seek на host — этот только локально скорее
 * запутает чем поможет в synced-session). v2 — server-side seek для host.
 *
 * Поверх — bigger play/pause + skip + stop, queue list (filenames с
 * соседних tracks), host info.
 */

type Props = {
  session: MusicSession;
  derivedPositionMs: number;
  currentUserId: string;
  onClose: () => void;
  onTogglePlayPause: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
};

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-5)",
};

const waveformWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

const waveformSvg: CSSProperties = {
  width: "100%",
  height: 96,
  display: "block",
};

const controlsRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  justifyContent: "center",
  padding: "var(--ec-space-2) 0",
};

function iconButton(active = false): CSSProperties {
  return {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--ec-radius-full)",
    background: active ? "var(--ec-accent)" : "var(--ec-surface-2)",
    color: active ? "var(--ec-accent-text, #fff)" : "var(--ec-text)",
    border: "1px solid var(--ec-border-default)",
    cursor: "pointer",
  };
}

const playButton: CSSProperties = {
  width: 64,
  height: 64,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-accent)",
  color: "var(--ec-accent-text, #fff)",
  border: 0,
  cursor: "pointer",
  boxShadow: "0 18px 40px -16px hsl(195 90% 40% / 0.55)",
};

export function MusicExpandModal({
  session,
  derivedPositionMs,
  currentUserId,
  onClose,
  onTogglePlayPause,
  onSkip,
  onStop,
}: Props) {
  const track = session.currentTrack;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  // Probe audio duration без воспроизведения. Audio.preload="metadata"
  // дёргает только header — не качает блобом большой файл.
  useEffect(() => {
    if (!track) return;
    const a = audioRef.current;
    if (!a) return;
    a.src = track.url;
    a.load();
  }, [track?.url]);

  // Generate fallback peaks for legacy attachments without saved waveformPeaks.
  const peaks = useMemo<number[]>(() => {
    if (track?.waveformPeaks && track.waveformPeaks.length > 0) {
      return track.waveformPeaks;
    }
    // Baseline — 64 sin-wave bars так что лишь намёк на дорожку, не «голо».
    const N = 64;
    const out: number[] = [];
    for (let i = 0; i < N; i++) {
      out.push(Math.round(45 + 25 * Math.abs(Math.sin((i / N) * Math.PI * 3))));
    }
    return out;
  }, [track?.waveformPeaks]);

  const progress =
    durationMs && derivedPositionMs >= 0
      ? Math.min(1, Math.max(0, derivedPositionMs / durationMs))
      : 0;

  const isHost = session.host.id === currentUserId;

  return (
    <Modal title="Совместное прослушивание" width={620} onClose={onClose}>
      <div style={wrap}>
        <div style={waveformWrap}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--ec-space-3)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "var(--ec-text-md)",
                  fontWeight: 600,
                  color: "var(--ec-text-strong)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={track?.filename ?? "Очередь пуста"}
              >
                {track?.filename ?? "Очередь пуста"}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                  color: "var(--ec-text-muted)",
                  fontSize: "var(--ec-text-2xs)",
                }}
              >
                <Avatar
                  url={session.host.avatar}
                  name={session.host.displayName}
                  size={16}
                />
                <span>Запустил: {session.host.displayName}</span>
                {session.queue.length > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      padding: "0 0.5rem",
                      borderRadius: "var(--ec-radius-full)",
                      background: "var(--ec-surface-3)",
                      color: "var(--ec-text-muted)",
                      fontWeight: 700,
                      fontSize: "0.65rem",
                    }}
                  >
                    +{session.queue.length} в очереди
                  </span>
                )}
              </div>
            </div>
            <span
              style={{
                fontFamily: "var(--ec-font-mono)",
                fontFeatureSettings: '"tnum"',
                color: "var(--ec-text-muted)",
                fontSize: "var(--ec-text-2xs)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {formatClock(derivedPositionMs)}
              {durationMs ? ` / ${formatClock(durationMs)}` : ""}
            </span>
          </div>

          {/* Big waveform — каждый bar 0..1 height по peaks, played-bars
              tinted accent, unplayed muted. Не intractable (synced session
              — все слушают одну позицию). */}
          <svg
            viewBox={`0 0 ${peaks.length * 4} 100`}
            preserveAspectRatio="none"
            style={waveformSvg}
            aria-hidden
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
                  rx={1}
                  fill={
                    played ? "var(--ec-accent)" : "var(--ec-text-dim)"
                  }
                  opacity={played ? 0.95 : 0.45}
                />
              );
            })}
            {/* playhead cursor */}
            <line
              x1={peaks.length * 4 * progress}
              y1={0}
              x2={peaks.length * 4 * progress}
              y2={100}
              stroke="var(--ec-accent)"
              strokeWidth={1.5}
              opacity={0.8}
            />
          </svg>
        </div>

        <div style={controlsRow}>
          <button
            type="button"
            onClick={() => void onSkip()}
            style={iconButton()}
            title="Следующий трек"
            aria-label="Следующий"
            disabled={!isHost && true /* backend проверит */}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M5 4l10 8-10 8z" />
              <rect x="17" y="4" width="2" height="16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void onTogglePlayPause()}
            style={playButton}
            title={session.isPlaying ? "Пауза" : "Воспроизвести"}
            aria-label={session.isPlaying ? "Пауза" : "Воспроизвести"}
            disabled={!track}
          >
            {session.isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => void onStop()}
            style={iconButton()}
            title="Завершить сессию"
            aria-label="Завершить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!track && (
          <p
            style={{
              margin: 0,
              color: "var(--ec-text-dim)",
              fontSize: "var(--ec-text-sm)",
              textAlign: "center",
            }}
          >
            Очередь пуста. Добавь audio-attachment в чат и нажми «Слушать
            вместе».
          </p>
        )}

        {/* Спрятанный audio для probe duration (без воспроизведения —
            MusicMiniPlayer уже играет в фоне). */}
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
