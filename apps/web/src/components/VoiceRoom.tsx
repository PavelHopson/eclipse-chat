import type { CSSProperties } from "react";
import { useEffect } from "react";
import { Avatar } from "./Avatar";
import { useVoice, type VoiceParticipant } from "../hooks/useVoice";
import type { MemberRow } from "../hooks/useMembers";

type Props = {
  channelId: string;
  channelName: string;
  members: MemberRow[];
};

const wrap: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  background:
    "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(195 40% 14% / 0.35) 0%, transparent 60%)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "var(--ec-space-3) var(--ec-space-5)",
  borderBottom: "1px solid var(--ec-border-subtle)",
};

const stage: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "var(--ec-space-5)",
  display: "grid",
  gap: "var(--ec-space-4)",
  gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
  alignContent: "start",
};

const controlsBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-3) var(--ec-space-5)",
  borderTop: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
};

const controlBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "var(--ec-radius-full)",
  display: "grid",
  placeItems: "center",
  background: "var(--ec-surface-2)",
  color: "var(--ec-text)",
  border: "1px solid var(--ec-border-default)",
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const controlBtnDanger: CSSProperties = {
  ...controlBtn,
  background: "var(--ec-danger)",
  color: "#fff",
  borderColor: "var(--ec-danger)",
};

const tile: CSSProperties = {
  position: "relative",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  padding: "var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  transition: "border-color var(--ec-dur-fast) var(--ec-ease), box-shadow var(--ec-dur-fast) var(--ec-ease)",
};

const tileSpeaking: CSSProperties = {
  ...tile,
  borderColor: "var(--ec-accent)",
  boxShadow: "0 0 0 1px var(--ec-accent), 0 0 22px -2px hsl(195 60% 55% / 0.5)",
};

const muteOverlay: CSSProperties = {
  position: "absolute",
  bottom: 12,
  right: 12,
  width: 24,
  height: 24,
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-danger)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  border: "2px solid var(--ec-surface-2)",
};

function MicIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function HeadphonesIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M3 14h3a2 2 0 012 2v3a2 2 0 01-2 2H4a1 1 0 01-1-1v-6z" />
      <path d="M21 14v6a1 1 0 01-1 1h-2a2 2 0 01-2-2v-3a2 2 0 012-2h3" />
      <path d="M3 14a9 9 0 0114-7.42M18.3 5.7A9 9 0 0121 12" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-3.07-3.07" />
      <line x1="22" y1="2" x2="2" y2="22" />
    </svg>
  );
}

function Tile({ p, lookupAvatar }: { p: VoiceParticipant; lookupAvatar: (identity: string) => string | null }) {
  const avatar = lookupAvatar(p.identity);
  const speaking = p.isSpeaking && !p.isMicMuted;
  return (
    <div style={speaking ? tileSpeaking : tile}>
      <Avatar url={avatar} name={p.name} size={88} />
      {p.isMicMuted && (
        <span style={muteOverlay} aria-label="Микрофон выключен" title="Микрофон выключен">
          <MicIcon off />
        </span>
      )}
      <span
        style={{
          fontSize: "var(--ec-text-sm)",
          fontWeight: 600,
          color: speaking ? "var(--ec-accent)" : "var(--ec-text)",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {p.name}
        {p.isLocal && (
          <span style={{ color: "var(--ec-text-dim)", fontWeight: 500, marginLeft: 4 }}>(вы)</span>
        )}
      </span>
    </div>
  );
}

export function VoiceRoom({ channelId, channelName, members }: Props) {
  const v = useVoice();

  // Helper для подбора avatar по identity (= userId)
  const lookupAvatar = (identity: string): string | null => {
    const m = members.find((mm) => mm.userId === identity);
    return m?.user.avatar ?? null;
  };

  // Auto-leave при смене channel — handled в useVoice через leave/join cycle.
  // Manual join button — explicit пользовательский интент.
  const isConnected = v.state === "connected" && v.activeChannelId === channelId;
  const isConnecting = v.state === "connecting" && v.activeChannelId === channelId;

  // Auto-leave при unmount компонента (смене channel)
  useEffect(() => {
    return () => {
      if (v.activeChannelId === channelId) {
        void v.leave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return (
    <div style={wrap}>
      <div style={header}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
        </svg>
        <strong style={{ color: "var(--ec-text-strong)" }}>{channelName}</strong>
        <span
          className={isConnected ? "ec-badge ec-badge--accent" : "ec-badge"}
          style={{ marginLeft: 6, fontSize: "0.6rem" }}
        >
          {isConnected ? "В ЭФИРЕ" : isConnecting ? "ПОДКЛЮЧАЕМСЯ…" : "ОТКЛЮЧЕНО"}
        </span>
        {v.participants.length > 0 && (
          <span style={{ marginLeft: "auto", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
            {v.participants.length} в комнате
          </span>
        )}
      </div>
      {v.participants.length > 0 ? (
        <div style={stage}>
          {v.participants.map((p) => (
            <Tile key={p.identity} p={p} lookupAvatar={lookupAvatar} />
          ))}
        </div>
      ) : (
        <div className="ec-empty" style={{ flex: 1 }}>
          <div className="ec-empty-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div className="ec-empty-title">Пусто в эфире</div>
          <div className="ec-empty-hint">Нажми «Подключиться» чтобы войти в голосовой канал.</div>
        </div>
      )}
      {v.error && (
        <p
          style={{
            margin: 0,
            padding: "var(--ec-space-2) var(--ec-space-5)",
            color: "var(--ec-danger)",
            background: "var(--ec-danger-soft)",
            borderTop: "1px solid var(--ec-border-subtle)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          {v.error}
        </p>
      )}
      <div style={controlsBar}>
        {!isConnected ? (
          <button
            type="button"
            onClick={() => void v.join(channelId)}
            disabled={v.busy}
            className="ec-btn ec-btn--primary"
            style={{ padding: "0.7rem 1.4rem" }}
          >
            {v.busy ? "Подключаемся…" : "Подключиться к голосу"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void v.toggleMic()}
              style={v.isMicMuted ? controlBtnDanger : controlBtn}
              title={v.isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
              aria-label={v.isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
            >
              <MicIcon off={v.isMicMuted} />
            </button>
            <button
              type="button"
              onClick={() => v.toggleDeafen()}
              style={v.isDeafened ? controlBtnDanger : controlBtn}
              title={v.isDeafened ? "Включить звук" : "Заглушить всех"}
              aria-label={v.isDeafened ? "Включить звук" : "Заглушить всех"}
            >
              <HeadphonesIcon off={v.isDeafened} />
            </button>
            <button
              type="button"
              onClick={() => void v.leave()}
              style={controlBtnDanger}
              title="Покинуть голосовой канал"
              aria-label="Покинуть голосовой канал"
            >
              <PhoneOffIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
