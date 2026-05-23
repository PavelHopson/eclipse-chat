import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

type Props = {
  onPick: (emoji: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
  /**
   * v1.2.24 — custom server emoji для reactions. Если передан и есть
   * entries, после Unicode grid рендерим вторую секцию с custom emoji.
   * Picker.onPick для custom отдаёт `:shortcode:` (не URL) — backend
   * парсит и хранит как reaction.emoji.
   */
  customEmojis?: Record<string, string>;
};

/**
 * Список синхронизирован с backend `ALLOWED_EMOJI` в
 * `apps/server/src/routes/messages.ts`. Расширение — отдельным изменением.
 */
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀", "🚀", "💯", "🙏", "👏"] as const;

const popover: CSSProperties = {
  position: "fixed",
  background: "var(--ec-overlay-bg)",
  backdropFilter: "saturate(180%) blur(14px)",
  WebkitBackdropFilter: "saturate(180%) blur(14px)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-md)",
  boxShadow: "var(--ec-shadow-md)",
  padding: 6,
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 2,
  zIndex: 50,
  animation: "ec-modal-zoom-in var(--ec-dur-fast) var(--ec-ease-out) both",
};

const cell: CSSProperties = {
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-sm)",
  cursor: "pointer",
  fontSize: 18,
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

export function EmojiPicker({ onPick, onClose, anchorRect, customEmojis }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Click outside / Escape — закрывает
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const customEntries = customEmojis ? Object.entries(customEmojis) : [];
  const hasCustom = customEntries.length > 0;

  // Позиционирование: рядом с anchor; clamp в viewport.
  // v1.2.24 — высоту увеличиваем если есть custom (грубо ×2 row'ов).
  const style: CSSProperties = { ...popover };
  if (anchorRect) {
    const POPOVER_W = 210;
    const POPOVER_H = hasCustom ? 240 : 130;
    const margin = 8;
    let left = anchorRect.right - POPOVER_W;
    let top = anchorRect.bottom + margin;
    if (top + POPOVER_H > window.innerHeight - margin) {
      top = anchorRect.top - POPOVER_H - margin;
    }
    if (left < margin) left = margin;
    if (left + POPOVER_W > window.innerWidth - margin) {
      left = window.innerWidth - POPOVER_W - margin;
    }
    style.left = left;
    style.top = top;
  }
  // Если есть custom — отключаем strict grid (нужны 2 секции flex'ом).
  if (hasCustom) {
    style.display = "flex";
    style.flexDirection = "column";
    style.gap = 4;
    delete style.gridTemplateColumns;
  }

  const gridSection: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 2,
  };
  const sectionLabel: CSSProperties = {
    padding: "0 4px",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ec-text-dim)",
    fontWeight: 700,
  };

  return (
    <div ref={ref} style={style} role="dialog" aria-label="Выбор реакции">
      <div style={hasCustom ? gridSection : undefined}>
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            style={cell}
            aria-label={`Реакция ${e}`}
            onClick={() => {
              onPick(e);
              onClose();
            }}
            onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--ec-surface-3)")}
            onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
          >
            {e}
          </button>
        ))}
      </div>
      {hasCustom && (
        <>
          <div style={sectionLabel}>Сервер</div>
          <div style={{ ...gridSection, maxHeight: 90, overflowY: "auto" }}>
            {customEntries.map(([code, url]) => (
              <button
                key={code}
                type="button"
                style={cell}
                aria-label={`Реакция :${code}:`}
                title={`:${code}:`}
                onClick={() => {
                  onPick(`:${code}:`);
                  onClose();
                }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--ec-surface-3)")}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
              >
                <img
                  src={url}
                  alt=""
                  aria-hidden
                  width={20}
                  height={20}
                  loading="lazy"
                  style={{ objectFit: "contain" }}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
