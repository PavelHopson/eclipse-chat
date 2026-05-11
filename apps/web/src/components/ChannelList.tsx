import type { CSSProperties } from "react";
import { useState } from "react";
import type { ChannelRow } from "../hooks/useChannels";

type Props = {
  serverName: string | null;
  serverRole: string | null;
  inviteCode: string | null;
  channels: ChannelRow[];
  selectedChannelId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onShowServerInfo: () => void;
};

const wrap: CSSProperties = {
  width: 240,
  background: "#15151a",
  borderRight: "1px solid #1c1c22",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #1c1c22",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  background: "#15151a",
  position: "sticky",
  top: 0,
};

const listWrap: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "8px 8px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const channelBtn: CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.6rem",
  borderRadius: 6,
  background: "transparent",
  border: "none",
  color: "#c8c8d0",
  cursor: "pointer",
  fontSize: "0.9rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const inputBase: CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid #2a2a32",
  background: "#1a1a20",
  color: "#e8e8ed",
};

export function ChannelList({
  serverName,
  serverRole,
  inviteCode: _inviteCode,
  channels,
  selectedChannelId,
  onSelect,
  onCreate,
  onShowServerInfo,
}: Props) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <aside style={wrap}>
      <header style={headerStyle}>
        <button
          type="button"
          onClick={onShowServerInfo}
          style={{
            background: "transparent",
            border: "none",
            color: "#e8e8ed",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2,
            padding: 0,
          }}
          title="Подробнее о сервере"
        >
          <span>{serverName ?? "Нет сервера"}</span>
          {serverRole && (
            <span style={{ fontSize: "0.7rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {serverRole}
            </span>
          )}
        </button>
      </header>

      <div style={listWrap}>
        <div style={{ fontSize: "0.72rem", letterSpacing: 0.6, opacity: 0.5, textTransform: "uppercase", padding: "4px 6px 8px" }}>
          Текстовые каналы
        </div>
        {channels.map((c) => {
          const isActive = c.id === selectedChannelId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              style={{
                ...channelBtn,
                background: isActive ? "#2a2a3a" : "transparent",
                color: isActive ? "#e8e8ed" : "#c8c8d0",
              }}
            >
              <span>
                <span style={{ opacity: 0.5, marginRight: 6 }}>#</span>
                {c.name}
              </span>
              <span style={{ opacity: 0.4, fontSize: "0.75rem" }}>{c._count.messages}</span>
            </button>
          );
        })}
        {channels.length === 0 && (
          <p style={{ opacity: 0.5, fontSize: "0.85rem", padding: "8px 6px" }}>Каналов пока нет</p>
        )}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim() || submitting) {
            return;
          }
          setSubmitting(true);
          try {
            await onCreate(draft.trim());
            setDraft("");
          } finally {
            setSubmitting(false);
          }
        }}
        style={{
          padding: 10,
          borderTop: "1px solid #1c1c22",
          display: "flex",
          gap: 6,
        }}
      >
        <input
          placeholder="Новый канал…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={inputBase}
        />
        <button
          type="submit"
          disabled={!draft.trim() || submitting}
          style={{
            padding: "0.5rem 0.7rem",
            background: "#3b5ccc",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: draft.trim() ? "pointer" : "default",
            opacity: draft.trim() ? 1 : 0.5,
          }}
        >
          +
        </button>
      </form>
    </aside>
  );
}
