import type { CSSProperties } from "react";
import { useState } from "react";
import { Avatar } from "../components/Avatar";
import { ChannelList } from "../components/ChannelList";
import { CreateServerModal } from "../components/CreateServerModal";
import { JoinServerModal } from "../components/JoinServerModal";
import { MessageInput } from "../components/MessageInput";
import { MessageList } from "../components/MessageList";
import { ProfileModal } from "../components/ProfileModal";
import { ServerInfoModal } from "../components/ServerInfoModal";
import { ServerList } from "../components/ServerList";
import { useChannels } from "../hooks/useChannels";
import { useMessages } from "../hooks/useMessages";
import { useProfile } from "../hooks/useProfile";
import { useServers } from "../hooks/useServers";
import { useSocket } from "../hooks/useSocket";
import type { PublicUser } from "../hooks/useAuth";

type Props = {
  user: PublicUser;
  socketRev: number;
  onLogout: () => Promise<void>;
};

const shellStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "var(--ec-rail-width) var(--ec-sidebar-width) 1fr",
  gridTemplateRows: "var(--ec-header-height) 1fr",
  height: "100vh",
  background: "var(--ec-bg)",
  color: "var(--ec-text)",
};

const topbar: CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 var(--ec-space-4)",
  background: "var(--ec-surface-1)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  gap: "var(--ec-space-3)",
};

const brand: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  fontSize: "var(--ec-text-sm)",
  fontWeight: 600,
  letterSpacing: "var(--ec-tracking-tight)",
  color: "var(--ec-text-strong)",
};

const brandMark: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "var(--ec-radius-sm)",
  background: "linear-gradient(135deg, hsl(195 60% 55%) 0%, hsl(160 45% 55%) 100%)",
  boxShadow: "var(--ec-glow-active)",
};

const breadcrumbStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  marginLeft: "var(--ec-space-4)",
  paddingLeft: "var(--ec-space-4)",
  borderLeft: "1px solid var(--ec-border-subtle)",
  color: "var(--ec-text-muted)",
  fontSize: "var(--ec-text-sm)",
};

const userChip: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-1) var(--ec-space-3) var(--ec-space-1) var(--ec-space-1)",
  background: "transparent",
  color: "var(--ec-text)",
  border: "1px solid transparent",
  borderRadius: "var(--ec-radius-full)",
  cursor: "pointer",
  fontSize: "var(--ec-text-sm)",
  transition: "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const chatColumn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  background: "var(--ec-bg)",
};

const chatHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "0 var(--ec-space-5)",
  height: 48,
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-bg)",
};

const chatTitle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "var(--ec-space-2)",
  fontSize: "var(--ec-text-base)",
  fontWeight: 600,
  color: "var(--ec-text-strong)",
};

const errorBanner: CSSProperties = {
  padding: "var(--ec-space-2) var(--ec-space-5)",
  color: "var(--ec-danger)",
  background: "var(--ec-danger-soft)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  fontSize: "var(--ec-text-sm)",
};

export function AppShell({ user, socketRev, onLogout }: Props) {
  const socket = useSocket(socketRev);

  const isReady = socket != null;
  const {
    servers,
    activeServer,
    activeServerId,
    setActiveServerId,
    createServer,
    joinByInvite,
    leaveServer,
    deleteServer,
    error: serversError,
  } = useServers(true);

  const {
    channels,
    selectedChannelId,
    setSelectedChannelId,
    createChannel,
  } = useChannels(activeServerId, socket);

  const { messages, sendMessage, error: messagesError, loading: messagesLoading } = useMessages(
    selectedChannelId,
    socket,
  );

  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showServerInfo, setShowServerInfo] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const {
    profile,
    busy: profileBusy,
    error: profileError,
    updateProfile,
    uploadAvatar,
    deleteAvatar,
  } = useProfile(true);

  const headerName = profile?.displayName ?? user.displayName;
  const headerAvatar = profile?.avatar ?? user.avatar;

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;

  return (
    <div style={shellStyle}>
      <header style={topbar}>
        <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <span style={brand}>
            <span style={brandMark} aria-hidden />
            <span>Eclipse Chat</span>
          </span>
          {activeServer && (
            <span style={breadcrumbStyle}>
              <span style={{ opacity: 0.5 }}>/</span>
              <span style={{ color: "var(--ec-text)", fontWeight: 500 }}>{activeServer.name}</span>
              {selectedChannel && (
                <>
                  <span style={{ opacity: 0.5 }}>/</span>
                  <span style={{ color: "var(--ec-text-muted)" }}>#{selectedChannel.name}</span>
                </>
              )}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)" }}>
          <span
            className={isReady ? "ec-dot ec-dot--online" : "ec-dot ec-dot--offline"}
            title={isReady ? "Подключено" : "Соединение разорвано"}
            aria-label={isReady ? "online" : "offline"}
          />
          <button
            type="button"
            onClick={() => setShowProfile(true)}
            title="Профиль"
            style={userChip}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--ec-surface-2)";
              e.currentTarget.style.borderColor = "var(--ec-border-default)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <Avatar url={headerAvatar} name={headerName} size={26} />
            <span>{headerName}</span>
          </button>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="ec-btn ec-btn--ghost ec-btn--sm"
          >
            Выйти
          </button>
        </div>
      </header>

      <ServerList
        servers={servers}
        activeServerId={activeServerId}
        onSelect={setActiveServerId}
        onCreateRequest={() => setShowCreateServer(true)}
        onJoinRequest={() => setShowJoinServer(true)}
      />

      <ChannelList
        serverName={activeServer?.name ?? null}
        serverRole={activeServer?.role ?? null}
        inviteCode={activeServer?.inviteCode ?? null}
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelect={setSelectedChannelId}
        onCreate={async (name) => {
          await createChannel(name);
        }}
        onShowServerInfo={() => activeServer && setShowServerInfo(true)}
      />

      <section style={chatColumn}>
        <div style={chatHeader}>
          {selectedChannel ? (
            <span style={chatTitle}>
              <span style={{ color: "var(--ec-accent)" }}>#</span>
              {selectedChannel.name}
            </span>
          ) : (
            <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
              {activeServer ? "Выберите канал слева" : "Нет активного сервера"}
            </span>
          )}
        </div>

        {(serversError || messagesError) && (
          <div style={errorBanner}>{serversError ?? messagesError}</div>
        )}

        {!activeServer ? (
          <div className="ec-empty">
            <div className="ec-empty-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M3 9h18M9 3v18" />
              </svg>
            </div>
            <div className="ec-empty-title">Нет активного сервера</div>
            <div className="ec-empty-hint">Создайте свой или вступите по инвайту — кнопки в левой колонке.</div>
            <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
              <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={() => setShowCreateServer(true)}>
                Создать сервер
              </button>
              <button type="button" className="ec-btn ec-btn--sm" onClick={() => setShowJoinServer(true)}>
                Вступить по инвайту
              </button>
            </div>
          </div>
        ) : !selectedChannelId ? (
          <div className="ec-empty">
            <div className="ec-empty-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </div>
            <div className="ec-empty-title">Выберите канал</div>
            <div className="ec-empty-hint">Каналы — слева. Или создайте новый внизу панели каналов.</div>
          </div>
        ) : (
          <>
            <MessageList
              messages={messages}
              emptyHint={messagesLoading ? "Загрузка…" : undefined}
              channelName={selectedChannel?.name ?? null}
            />
            <MessageInput
              channelName={selectedChannel?.name ?? null}
              disabled={!selectedChannelId || !isReady}
              onSend={sendMessage}
            />
          </>
        )}
      </section>

      {showCreateServer && (
        <CreateServerModal
          onClose={() => setShowCreateServer(false)}
          onCreate={async (name) => {
            const res = await createServer({ name });
            return res != null;
          }}
        />
      )}

      {showJoinServer && (
        <JoinServerModal
          onClose={() => setShowJoinServer(false)}
          onJoin={async (code) => {
            const res = await joinByInvite(code);
            return res ? { alreadyMember: res.alreadyMember } : null;
          }}
        />
      )}

      {showServerInfo && activeServer && (
        <ServerInfoModal
          server={activeServer}
          onClose={() => setShowServerInfo(false)}
          onLeave={() => leaveServer(activeServer.id)}
          onDelete={() => deleteServer(activeServer.id)}
        />
      )}

      {showProfile && profile && (
        <ProfileModal
          profile={profile}
          busy={profileBusy}
          error={profileError}
          onClose={() => setShowProfile(false)}
          onSave={updateProfile}
          onUploadAvatar={uploadAvatar}
          onDeleteAvatar={deleteAvatar}
        />
      )}
    </div>
  );
}
