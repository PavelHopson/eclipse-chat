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
  width: 72,
  background: "#0a0a0c",
  borderRight: "1px solid #1c1c22",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
};

const buttonBase: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  border: "1px solid #2a2a32",
  background: "#1a1a20",
  color: "#e8e8ed",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: 18,
  transition: "border-radius 120ms ease, background 120ms ease",
  position: "relative",
};

const activeMarker: CSSProperties = {
  position: "absolute",
  left: -10,
  top: 12,
  bottom: 12,
  width: 4,
  borderRadius: 4,
  background: "#9ac",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
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
              ...buttonBase,
              borderRadius: isActive ? 12 : 24,
              background: isActive ? "#2a2a3a" : "#1a1a20",
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
              <span aria-hidden>{initials(s.name) || "??"}</span>
            )}
          </button>
        );
      })}

      <div style={{ width: 32, height: 1, background: "#2a2a32", margin: "4px 0" }} />

      <button
        type="button"
        onClick={onCreateRequest}
        title="Создать сервер"
        style={{ ...buttonBase, background: "#13391d", borderColor: "#1f5a2e", color: "#7fe195" }}
      >
        +
      </button>
      <button
        type="button"
        onClick={onJoinRequest}
        title="Вступить по инвайту"
        style={{ ...buttonBase, background: "#13202f", borderColor: "#1f3f5e", color: "#7fb6e1" }}
      >
        ⤵
      </button>
    </nav>
  );
}
