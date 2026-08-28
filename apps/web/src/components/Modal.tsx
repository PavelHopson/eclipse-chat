import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";

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
  closeOnEscape?: boolean;
  className?: string;
};

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 440,
  closeOnEscape = true,
  className = "",
}: Props) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const box = boxRef.current;
    const topmost = () => Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).at(-1) === box;
    const focusable = () => Array.from(box?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])
      .filter((element) => element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      if (topmost()) (box?.querySelector<HTMLElement>("[data-autofocus]:not(:disabled)") ?? focusable()[0] ?? box)?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (!topmost()) return;
      if (e.key === "Escape" && closeOnEscape) { e.preventDefault(); closeRef.current(); }
      if (e.key === "Tab") {
        const items = focusable();
        const first = items[0], last = items.at(-1);
        if (!first) { e.preventDefault(); box?.focus(); }
        else if (e.shiftKey && (document.activeElement === first || !box?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !box?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    // v0.65: body scroll-lock пока modal открыт — иначе на mobile фон
    // прокручивается под backdrop (особенно с виртуальной клавиатурой).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [closeOnEscape]);

  // Escape the isolated chat pane without losing workspace theme variables.
  const overlayRoot = document.querySelector(".ec-shell.ec-workspace-v2") ?? document.body;
  return createPortal(
    <div
      className="ec-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        tabIndex={-1}
        className={"ec-modal-box " + className}
        // width — единственное динамическое значение (prop); 100dvh-clamp
        // и breathing-room по 16px с каждой стороны — в .ec-modal-box.
        style={{ width: `min(${width}px, calc(100vw - 32px))` }}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
      >
        <header className="ec-holo-edge ec-modal-header">
          <h2 id={titleId} className="ec-modal-title">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ec-modal-close ec-icon-btn"
          >
            <EclipseUiIcon name="close" size={18} />
          </button>
        </header>
        <div className="ec-modal-body">{children}</div>
        {footer && <div className="ec-modal-footer">{footer}</div>}
      </div>
    </div>, overlayRoot,
  );
}
