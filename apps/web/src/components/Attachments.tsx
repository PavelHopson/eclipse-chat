import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { Attachment } from "../hooks/useMessages";

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

function resolveUrl(raw: string): string {
  if (raw.startsWith("data:") || raw.startsWith("blob:") || /^https?:\/\//i.test(raw)) {
    return raw;
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(a: Attachment): boolean {
  return a.mimeType.startsWith("image/");
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

function FileIcon({ mime }: { mime: string }) {
  if (mime === "application/pdf") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <text x="7" y="18" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">PDF</text>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ImageItem({ a, onOpen }: { a: Attachment; onOpen: (a: Attachment) => void }) {
  // Если thumbnail-sharp умер на сервере и thumbnailUrl=null — берём original.
  // Если ImgLoad упадёт и для thumbnail (404 / битый файл) — onError swap'нет
  // на original; если и original битый — показываем placeholder без broken-icon.
  const initialSrc = resolveUrl(a.thumbnailUrl ?? a.url);
  const fallbackSrc = resolveUrl(a.url);
  const [imgSrc, setImgSrc] = useState(initialSrc);
  const [errored, setErrored] = useState(false);
  // Aspect ratio из metadata если есть, иначе fallback на 16:9
  const aspect = a.width && a.height ? `${a.width} / ${a.height}` : "16 / 9";
  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      style={{ ...imageWrap, padding: 0, border: imageWrap.border, maxWidth: 480 }}
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
            width: "100%",
            maxWidth: 480,
            aspectRatio: aspect,
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
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            maxWidth: 480,
            maxHeight: 360,
            aspectRatio: aspect,
            objectFit: "cover",
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
  const fullUrl = resolveUrl(a.url);
  return (
    <div style={lightboxBackdrop} onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      <img src={fullUrl} alt={a.filename} style={lightboxImg} />
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
  const files = attachments.filter((a) => !isImage(a));

  return (
    <div style={wrap}>
      {images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: images.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: 4,
            maxWidth: 540,
          }}
        >
          {images.map((a) => (
            <ImageItem key={a.id} a={a} onOpen={setLightbox} />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((a) => (
            <a
              key={a.id}
              href={resolveUrl(a.url)}
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
