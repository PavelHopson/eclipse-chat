import type { CSSProperties } from "react";
import type { ServerRow } from "../hooks/useServers";

type Props = {
  servers: ServerRow[];
  activeServerId: string | null;
  onSelect: (id: string) => void;
  onCreateRequest: () => void;
  onJoinRequest: () => void;
};

const railStyle: CSSProperties = {
  background: "var(--ec-surface-1)",
  borderRight: "1px solid var(--ec-border-subtle)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-3) 0",
  overflowY: "auto",
};

const tileBase: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "var(--ec-radius-lg)",
  background: "var(--ec-surface-2)",
  color: "var(--ec-text)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: "var(--ec-text-sm)",
  letterSpacing: 0,
  border: "1px solid var(--ec-border-subtle)",
  transition: "border-radius var(--ec-dur-base) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease), box-shadow var(--ec-dur-fast) var(--ec-ease), transform var(--ec-dur-fast) var(--ec-ease)",
  position: "relative",
  overflow: "hidden",
};

const activeMarker: CSSProperties = {
  position: "absolute",
  left: -16,
  top: "50%",
  transform: "translateY(-50%)",
  width: 4,
  height: 22,
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-accent)",
  boxShadow: "0 0 8px hsl(195 60% 55% / 0.5)",
};

const separator: CSSProperties = {
  width: 26,
  height: 1,
  background: "var(--ec-border-subtle)",
  margin: "var(--ec-space-1) 0",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

export function ServerList({ servers, activeServerId, onSelect, onCreateRequest, onJoinRequest }: Props) {
  return (
    <nav style={railStyle} aria-label="Список серверов">
      {servers.map((s) => {
        const isActive = s.id === activeServerId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            title={s.name}
            style={{
              ...tileBase,
              borderRadius: isActive ? "var(--ec-radius-lg)" : "var(--ec-radius-full)",
              background: isActive ? "var(--ec-surface-3)" : "var(--ec-surface-2)",
              borderColor: isActive ? "var(--ec-border-accent)" : "var(--ec-border-subtle)",
              boxShadow: isActive ? "var(--ec-glow-active)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderRadius = "var(--ec-radius-lg)";
                e.currentTarget.style.background = "var(--ec-surface-3)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderRadius = "var(--ec-radius-full)";
                e.currentTarget.style.background = "var(--ec-surface-2)";
              }
            }}
          >
            {isActive && <span style={activeMarker} aria-hidden />}
            {s.icon ? (
              <img
                src={s.icon}
                alt=""
                style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }}
              />
            ) : (
              <span aria-hidden>{initials(s.name)}</span>
            )}
          </button>
        );
      })}

      <div style={separator} aria-hidden />

      <button
        type="button"
        onClick={onCreateRequest}
        title="Создать сервер"
        style={{
          ...tileBase,
          borderRadius: "var(--ec-radius-full)",
          background: "transparent",
          color: "var(--ec-accent-2)",
          borderColor: "var(--ec-border-default)",
          borderStyle: "dashed",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderRadius = "var(--ec-radius-lg)";
          e.currentTarget.style.background = "var(--ec-accent-2-soft)";
          e.currentTarget.style.borderStyle = "solid";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderRadius = "var(--ec-radius-full)";
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderStyle = "dashed";
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onJoinRequest}
        title="Вступить по инвайту"
        style={{
          ...tileBase,
          borderRadius: "var(--ec-radius-full)",
          background: "transparent",
          color: "var(--ec-accent)",
          borderColor: "var(--ec-border-default)",
          borderStyle: "dashed",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderRadius = "var(--ec-radius-lg)";
          e.currentTarget.style.background = "var(--ec-accent-soft)";
          e.currentTarget.style.borderStyle = "solid";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderRadius = "var(--ec-radius-full)";
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderStyle = "dashed";
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 18l6-6-6-6" />
          <path d="M15 3v6" />
          <path d="M21 9h-6" />
        </svg>
      </button>
    </nav>
  );
}
