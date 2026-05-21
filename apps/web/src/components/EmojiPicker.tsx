import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

type Props = {
  onPick: (emoji: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
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

export function EmojiPicker({ onPick, onClose, anchorRect }: Props) {
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

  // Позиционирование: рядом с anchor; clamp в viewport.
  const style: CSSProperties = { ...popover };
  if (anchorRect) {
    const POPOVER_W = 210;
    const POPOVER_H = 130;
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

  return (
    <div ref={ref} style={style} role="dialog" aria-label="Выбор реакции">
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
  );
}
