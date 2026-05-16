import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { Attachment } from "../hooks/useMessages";
import { resolveAssetUrl } from "../lib/assets";

type Props = {
  attachments: Attachment[];
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
  transition: "transform var(--ec-dur-fast) var(--ec-ease)",
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

function AudioItem({ a }: { a: Attachment }) {
  const src = resolveAssetUrl(a.url) ?? "";
  const isVoice = /^voice-message-/i.test(a.filename);
  return (
    <div className={isVoice ? "ec-audio-attachment ec-audio-attachment--voice" : "ec-audio-attachment"}>
      <div className="ec-audio-attachment__icon" aria-hidden>
        <FileIcon mime={a.mimeType} />
      </div>
      <div className="ec-audio-attachment__body">
        <div className="ec-audio-attachment__title">
          {isVoice ? "Голосовое сообщение" : a.filename}
        </div>
        <audio controls preload="metadata" src={src} />
        <div className="ec-audio-attachment__meta">
          {humanSize(a.size)} · {a.mimeType.split("/")[1] ?? "audio"}
        </div>
      </div>
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
        e.currentTarget.style.transform = "scale(1.005)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
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

function Lightbox({ a, onClose }: { a: Attachment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const fullUrl = resolveAssetUrl(a.url) ?? "";
  return (
    <div style={lightboxBackdrop} onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      {isVideo(a) ? (
        <video src={fullUrl} controls autoPlay playsInline style={lightboxImg} />
      ) : (
        <img src={fullUrl} alt={a.filename} style={lightboxImg} />
      )}
      <div style={lightboxControls}>
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
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={a.filename}>
          {a.filename}
        </span>
        <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-xs)", fontFeatureSettings: '"tnum"' }}>
          {humanSize(a.size)}
          {a.width && a.height ? ` · ${a.width}×${a.height}` : ""}
        </span>
      </div>
    </div>
  );
}

export function Attachments({ attachments }: Props) {
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  if (attachments.length === 0) return null;

  const images = attachments.filter(isImage);
  const videos = attachments.filter(isVideo);
  const audios = attachments.filter(isAudio);
  const files = attachments.filter((a) => !isImage(a) && !isVideo(a) && !isAudio(a));

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
            <ImageItem key={a.id} a={a} onOpen={setLightbox} />
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="ec-video-attachment-grid">
          {videos.map((a) => (
            <VideoItem key={a.id} a={a} onOpen={setLightbox} />
          ))}
        </div>
      )}
      {audios.length > 0 && (
        <div className="ec-audio-attachment-list">
          {audios.map((a) => (
            <AudioItem key={a.id} a={a} />
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
      {lightbox && <Lightbox a={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
