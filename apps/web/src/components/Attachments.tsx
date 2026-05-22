import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Attachment } from "../hooks/useMessages";
import { apiJson } from "../lib/api";
import { resolveAssetUrl } from "../lib/assets";
import { useMediaVolume } from "../hooks/useMediaVolume";
import { VideoPlayer } from "./VideoPlayer";

type Props = {
  attachments: Attachment[];
  /** v0.61: запустить shared listening session для audio attachment'а.
   *  Когда undefined — кнопка «Слушать вместе» скрыта (например, в DM). */
  onPlayShared?: (attachmentId: string) => void | Promise<void>;
};

const wrap: CSSProperties = {
  marginTop: 6,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  maxWidth: 540,
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(a: Attachment): boolean {
  return a.mimeType.startsWith("image/");
}

function isVideo(a: Attachment): boolean {
  return a.mimeType.startsWith("video/");
}

function isAudio(a: Attachment): boolean {
  return a.mimeType.startsWith("audio/");
}

const imageWrap: CSSProperties = {
  display: "block",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  overflow: "hidden",
  cursor: "zoom-in",
  position: "relative",
  // v1.1.62 redesign §8 — «subtle media frame»: мягкая тень глубины,
  // картинка читается как лёгкая floating-карточка, не ломает поток чата.
  boxShadow: "0 8px 24px -12px hsl(210 60% 2% / 0.6)",
  transition:
    "transform var(--ec-dur-fast) var(--ec-ease), box-shadow var(--ec-dur-fast) var(--ec-ease)",
};

const fileChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text)",
  textDecoration: "none",
  fontSize: "var(--ec-text-sm)",
  maxWidth: 360,
  transition: "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const fileIconWrap: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "var(--ec-radius-sm)",
  background: "var(--ec-surface-3)",
  color: "var(--ec-accent)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const ARCHIVE_MIMES = new Set([
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-bzip2",
]);

const DOC_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
]);

const SHEET_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
]);

const SLIDES_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
]);

function FileBadge({ label }: { label: string }) {
  // Document с лейблом-меткой (PDF / DOC / XLS / PPT / ZIP / RAR / 7Z).
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <text x="7" y="18" fontSize="5" fontWeight="700" fill="currentColor" stroke="none">{label}</text>
    </svg>
  );
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("audio/")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    );
  }
  if (mime.startsWith("video/")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M10 9l5 3-5 3V9z" />
      </svg>
    );
  }
  if (mime === "application/pdf") return <FileBadge label="PDF" />;
  if (DOC_MIMES.has(mime))    return <FileBadge label="DOC" />;
  if (SHEET_MIMES.has(mime))  return <FileBadge label="XLS" />;
  if (SLIDES_MIMES.has(mime)) return <FileBadge label="PPT" />;
  if (ARCHIVE_MIMES.has(mime)) {
    // Архив: коробка с защёлкой — visually отличается от document chip.
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M11 13h2" />
        <path d="M12 13v3" />
      </svg>
    );
  }
  if (mime === "text/csv") return <FileBadge label="CSV" />;
  if (mime === "text/markdown") return <FileBadge label="MD" />;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function VideoItem({ a, onOpen }: { a: Attachment; onOpen: (a: Attachment) => void }) {
  const src = resolveAssetUrl(a.url) ?? "";
  return (
    <button
      type="button"
      className="ec-video-attachment"
      onClick={() => onOpen(a)}
      aria-label={`Открыть видео ${a.filename}`}
    >
      <video src={src} preload="metadata" muted playsInline />
      <span className="ec-video-attachment__play" aria-hidden>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span className="ec-video-attachment__meta">
        <span>{a.filename}</span>
        <span>{humanSize(a.size)}</span>
      </span>
    </button>
  );
}

/**
 * v0.66: Telegram-style audio waveform. Peaks pre-computed на клиенте
 * через computeWaveformPeaks() при upload, отдаются backend'ом в
 * a.waveformPeaks. Если null (старые attachments / decode fail) —
 * рендерим baseline-bars equal-height fallback. Bars подсвечиваются
 * прогрессом проигрывания, click/drag = seek.
 */
function Waveform({
  peaks,
  progress,
  onSeek,
  ariaLabel,
}: {
  peaks: number[];
  progress: number; // 0..1
  onSeek: (fraction: number) => void;
  ariaLabel: string;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const fillIdx = Math.round(progress * peaks.length);

  const seekFromEvent = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(f);
  };

  // 64 bars × 3px width + 1px gap = ~256px. SVG viewBox масштабируется.
  const barW = 3;
  const gap = 1;
  const slot = barW + gap;
  const w = peaks.length * slot - gap;
  const h = 32;

  return (
    <svg
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{
        display: "block",
        cursor: "pointer",
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={(e) => {
        draggingRef.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        seekFromEvent(e.clientX);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) seekFromEvent(e.clientX);
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeek(Math.max(0, progress - 0.05));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeek(Math.min(1, progress + 0.05));
        }
      }}
    >
      {peaks.map((p, i) => {
        const barH = Math.max(2, (p / 100) * h);
        const y = (h - barH) / 2;
        const x = i * slot;
        const played = i < fillIdx;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={1}
            ry={1}
            fill={played ? "var(--ec-accent)" : "var(--ec-text-dim)"}
            opacity={played ? 0.95 : 0.45}
          />
        );
      })}
    </svg>
  );
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioItem({
  a,
  onPlayShared,
}: {
  a: Attachment;
  onPlayShared?: (attachmentId: string) => void | Promise<void>;
}) {
  const src = resolveAssetUrl(a.url) ?? "";
  const isVoice = /^voice-message-/i.test(a.filename);
  const transcriptStatus = a.transcriptStatus ?? "NONE";
  const peaks = a.waveformPeaks ?? null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // v1.1.58 — общая громкость медиа (shared с music-плеером).
  const [volume, setVolume] = useMediaVolume();
  const lastVolumeRef = useRef(volume > 0 ? volume : 0.7);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (volume > 0) lastVolumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(el.duration);
    const onEnded = () => setIsPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const seekTo = (fraction: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration === 0) return;
    el.currentTime = fraction * el.duration;
    setCurrentTime(el.currentTime);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  // Fallback бары если peaks нет (старые attachments / decode failed).
  const fallbackPeaks =
    peaks ?? Array.from({ length: 48 }, (_, i) => 30 + Math.round(Math.sin(i / 2) * 12));

  return (
    <div className={isVoice ? "ec-audio-attachment ec-audio-attachment--voice" : "ec-audio-attachment"}>
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
        title={isPlaying ? "Пауза" : "Воспроизвести"}
        className="ec-audio-attachment__icon"
        style={{
          background: "var(--ec-accent)",
          color: "var(--ec-accent-text)",
          border: 0,
          cursor: "pointer",
          borderRadius: "var(--ec-radius-full)",
        }}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="ec-audio-attachment__body">
        <div className="ec-audio-attachment__title">
          {isVoice ? "Голосовое сообщение" : a.filename}
        </div>
        <Waveform
          peaks={fallbackPeaks}
          progress={progress}
          onSeek={seekTo}
          ariaLabel={`Дорожка ${isVoice ? "голосового сообщения" : a.filename}`}
        />
        <audio ref={audioRef} preload="metadata" src={src} style={{ display: "none" }} />
        <div className="ec-audio-attachment__meta">
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
          <span style={{ opacity: 0.6 }}> · {humanSize(a.size)}</span>
          {!peaks && (
            <span style={{ opacity: 0.45, marginLeft: 6 }} title="Waveform не доступен для этого файла">
              · базовая дорожка
            </span>
          )}
        </div>
        {/* v1.1.58 — регулировка громкости (общая для всех медиа-плееров) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <button
            type="button"
            onClick={() =>
              setVolume(volume > 0 ? 0 : lastVolumeRef.current || 0.7)
            }
            title={volume > 0 ? "Заглушить" : "Включить звук"}
            aria-label={volume > 0 ? "Заглушить" : "Включить звук"}
            style={{
              display: "grid",
              placeItems: "center",
              width: 22,
              height: 22,
              background: "transparent",
              border: 0,
              color: "var(--ec-text-muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {volume === 0 ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
            title={`Громкость: ${Math.round(volume * 100)}%`}
            style={{ width: 84, accentColor: "var(--ec-accent)", cursor: "pointer" }}
          />
        </div>
        <TranscriptBlock
          attachmentId={a.id}
          status={transcriptStatus}
          transcript={a.transcript ?? null}
          error={a.transcriptError ?? null}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "flex-start" }}>
        {onPlayShared && (
          <button
            type="button"
            onClick={() => void onPlayShared(a.id)}
            title="Слушать вместе с комнатой"
            aria-label="Слушать вместе"
            style={{
              width: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--ec-radius-full)",
              background: "var(--ec-accent-soft)",
              color: "var(--ec-accent)",
              border: "1px solid var(--ec-border-accent)",
              cursor: "pointer",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
        <a
          href={src}
          download={a.filename}
          className="ec-audio-attachment__download"
          title="Скачать"
          aria-label="Скачать аудио"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

/**
 * v0.58: транскрипция аудио-вложения. Рендерит:
 *  - PENDING: shimmer-line "Транскрибируем…"
 *  - READY:  expandable блок с текстом (по умолчанию свернут до 3 строк)
 *  - FAILED: одна muted-строка с reason
 *  - NONE:   ничего (нет провайдера / не аудио)
 */
function TranscriptBlock({
  attachmentId,
  status,
  transcript,
  error,
}: {
  attachmentId: string;
  status: "NONE" | "PENDING" | "READY" | "FAILED";
  transcript: string | null;
  error: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  // v0.79 #22 phase 1: extraction state — inline под transcript блоком.
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedCount, setExtractedCount] = useState<number | null>(null);
  const [extractedNote, setExtractedNote] = useState<string | null>(null);
  if (status === "NONE") return null;
  if (status === "PENDING") {
    return (
      <div
        className="ec-shimmer-text"
        style={{
          marginTop: 6,
          fontSize: "var(--ec-text-2xs)",
          color: "var(--ec-text-dim)",
          letterSpacing: "var(--ec-tracking-wide)",
        }}
      >
        Транскрибируем…
      </div>
    );
  }
  if (status === "FAILED") {
    return (
      <div
        style={{
          marginTop: 6,
          fontSize: "var(--ec-text-2xs)",
          color: "var(--ec-text-dim)",
          fontStyle: "italic",
        }}
      >
        Транскрипция не удалась{error ? ` · ${error.slice(0, 100)}` : ""}
      </div>
    );
  }
  // READY
  if (!transcript) return null;
  const isLong = transcript.length > 240;
  const shown = expanded || !isLong ? transcript : transcript.slice(0, 240) + "…";
  return (
    <div
      style={{
        marginTop: 8,
        padding: "var(--ec-space-2) var(--ec-space-3)",
        background: "var(--ec-surface-2)",
        borderRadius: "var(--ec-radius-sm)",
        borderLeft: "2px solid var(--ec-accent)",
        fontSize: "var(--ec-text-sm)",
        color: "var(--ec-text)",
        lineHeight: "var(--ec-leading-relaxed)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <div
        style={{
          fontSize: "var(--ec-text-2xs)",
          color: "var(--ec-text-dim)",
          letterSpacing: "var(--ec-tracking-caps)",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        Транскрипция
      </div>
      {shown}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "block",
            marginTop: 6,
            background: "transparent",
            border: 0,
            color: "var(--ec-accent)",
            fontSize: "var(--ec-text-2xs)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? "Свернуть" : "Развернуть"}
        </button>
      )}
      {/* v0.79 #22 phase 1: AI extract задач/решений/follow-up из транскрипта.
          Available только когда transcript readable (status=READY + non-empty). */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          disabled={extracting}
          onClick={async () => {
            setExtracting(true);
            setExtractError(null);
            setExtractedCount(null);
            setExtractedNote(null);
            try {
              const data = await apiJson<{
                createdActions: Array<unknown>;
                note: string | null;
              }>(
                `/api/attachments/${encodeURIComponent(attachmentId)}/extract-actions`,
                { method: "POST" },
              );
              setExtractedCount(data.createdActions.length);
              setExtractedNote(data.note);
            } catch (err) {
              setExtractError(
                err instanceof Error
                  ? err.message
                  : "Не удалось извлечь задачи",
              );
            } finally {
              setExtracting(false);
            }
          }}
          style={{
            padding: "0.2rem 0.55rem",
            borderRadius: "var(--ec-radius-md)",
            background: "transparent",
            border: "1px dashed var(--ec-border-default)",
            color: extracting
              ? "var(--ec-text-dim)"
              : "var(--ec-text-muted)",
            cursor: extracting ? "wait" : "pointer",
            fontSize: "var(--ec-text-2xs)",
            fontWeight: 600,
            letterSpacing: "var(--ec-tracking-caps)",
            textTransform: "uppercase",
          }}
        >
          {extracting ? "Извлекаю…" : "Извлечь задачи"}
        </button>
        {extractedCount != null && (
          <span
            style={{
              fontSize: "var(--ec-text-2xs)",
              color: extractedCount > 0 ? "var(--ec-accent)" : "var(--ec-text-dim)",
              fontWeight: 600,
            }}
          >
            {extractedCount > 0
              ? `+${extractedCount} ${extractedCount === 1 ? "задача" : "задач"}`
              : "Ничего не выделено"}
          </span>
        )}
        {extractedNote && (
          <span
            style={{
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-dim)",
              fontStyle: "italic",
            }}
          >
            {extractedNote}
          </span>
        )}
        {extractError && (
          <span
            style={{
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-danger)",
            }}
          >
            {extractError}
          </span>
        )}
      </div>
    </div>
  );
}

function ImageItem({ a, onOpen }: { a: Attachment; onOpen: (a: Attachment) => void }) {
  // Если thumbnail-sharp умер на сервере и thumbnailUrl=null — берём original.
  // Если ImgLoad упадёт и для thumbnail (404 / битый файл) — onError swap'нет
  // на original; если и original битый — показываем placeholder без broken-icon.
  const initialSrc = resolveAssetUrl(a.thumbnailUrl ?? a.url) ?? "";
  const fallbackSrc = resolveAssetUrl(a.url) ?? "";
  const [imgSrc, setImgSrc] = useState(initialSrc);
  const [errored, setErrored] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      style={{
        ...imageWrap,
        padding: 0,
        border: imageWrap.border,
        // Контейнер сжимается под natural размер картинки — не растягивается
        // в широкий бокс. maxWidth ограничивает крупные пейзажи.
        display: "inline-block",
        maxWidth: 480,
        width: "auto",
      }}
      aria-label={`Открыть изображение ${a.filename}`}
      onMouseEnter={(e) => {
        // v1.1.62 §8 — медиа «всплывает» на hover, как floating-сообщения.
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 16px 36px -12px hsl(210 60% 2% / 0.7)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 8px 24px -12px hsl(210 60% 2% / 0.6)";
      }}
    >
      {errored ? (
        <div
          style={{
            width: 320,
            height: 180,
            display: "grid",
            placeItems: "center",
            background: "var(--ec-surface-2)",
            color: "var(--ec-text-muted)",
            fontSize: "var(--ec-text-sm)",
            gap: 6,
            flexDirection: "column",
          }}
        >
          <FileIcon mime={a.mimeType} />
          <span style={{ maxWidth: "80%", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.filename}
          </span>
          <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
            не удалось показать превью
          </span>
        </div>
      ) : (
        <img
          src={imgSrc}
          alt={a.filename}
          loading="lazy"
          onError={() => {
            // First fail: попробуем original. Second fail: placeholder.
            if (imgSrc !== fallbackSrc) {
              setImgSrc(fallbackSrc);
            } else {
              setErrored(true);
            }
          }}
          /*
           * Картинка рендерится ЦЕЛИКОМ в естественной пропорции (без crop'а),
           * вписана в maxWidth × maxHeight. Раньше aspectRatio + objectFit:cover
           * обрезали портретные кадры в widescreen-бокс — теперь width/height:auto
           * + object-fit:contain держат картинку целой. Click → lightbox full-size.
           */
          style={{
            display: "block",
            width: "auto",
            height: "auto",
            maxWidth: 480,
            maxHeight: 420,
            objectFit: "contain",
          }}
        />
      )}
    </button>
  );
}

const lightboxBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.88)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--ec-space-6)",
  animation: "ec-fade-in var(--ec-dur-base) var(--ec-ease) both",
};

const lightboxImg: CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
  borderRadius: "var(--ec-radius-md)",
  boxShadow: "var(--ec-shadow-lg)",
  animation: "ec-modal-zoom-in var(--ec-dur-base) var(--ec-ease-out) both",
};

const lightboxControls: CSSProperties = {
  position: "fixed",
  top: 16,
  right: 16,
  display: "flex",
  gap: 8,
  zIndex: 1001,
};

const lightboxBtn: CSSProperties = {
  width: 38,
  height: 38,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--ec-radius-md)",
  background: "hsl(200 8% 12% / 0.85)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid var(--ec-border-default)",
  color: "var(--ec-text)",
  cursor: "pointer",
};

const lightboxCaption: CSSProperties = {
  position: "fixed",
  bottom: 16,
  left: 16,
  right: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "hsl(200 8% 12% / 0.85)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  zIndex: 1001,
  maxWidth: 600,
  margin: "0 auto",
};

const lightboxNavBtn: CSSProperties = {
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--ec-radius-sm)",
  background: "transparent",
  border: "1px solid var(--ec-border-default)",
  color: "var(--ec-text)",
  cursor: "pointer",
  flexShrink: 0,
};

/**
 * Lightbox-галерея (v1.1.86 — слайс 3): листает соседние вложения
 * (видео — внутри VideoPlayer кнопками next/prev + onEnded; картинки —
 * стрелками ‹ › в подписи / клавишами ←/→).
 */
function Lightbox({
  items,
  index,
  onClose,
  onPlayShared,
}: {
  items: Attachment[];
  index: number;
  onClose: () => void;
  onPlayShared?: (attachmentId: string) => void | Promise<void>;
}) {
  const [idx, setIdx] = useState(index);
  const go = useCallback(
    (delta: number) => {
      setIdx((i) => (i + delta + items.length) % items.length);
    },
    [items.length],
  );
  const multi = items.length > 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (multi && e.key === "ArrowLeft") go(-1);
      else if (multi && e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, multi, go]);

  const a = items[idx] ?? items[0];
  if (!a) return null;
  const fullUrl = resolveAssetUrl(a.url) ?? "";
  const video = isVideo(a);

  // Портал в document.body: лайтбокс рендерится внутри message-row, у
  // которой остаётся transform:translateY(0) от ec-anim-message-enter
  // (fill-mode:both). Любой не-none transform у предка делает его
  // containing-block'ом для position:fixed — без портала оверлей
  // позиционировался бы относительно строки сообщения, а не вьюпорта.
  return createPortal(
    <div style={lightboxBackdrop} onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      {video ? (
        <VideoPlayer
          key={a.id}
          src={fullUrl}
          onNext={multi ? () => go(1) : undefined}
          onPrev={multi ? () => go(-1) : undefined}
        />
      ) : (
        <img src={fullUrl} alt={a.filename} style={lightboxImg} />
      )}
      <div style={lightboxControls}>
        {video && onPlayShared && (
          <button
            type="button"
            onClick={() => {
              void onPlayShared(a.id);
              onClose();
            }}
            style={lightboxBtn}
            title="Смотреть вместе с комнатой"
            aria-label="Смотреть вместе"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="4" width="20" height="14" rx="2" />
              <path d="M10 9.2l5 2.8-5 2.8z" fill="currentColor" stroke="none" />
              <line x1="8" y1="21" x2="16" y2="21" />
            </svg>
          </button>
        )}
        <a
          href={fullUrl}
          download={a.filename}
          style={lightboxBtn}
          title="Скачать"
          aria-label="Скачать"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
        <button type="button" onClick={onClose} style={lightboxBtn} title="Закрыть" aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div style={lightboxCaption}>
        {/* Для картинок навигация — стрелками в подписи; у видео next/prev
            живут в самом плеере, поэтому здесь не дублируем. */}
        {multi && !video && (
          <button type="button" onClick={() => go(-1)} style={lightboxNavBtn} title="Предыдущее" aria-label="Предыдущее">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={a.filename}>
          {a.filename}
        </span>
        <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-xs)", fontFeatureSettings: '"tnum"' }}>
          {humanSize(a.size)}
          {a.width && a.height ? ` · ${a.width}×${a.height}` : ""}
          {multi ? ` · ${idx + 1}/${items.length}` : ""}
        </span>
        {multi && !video && (
          <button type="button" onClick={() => go(1)} style={lightboxNavBtn} title="Следующее" aria-label="Следующее">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Attachments({ attachments, onPlayShared }: Props) {
  const [lightbox, setLightbox] = useState<{
    items: Attachment[];
    index: number;
  } | null>(null);
  if (attachments.length === 0) return null;

  const images = attachments.filter(isImage);
  const videos = attachments.filter(isVideo);
  const audios = attachments.filter(isAudio);
  const files = attachments.filter((a) => !isImage(a) && !isVideo(a) && !isAudio(a));

  // Открыть lightbox-галерею. Соседи для навигации — однотипные вложения
  // того же сообщения (видео листается среди видео, картинки — среди картинок).
  const openLightbox = (att: Attachment) => {
    const list = isVideo(att) ? videos : isImage(att) ? images : [att];
    setLightbox({ items: list, index: Math.max(0, list.indexOf(att)) });
  };

  return (
    <div style={wrap}>
      {images.length > 0 && (
        <div
          style={
            images.length === 1
              ? {
                  // Одна картинка — НЕ растягиваем grid'ом, кнопка сама
                  // примет natural ширину (см. ImageItem display:inline-block).
                  display: "flex",
                  maxWidth: 540,
                }
              : {
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 4,
                  maxWidth: 540,
                }
          }
        >
          {images.map((a) => (
            <ImageItem key={a.id} a={a} onOpen={openLightbox} />
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="ec-video-attachment-grid">
          {videos.map((a) => (
            <VideoItem key={a.id} a={a} onOpen={openLightbox} />
          ))}
        </div>
      )}
      {audios.length > 0 && (
        <div className="ec-audio-attachment-list">
          {audios.map((a) => (
            <AudioItem key={a.id} a={a} onPlayShared={onPlayShared} />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((a) => (
            <a
              key={a.id}
              href={resolveAssetUrl(a.url) ?? ""}
              download={a.filename}
              target="_blank"
              rel="noopener noreferrer"
              style={fileChip}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ec-surface-3)";
                e.currentTarget.style.borderColor = "var(--ec-border-default)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--ec-surface-2)";
                e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
              }}
            >
              <span style={fileIconWrap} aria-hidden>
                <FileIcon mime={a.mimeType} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                <span
                  style={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={a.filename}
                >
                  {a.filename}
                </span>
                <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                  {humanSize(a.size)} · скачать
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
      {lightbox && (
        <Lightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onPlayShared={onPlayShared}
        />
      )}
    </div>
  );
}
