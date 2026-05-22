import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { apiJson } from "../lib/api";
import type { MusicSession } from "../hooks/useChannelMusic";

/**
 * MusicMiniPlayer expand view (v0.74 #32 phase 3; v1.1.85 — слайс 2
 * медиа-плеера: перематываемая вейвформа + видимый список очереди).
 *
 * Большая waveform-дорожка с peaks из Attachment.waveformPeaks.
 * Host (или MOD на backend) может кликать/тащить по вейвформе —
 * server-side seek, все слушатели ре-синхронятся. Под контролами —
 * список очереди с именами треков.
 */

type Props = {
  session: MusicSession;
  derivedPositionMs: number;
  currentUserId: string;
  onClose: () => void;
  onTogglePlayPause: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  /** v1.1.85 — перемотка по вейвформе (host / MOD+). */
  onSeek: (positionMs: number) => void | Promise<void>;
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
  touchAction: "none",
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
    color: active ? "var(--ec-accent-text)" : "var(--ec-text)",
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
  color: "var(--ec-accent-text)",
  border: 0,
  cursor: "pointer",
  boxShadow: "0 18px 40px -16px hsl(258 90% 40% / 0.55)",
};

const queueRowBase: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "0.5rem 0.65rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid transparent",
  cursor: "default",
  transition:
    "background var(--ec-dur-fast) var(--ec-ease)," +
    " border-color var(--ec-dur-fast) var(--ec-ease)",
};

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<SVGSVGElement | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  const [queueTracks, setQueueTracks] = useState<
    { id: string; filename: string }[]
  >([]);

  // Probe audio duration без воспроизведения.
  useEffect(() => {
    if (!track) return;
    const a = audioRef.current;
    if (!a) return;
    a.src = track.url;
    a.load();
  }, [track?.url]);

  // Резолв очереди (attachment IDs → имена) для списка. Перезапрос при
  // изменении состава очереди.
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
  // Во время drag показываем локальную позицию (плейхед следует за курсором).
  const progress = dragFrac != null ? dragFrac : basePos;

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
    if (dragFrac == null) return;
    setDragFrac(fracFromClientX(e.clientX));
  };
  const onWavePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragFrac == null || durationMs == null) return;
    const committed = fracFromClientX(e.clientX);
    setDragFrac(null);
    void onSeek(committed * durationMs);
  };

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
              {formatClock(dragFrac != null && durationMs
                ? dragFrac * durationMs
                : derivedPositionMs)}
              {durationMs ? ` / ${formatClock(durationMs)}` : ""}
            </span>
          </div>

          {/* Big waveform — peaks 0..1; сыгранные bars accent, остальные
              приглушены. Host может кликать/тащить → server-side seek. */}
          <svg
            ref={waveformRef}
            viewBox={`0 0 ${peaks.length * 4} 100`}
            preserveAspectRatio="none"
            style={{ ...waveformSvg, cursor: seekable ? "pointer" : "default" }}
            onPointerDown={onWavePointerDown}
            onPointerMove={onWavePointerMove}
            onPointerUp={onWavePointerUp}
            onPointerCancel={() => setDragFrac(null)}
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
                  fill={played ? "var(--ec-accent)" : "var(--ec-text-dim)"}
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
              strokeWidth={dragFrac != null ? 2.4 : 1.5}
              opacity={dragFrac != null ? 1 : 0.8}
            />
          </svg>
          {seekable && (
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--ec-text-dim)",
                textAlign: "center",
              }}
            >
              Клик или перетаскивание по дорожке — перемотка для всех
            </div>
          )}
        </div>

        <div style={controlsRow}>
          <button
            type="button"
            onClick={() => void onSkip()}
            style={iconButton()}
            title="Следующий трек"
            aria-label="Следующий"
            disabled={!isHost}
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

        {/* Очередь — список ближайших треков. */}
        {queueTracks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
            <div
              style={{
                fontSize: "var(--ec-text-2xs)",
                fontWeight: 600,
                letterSpacing: "var(--ec-tracking-caps)",
                textTransform: "uppercase",
                color: "var(--ec-text-dim)",
              }}
            >
              Очередь · {queueTracks.length}
            </div>
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 3,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {queueTracks.map((t, i) => (
                <li
                  key={`${t.id}-${i}`}
                  style={queueRowBase}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--ec-surface-2)";
                    e.currentTarget.style.borderColor = "var(--ec-border-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--ec-font-mono)",
                      fontFeatureSettings: '"tnum"',
                      fontSize: "0.7rem",
                      color: "var(--ec-text-dim)",
                      minWidth: 18,
                      textAlign: "right",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--ec-text)",
                      fontSize: "var(--ec-text-sm)",
                    }}
                    title={t.filename}
                  >
                    {t.filename}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

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
