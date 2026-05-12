import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import { ChannelList } from "../components/ChannelList";
import { CreateServerModal } from "../components/CreateServerModal";
import { JoinServerModal } from "../components/JoinServerModal";
import { MemberList } from "../components/MemberList";
import { MessageInput } from "../components/MessageInput";
import { MessageList } from "../components/MessageList";
import { PinnedBar } from "../components/PinnedBar";
import { ProfileModal } from "../components/ProfileModal";
import { SearchOverlay } from "../components/SearchOverlay";
import { ServerInfoModal } from "../components/ServerInfoModal";
import { ServerList } from "../components/ServerList";
import { TypingIndicator } from "../components/TypingIndicator";
import { VoicePlaceholder } from "../components/VoicePlaceholder";
import { useChannels } from "../hooks/useChannels";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMembers, type MemberRole } from "../hooks/useMembers";
import { useMessages } from "../hooks/useMessages";
import { useNotifications } from "../hooks/useNotifications";
import { useProfile } from "../hooks/useProfile";
import { useSearch } from "../hooks/useSearch";
import { useServers } from "../hooks/useServers";
import { useSocket } from "../hooks/useSocket";
import type { PublicUser } from "../hooks/useAuth";

type Props = {
  user: PublicUser;
  socketRev: number;
  onLogout: () => Promise<void>;
};

const topbar: CSSProperties = {
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
    deleteChannel,
    unread,
  } = useChannels(activeServerId, socket);

  // Total unread по всем каналам — для tab title badge
  const unreadTotal = Object.values(unread).reduce((sum, n) => sum + n, 0);
  // Ref для selected channel — useNotifications читает на каждый message:new
  const selectedChannelIdRef = useRef<string | null>(selectedChannelId);
  selectedChannelIdRef.current = selectedChannelId;
  const notif = useNotifications(socket, user.id, selectedChannelIdRef, unreadTotal);

  const {
    messages,
    sendMessage,
    retryMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    toggleReaction,
    typingUsers,
    emitTypingStart,
    emitTypingStop,
    error: messagesError,
    loading: messagesLoading,
  } = useMessages(selectedChannelId, socket, user.id);

  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showServerInfo, setShowServerInfo] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    loading: searchLoading,
    error: searchError,
    reset: searchReset,
  } = useSearch(activeServerId);

  // Ctrl/Cmd+K — открыть search overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key === "k" || e.key === "K" || e.key === "л" || e.key === "Л";
      if ((e.ctrlKey || e.metaKey) && isK) {
        if (!activeServer) return;
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeServer]);

  const {
    profile,
    busy: profileBusy,
    error: profileError,
    updateProfile,
    uploadAvatar,
    deleteAvatar,
  } = useProfile(true);

  const {
    members,
    loading: membersLoading,
    error: membersError,
  } = useMembers(activeServerId, socket);

  const headerName = profile?.displayName ?? user.displayName;
  const headerAvatar = profile?.avatar ?? user.avatar;
  const senderForMessages = {
    id: user.id,
    displayName: headerName,
    avatar: headerAvatar,
  };
  // Role текущего user'а на активном сервере — для перм-проверки UI (delete/pin)
  const currentRole = (activeServer?.role as MemberRole | undefined) ?? null;

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;

  const showMembers = Boolean(activeServer);
  const [navOpen, setNavOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTabletOrSmaller = useMediaQuery("(max-width: 1024px)");

  // Авто-закрытие drawer'ов при breakpoint upscale (например phone→desktop)
  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);
  useEffect(() => {
    if (!isTabletOrSmaller) setMembersOpen(false);
  }, [isTabletOrSmaller]);

  // На mobile: select channel → закрыть nav drawer (UX как в Discord/Telegram)
  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    if (isMobile) setNavOpen(false);
  };

  const shellClass =
    "ec-shell" +
    (showMembers ? " ec-shell--has-server" : "") +
    (navOpen ? " ec-shell--nav-open" : "") +
    (membersOpen ? " ec-shell--members-open" : "");

  return (
    <div className={shellClass}>
      <header className="ec-shell__top" style={topbar}>
        <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: "var(--ec-space-2)" }}>
          {isMobile && (
            <button
              type="button"
              className="ec-shell__drawer-btn ec-shell__drawer-btn--nav"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? "Закрыть навигацию" : "Открыть навигацию"}
              title="Серверы и каналы"
            >
              {navOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          )}
          <span style={brand}>
            <span className="ec-brand-mark" style={brandMark} aria-hidden />
            <span>Eclipse Chat</span>
          </span>
          {activeServer && (
            <span className="ec-shell__breadcrumb" style={breadcrumbStyle}>
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
          {showMembers && (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              title="Поиск (Ctrl+K)"
              aria-label="Поиск"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              style={{ padding: "0.35rem 0.65rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          )}
          {notif.supported && (
            <button
              type="button"
              onClick={() => {
                if (notif.permission === "default") void notif.request();
                else notif.toggle();
              }}
              title={
                notif.permission === "denied"
                  ? "Уведомления заблокированы в браузере"
                  : notif.permission === "default"
                  ? "Включить уведомления"
                  : notif.enabled
                  ? "Уведомления включены — выключить"
                  : "Уведомления выключены — включить"
              }
              aria-label="Уведомления"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              style={{
                padding: "0.35rem 0.65rem",
                color:
                  notif.permission === "granted" && notif.enabled
                    ? "var(--ec-accent)"
                    : "var(--ec-text-muted)",
                opacity: notif.permission === "denied" ? 0.45 : 1,
              }}
            >
              {notif.permission === "granted" && notif.enabled ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                  <path d="M18.63 13A17.89 17.89 0 0118 8" />
                  <path d="M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14" />
                  <path d="M18 8a6 6 0 00-9.33-5" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          )}
          {showMembers && (
            <button
              type="button"
              className="ec-shell__drawer-btn ec-shell__drawer-btn--members"
              onClick={() => setMembersOpen((v) => !v)}
              aria-label={membersOpen ? "Скрыть участников" : "Показать участников"}
              title="Участники"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </button>
          )}
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
            aria-label="Выйти"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span style={{ marginLeft: 4 }}>Выйти</span>
          </button>
        </div>
      </header>

      <div
        className="ec-shell__backdrop"
        onClick={() => {
          setNavOpen(false);
          setMembersOpen(false);
        }}
        aria-hidden
      />

      <div className="ec-shell__rail">
        <ServerList
          servers={servers}
          activeServerId={activeServerId}
          onSelect={(id) => {
            setActiveServerId(id);
            if (isMobile) setNavOpen(false);
          }}
          onCreateRequest={() => setShowCreateServer(true)}
          onJoinRequest={() => setShowJoinServer(true)}
        />
      </div>

      <div className="ec-shell__channels">
        <ChannelList
          serverName={activeServer?.name ?? null}
          serverRole={activeServer?.role ?? null}
          inviteCode={activeServer?.inviteCode ?? null}
          channels={channels}
          unread={unread}
          selectedChannelId={selectedChannelId}
          onSelect={handleSelectChannel}
          onCreate={async (name, type) => {
            await createChannel(name, type);
          }}
          onDelete={deleteChannel}
          onShowServerInfo={() => activeServer && setShowServerInfo(true)}
        />
      </div>

      <section className="ec-shell__chat" style={chatColumn}>
        <div style={chatHeader}>
          {selectedChannel ? (
            <span style={chatTitle}>
              {selectedChannel.type === "VOICE" ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "var(--ec-accent)" }}
                  aria-hidden
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                </svg>
              ) : (
                <span style={{ color: "var(--ec-accent)" }}>#</span>
              )}
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
        ) : !selectedChannelId || !selectedChannel ? (
          <div className="ec-empty">
            <div className="ec-empty-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </div>
            <div className="ec-empty-title">Выберите канал</div>
            <div className="ec-empty-hint">Каналы — слева. Или создайте новый внизу панели каналов.</div>
          </div>
        ) : selectedChannel.type === "VOICE" ? (
          <VoicePlaceholder channelName={selectedChannel.name} />
        ) : (
          <>
            <PinnedBar messages={messages} />
            <MessageList
              messages={messages}
              emptyHint={messagesLoading ? "Загрузка…" : undefined}
              channelName={selectedChannel.name}
              currentUserId={user.id}
              currentRole={currentRole}
              onRetry={(mid) => retryMessage(mid, senderForMessages)}
              onEdit={editMessage}
              onDelete={deleteMessage}
              onPin={pinMessage}
              onUnpin={unpinMessage}
              onToggleReaction={toggleReaction}
            />
            <TypingIndicator users={typingUsers} />
            <MessageInput
              channelName={selectedChannel.name}
              disabled={!isReady}
              onSend={(content, attachments) =>
                sendMessage(content, senderForMessages, attachments)
              }
              onTypingStart={emitTypingStart}
              onTypingStop={emitTypingStop}
            />
          </>
        )}
      </section>

      {showMembers && (
        <div className="ec-shell__members">
          <MemberList
            members={members}
            loading={membersLoading}
            error={membersError}
            onClose={isTabletOrSmaller ? () => setMembersOpen(false) : undefined}
          />
        </div>
      )}

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

      {showSearch && activeServerId && (
        <SearchOverlay
          query={searchQuery}
          setQuery={setSearchQuery}
          results={searchResults}
          loading={searchLoading}
          error={searchError}
          onSelect={(hit) => {
            // Переключаемся на канал hit + закрываем overlay
            setSelectedChannelId(hit.channel.id);
            setShowSearch(false);
            // На mobile drawer должен открыться/закрыться — channel drawer закрыт уже
            searchReset();
          }}
          onClose={() => {
            setShowSearch(false);
            searchReset();
          }}
        />
      )}
    </div>
  );
}
