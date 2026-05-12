import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.55)",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  padding: "var(--ec-space-4)",
};

const closeBtn: CSSProperties = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text-muted)",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "var(--ec-space-4) var(--ec-space-5)",
  borderBottom: "1px solid var(--ec-border-subtle)",
};

const bodyStyle: CSSProperties = {
  padding: "var(--ec-space-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-4)",
  overflow: "auto",
};

const footerStyle: CSSProperties = {
  display: "flex",
  gap: "var(--ec-space-2)",
  justifyContent: "flex-end",
  padding: "var(--ec-space-3) var(--ec-space-5)",
  borderTop: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
};

export function Modal({ title, onClose, children, footer, width = 440 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const box: CSSProperties = {
    background: "var(--ec-surface-1)",
    boxShadow: "var(--ec-shadow-modal)",
    borderRadius: "var(--ec-radius-lg)",
    width: `min(${width}px, 100%)`,
    maxHeight: "calc(100vh - 64px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  return (
    <div
      style={backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={box} role="dialog" aria-labelledby="modal-title" aria-modal="true">
        <header style={headerStyle}>
          <h2
            id="modal-title"
            style={{
              margin: 0,
              fontSize: "var(--ec-text-md)",
              fontWeight: 600,
              color: "var(--ec-text-strong)",
              letterSpacing: "var(--ec-tracking-tight)",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={closeBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--ec-surface-2)";
              e.currentTarget.style.color = "var(--ec-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ec-text-muted)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div style={bodyStyle}>{children}</div>
        {footer && <div style={footerStyle}>{footer}</div>}
      </div>
    </div>
  );
}
