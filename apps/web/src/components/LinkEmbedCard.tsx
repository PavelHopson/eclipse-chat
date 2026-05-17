import type { CSSProperties } from "react";
import { useState } from "react";
import { useLinkPreview } from "../hooks/useLinkPreview";

/**
 * Link preview card (v0.67) — Telegram/Slack-style OG cards под
 * сообщениями. Calm operational look: thin accent-side border,
 * compact thumbnail (если есть), title bold + description muted +
 * hostname/siteName в footer. Click anywhere → opens URL в new tab.
 *
 * Skeleton stays минимальной — не плодим shimmer-шум: только thin
 * placeholder card с host fragment. Если preview FAILED — ничего
 * не рендерим (есть auto-link через RichContent сверху).
 *
 * Failure-safe рендеринг изображений: `onError` скрывает img, layout
 * перестраивается без thumbnail. Это особенно важно для og:image от
 * CDN'ов с hot-link защитой.
 */

type Props = {
  url: string;
};

const cardStyle: CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
  maxWidth: 540,
  marginTop: 8,
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderLeft: "3px solid var(--ec-accent)",
  borderRadius: "var(--ec-radius-md)",
  overflow: "hidden",
  transition: "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const inner: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 0,
};

const innerWithImage: CSSProperties = {
  ...inner,
  gridTemplateColumns: "minmax(0, 1fr) 96px",
};

const textCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "10px 12px",
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  fontSize: "var(--ec-text-sm)",
  fontWeight: 600,
  color: "var(--ec-text-strong)",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  lineHeight: "var(--ec-leading-snug)",
};

const descStyle: CSSProperties = {
  fontSize: "var(--ec-text-xs)",
  color: "var(--ec-text-muted)",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  lineHeight: "var(--ec-leading-snug)",
};

const footerStyle: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  letterSpacing: "var(--ec-tracking-wide)",
  textTransform: "uppercase",
  marginTop: 2,
};

const imageCell: CSSProperties = {
  width: 96,
  height: "100%",
  minHeight: 72,
  background: "var(--ec-surface-3)",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const imageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const skeletonStyle: CSSProperties = {
  ...cardStyle,
  borderLeftColor: "var(--ec-border-default)",
  cursor: "default",
};

export function LinkEmbedCard({ url }: Props) {
  const { data, loading } = useLinkPreview(url);
  const [imgFailed, setImgFailed] = useState(false);

  // Skeleton — thin placeholder. Не shimmer, чтобы не отвлекать.
  if (loading && !data) {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      // ignore
    }
    return (
      <div style={skeletonStyle} aria-label="Загрузка превью ссылки">
        <div style={textCol}>
          <div style={{ ...titleStyle, color: "var(--ec-text-muted)" }}>…</div>
          <div style={footerStyle}>{host}</div>
        </div>
      </div>
    );
  }

  // FAILED preview — карточка не рендерится; RichContent сверху уже
  // показал auto-link, дублировать "URL не доступен" не нужно.
  if (!data || data.status !== "OK") return null;

  const showImage = Boolean(data.image && !imgFailed);
  const host = data.siteName ?? (() => {
    try {
      return new URL(data.url).hostname;
    } catch {
      return data.url;
    }
  })();

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      style={cardStyle}
      className="ec-link-embed"
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--ec-surface-3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--ec-surface-2)";
      }}
      title={data.url}
    >
      <div style={showImage ? innerWithImage : inner}>
        <div style={textCol}>
          {data.title && <div style={titleStyle}>{data.title}</div>}
          {data.description && <div style={descStyle}>{data.description}</div>}
          <div style={footerStyle}>{host}</div>
        </div>
        {showImage && data.image && (
          <div style={imageCell}>
            <img
              src={data.image}
              alt=""
              loading="lazy"
              decoding="async"
              style={imageStyle}
              onError={() => setImgFailed(true)}
            />
          </div>
        )}
      </div>
    </a>
  );
}
