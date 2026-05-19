import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/**
 * ChatHeaderHoverButton — v0.98 chat surface cleanup.
 *
 * Pavel-ask 19.05: «все закрепы и задачи, чтобы при наведении отображались
 * поверх экрана чата». Раньше ActionQueueBar + PinnedBar занимали место
 * сверху MessageList'а постоянно — даже когда пользователь хочет просто
 * читать сообщения. Теперь — compact icon в chat-header, hover показывает
 * preview-popover, click открывает full panel (ChannelInfoPanel).
 *
 * Generic component reusable для pins / tasks (потенциально и других
 * "quick access" surfaces в будущем).
 *
 * Поведение:
 *   - Hidden если count === 0 (нечего показывать)
 *   - Hover на icon → popover появляется ниже с item-list
 *   - Mouse-leave (с задержкой) → popover скрывается
 *   - Click на icon → opens full panel (через onOpenFull callback)
 *   - Item click внутри popover → также opens full panel
 */

type Props<T> = {
  /** Иконка кнопки (14px SVG). */
  icon: ReactNode;
  /** Tooltip + aria-label. */
  label: string;
  /** Quantity badge. Если 0 — кнопка не рендерится. */
  count: number;
  /** Top N items для preview (caller сам truncate'ит до 3-5). */
  items: T[];
  /** Render item — короткий one/two-liner. */
  renderItem: (item: T) => ReactNode;
  /** key extractor. */
  itemKey: (item: T) => string;
  /** Открыть полный panel (вызывается на click button + на «Показать все»). */
  onOpenFull: () => void;
  /** Accent цвет для иконки + badge. Default — accent. */
  accent?: string;
};

const wrap: CSSProperties = {
  position: "relative",
  display: "inline-flex",
};

const btn: CSSProperties = {
  flexShrink: 0,
  height: 26,
  padding: "0 0.5rem",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text-dim)",
  cursor: "pointer",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  fontFeatureSettings: '"tnum"',
  transition:
    "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
};

const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 16,
  height: 16,
  padding: "0 4px",
  borderRadius: "var(--ec-radius-full)",
  fontSize: "0.6rem",
  fontWeight: 700,
  letterSpacing: 0,
};

const popover: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  right: 0,
  width: 320,
  maxWidth: "calc(100vw - 32px)",
  background: "var(--ec-surface-1)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  boxShadow: "0 16px 40px -8px hsl(210 40% 2% / 0.65)",
  padding: "var(--ec-space-2)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-1)",
  zIndex: 20,
};

const popoverHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "var(--ec-space-1) var(--ec-space-2)",
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  fontWeight: 700,
};

const itemBtn: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "var(--ec-space-2) var(--ec-space-2)",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text)",
  cursor: "pointer",
  fontSize: "var(--ec-text-sm)",
  fontFamily: "inherit",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const showAllLink: CSSProperties = {
  display: "block",
  textAlign: "center",
  width: "100%",
  padding: "var(--ec-space-2)",
  background: "transparent",
  border: 0,
  borderTop: "1px solid var(--ec-border-subtle)",
  marginTop: 4,
  color: "var(--ec-accent)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "var(--ec-tracking-wide)",
  cursor: "pointer",
  fontFamily: "inherit",
};

export function ChatHeaderHoverButton<T>({
  icon,
  label,
  count,
  items,
  renderItem,
  itemKey,
  onOpenFull,
  accent,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const scheduleClose = () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };
  const cancelClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  useEffect(() => () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
  }, []);

  if (count === 0) return null;

  const accentColor = accent ?? "var(--ec-accent)";

  return (
    <div
      style={wrap}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={onOpenFull}
        aria-label={label}
        title={label}
        style={btn}
        onFocus={() => setOpen(true)}
        onBlur={scheduleClose}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--ec-surface-2)";
          e.currentTarget.style.color = "var(--ec-text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ec-text-dim)";
        }}
      >
        <span style={{ display: "inline-flex", color: accentColor }}>{icon}</span>
        <span
          style={{
            ...badge,
            background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
            color: accentColor,
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      </button>

      {open && items.length > 0 && (
        <div
          style={popover}
          role="dialog"
          aria-label={label}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div style={popoverHeader}>
            <span>{label}</span>
            <span style={{ color: "var(--ec-text-dim)", textTransform: "none", letterSpacing: 0 }}>
              {count}
            </span>
          </div>
          {items.map((item) => (
            <button
              key={itemKey(item)}
              type="button"
              style={itemBtn}
              onClick={onOpenFull}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ec-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {renderItem(item)}
            </button>
          ))}
          {count > items.length && (
            <button
              type="button"
              onClick={onOpenFull}
              style={showAllLink}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ec-accent-soft)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Показать все ({count})
            </button>
          )}
          {count === items.length && count > 0 && (
            <button
              type="button"
              onClick={onOpenFull}
              style={showAllLink}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ec-accent-soft)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Открыть панель
            </button>
          )}
        </div>
      )}
    </div>
  );
}
