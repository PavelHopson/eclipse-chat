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
  background: "var(--ec-surface-1)",
  borderRight: "1px solid var(--ec-border-subtle)",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const headerStyle: CSSProperties = {
  padding: "var(--ec-space-3) var(--ec-space-4)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
};

const serverTrigger: CSSProperties = {
  background: "transparent",
  border: 0,
  padding: 0,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-2)",
  cursor: "pointer",
  color: "var(--ec-text-strong)",
  textAlign: "left",
  borderRadius: "var(--ec-radius-sm)",
  transition: "color var(--ec-dur-fast) var(--ec-ease)",
};

const listWrap: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "var(--ec-space-3) var(--ec-space-2)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const composerRow: CSSProperties = {
  padding: "var(--ec-space-3)",
  borderTop: "1px solid var(--ec-border-subtle)",
  display: "flex",
  gap: "var(--ec-space-2)",
};

function roleClass(role: string): string {
  if (role === "OWNER") return "ec-badge ec-badge--owner";
  if (role === "ADMIN" || role === "MODERATOR") return "ec-badge ec-badge--accent";
  return "ec-badge";
}

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
        <button type="button" onClick={onShowServerInfo} style={serverTrigger} title="Подробнее о сервере">
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontSize: "var(--ec-text-base)",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {serverName ?? "Нет сервера"}
            </span>
            {serverRole && <span className={roleClass(serverRole)} style={{ alignSelf: "flex-start" }}>{serverRole}</span>}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ color: "var(--ec-text-dim)", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </header>

      <div style={listWrap}>
        <div className="ec-section-label" style={{ marginBottom: "var(--ec-space-2)" }}>
          <span>Каналы</span>
          {channels.length > 0 && <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{channels.length}</span>}
        </div>
        {channels.map((c) => {
          const isActive = c.id === selectedChannelId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={isActive ? "ec-channel-item ec-channel-item--active" : "ec-channel-item"}
            >
              <span className="ec-channel-hash" aria-hidden>#</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {c.name}
              </span>
              {c._count.messages > 0 && <span className="ec-channel-count">{c._count.messages}</span>}
            </button>
          );
        })}
        {channels.length === 0 && (
          <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-2) var(--ec-space-2) 0", margin: 0 }}>
            Создайте первый канал ниже.
          </p>
        )}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim() || submitting) return;
          setSubmitting(true);
          try {
            await onCreate(draft.trim());
            setDraft("");
          } finally {
            setSubmitting(false);
          }
        }}
        style={composerRow}
      >
        <input
          className="ec-field"
          placeholder="Новый канал…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={80}
          style={{ flex: 1, padding: "0.45rem 0.65rem", fontSize: "var(--ec-text-sm)" }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || submitting}
          className="ec-btn ec-btn--primary ec-btn--sm"
          aria-label="Создать канал"
          title="Создать канал"
          style={{ minWidth: 36, padding: "0 0.6rem" }}
        >
          {submitting ? "…" : "+"}
        </button>
      </form>
    </aside>
  );
}
