import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};

const box: CSSProperties = {
  background: "#15151a",
  border: "1px solid #2a2a32",
  borderRadius: 12,
  width: "min(420px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 64px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid #2a2a32",
};

const closeBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#c8c8d0",
  cursor: "pointer",
  fontSize: 22,
  lineHeight: 1,
  padding: 4,
};

const body: CSSProperties = {
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  overflow: "auto",
};

const footerStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  padding: "12px 18px",
  borderTop: "1px solid #2a2a32",
  background: "#13131a",
};

export function Modal({ title, onClose, children, footer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div style={box} role="dialog" aria-labelledby="modal-title">
        <header style={header}>
          <h2 id="modal-title" style={{ margin: 0, fontSize: "1rem" }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" style={closeBtn}>
            ×
          </button>
        </header>
        <div style={body}>{children}</div>
        {footer && <div style={footerStyle}>{footer}</div>}
      </div>
    </div>
  );
}
