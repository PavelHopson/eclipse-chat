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
  gridTemplateColumns: "auto auto 1fr",
  gridTemplateRows: "auto 1fr",
  height: "100vh",
  background: "#0f0f12",
  color: "#e8e8ed",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const topbar: CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  background: "#0a0a0c",
  borderBottom: "1px solid #1c1c22",
  gap: 12,
};

const chatColumn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  background: "#0f0f12",
};

const chatHeader: CSSProperties = {
  padding: "12px 18px",
  borderBottom: "1px solid #1c1c22",
  background: "#13131a",
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

  /** Текущий аватар + имя для header'а: пока профиль не подтянулся — fallback на user из auth. */
  const headerName = profile?.displayName ?? user.displayName;
  const headerAvatar = profile?.avatar ?? user.avatar;

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;

  return (
    <div style={shellStyle}>
      <header style={topbar}>
        <strong style={{ fontSize: "0.95rem" }}>Eclipse Chat</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => setShowProfile(true)}
            title="Профиль"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0.25rem 0.5rem",
              background: "transparent",
              color: "#c8c8d0",
              border: "1px solid transparent",
              borderRadius: 999,
              cursor: "pointer",
              fontSize: "0.85rem",
              opacity: 0.85,
            }}
          >
            <Avatar url={headerAvatar} name={headerName} size={24} />
            <span>
              {headerName} {!isReady && <span style={{ color: "#f88" }}>· offline</span>}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void onLogout()}
            style={{
              padding: "0.4rem 0.7rem",
              background: "transparent",
              color: "#c8c8d0",
              border: "1px solid #2a2a32",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
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
            <strong>
              <span style={{ opacity: 0.5, marginRight: 6 }}>#</span>
              {selectedChannel.name}
            </strong>
          ) : (
            <span style={{ opacity: 0.6 }}>
              {activeServer ? "Выберите канал слева" : "Нет активного сервера. Создайте или вступите по инвайту."}
            </span>
          )}
        </div>

        {(serversError || messagesError) && (
          <div style={{ padding: "8px 18px", color: "#f88", fontSize: "0.85rem", borderBottom: "1px solid #2a1a1a" }}>
            {serversError ?? messagesError}
          </div>
        )}

        <MessageList
          messages={messages}
          emptyHint={messagesLoading ? "Загрузка…" : "Сообщений ещё нет — будьте первым"}
        />

        <MessageInput
          channelName={selectedChannel?.name ?? null}
          disabled={!selectedChannelId || !isReady}
          onSend={sendMessage}
        />
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
