import type { ReactNode } from "react";
import { useEffect } from "react";

/**
 * Modal (v1.1.94 redesign slice 5) — базовая модалка. Её используют
 * все диалоги приложения, поэтому grammar-v2 здесь — рычаг на все
 * overlay'и. Визуальный слой — `.ec-modal-*` в components.css.
 */

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
};

export function Modal({ title, onClose, children, footer, width = 440 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // v0.65: body scroll-lock пока modal открыт — иначе на mobile фон
    // прокручивается под backdrop (особенно с виртуальной клавиатурой).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="ec-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ec-modal-box"
        // width — единственное динамическое значение (prop); 100dvh-clamp
        // и breathing-room по 16px с каждой стороны — в .ec-modal-box.
        style={{ width: `min(${width}px, calc(100vw - 32px))` }}
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        <header className="ec-holo-edge ec-modal-header">
          <h2 id="modal-title" className="ec-modal-title">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ec-modal-close ec-icon-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div className="ec-modal-body">{children}</div>
        {footer && <div className="ec-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
