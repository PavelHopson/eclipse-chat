import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { ActionQueueBar } from "../components/ActionQueueBar";
import { ChannelDigestPanel } from "../components/ChannelDigestPanel";
import { Avatar } from "../components/Avatar";
import { ChannelList } from "../components/ChannelList";
import { ChannelSettingsModal } from "../components/ChannelSettingsModal";
import { RichContent } from "../components/RichContent";
import { CreateServerModal } from "../components/CreateServerModal";
import { DirectConversationList } from "../components/DirectConversationList";
import { JoinServerModal } from "../components/JoinServerModal";
import { MemberList } from "../components/MemberList";
import { MessageInput } from "../components/MessageInput";
import { MessageList } from "../components/MessageList";
import { PinnedBar } from "../components/PinnedBar";
import { ProfileModal } from "../components/ProfileModal";
import { SearchOverlay } from "../components/SearchOverlay";
import { ServerInfoModal } from "../components/ServerInfoModal";
import { ServerSettingsModal } from "../components/ServerSettingsModal";
import { ServerList } from "../components/ServerList";
import { StatusMenu } from "../components/StatusMenu";
import { IncidentPanel } from "../components/IncidentPanel";
import { ThreadPanel } from "../components/ThreadPanel";
import { TypingIndicator } from "../components/TypingIndicator";
import { VoiceMiniBar } from "../components/VoiceMiniBar";
import { VoicePlaceholder } from "../components/VoicePlaceholder";
import { VoiceRoom } from "../components/VoiceRoom";
import { useChannelDigest } from "../hooks/useChannelDigest";
import { useChannels } from "../hooks/useChannels";
import { useDirectConversations } from "../hooks/useDirectConversations";
import { useDirectMessages } from "../hooks/useDirectMessages";
import { useIncidents } from "../hooks/useIncidents";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMembers, type MemberRole, type MemberRow } from "../hooks/useMembers";
import { useMessages } from "../hooks/useMessages";
import { useNotifications } from "../hooks/useNotifications";
import { useProfile } from "../hooks/useProfile";
import { useSearch } from "../hooks/useSearch";
import { useServers } from "../hooks/useServers";
import { useSocket } from "../hooks/useSocket";
import { useVoice } from "../hooks/useVoice";
import { useVoiceHealth } from "../hooks/useVoiceHealth";
import { useVoicePresence, reverseVoiceMap } from "../hooks/useVoicePresence";
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
  padding: "0.28rem 0.58rem 0.28rem 0.32rem",
  border: "1px solid transparent",
  borderRadius: "var(--ec-radius-full)",
  background: "transparent",
  fontSize: "var(--ec-text-sm)",
  fontWeight: 600,
  letterSpacing: "var(--ec-tracking-tight)",
  color: "var(--ec-text-strong)",
  cursor: "pointer",
};

const brandMark: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  position: "relative",
  overflow: "hidden",
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

function HomePanel({
  userName,
  serversCount,
  dmCount,
  unreadTotal,
  activeServerName,
  onOpenServer,
  onOpenDms,
  onCreateServer,
  onJoinServer,
}: {
  userName: string;
  serversCount: number;
  dmCount: number;
  unreadTotal: number;
  activeServerName: string | null;
  onOpenServer: () => void;
  onOpenDms: () => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
}) {
  return (
    <div className="ec-home">
      <section className="ec-home__hero">
        <span className="ec-brand-mark ec-home__mark" aria-hidden />
        <div className="ec-home__copy">
          <span className="ec-home__eyebrow">Главная Eclipse Chat</span>
          <h2>Центр связи, голосовых сессий и рабочих действий.</h2>
          <p>
            {userName}, отсюда можно быстро вернуться в сервер, открыть личные сообщения
            или запустить новый контур команды.
          </p>
        </div>
      </section>

      <div className="ec-home__stats" aria-label="Сводка">
        <div>
          <strong>{serversCount}</strong>
          <span>серверов</span>
        </div>
        <div>
          <strong>{dmCount}</strong>
          <span>диалогов</span>
        </div>
        <div>
          <strong>{unreadTotal}</strong>
          <span>непрочитано</span>
        </div>
      </div>

      <div className="ec-home__actions">
        <button type="button" className="ec-home-card is-primary" onClick={onOpenServer}>
          <span className="ec-home-card__icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="4" />
              <path d="M8 9h8M8 13h5M8 17h7" />
            </svg>
          </span>
          <span>
            <strong>{activeServerName ? `Открыть ${activeServerName}` : "Открыть сервер"}</strong>
            <small>Вернуться в рабочие каналы и сообщения.</small>
          </span>
        </button>

        <button type="button" className="ec-home-card" onClick={onOpenDms}>
          <span className="ec-home-card__icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 9h8M8 13h5" />
            </svg>
          </span>
          <span>
            <strong>Личные сообщения</strong>
            <small>Открыть DM-контур и быстрые диалоги.</small>
          </span>
        </button>

        <button type="button" className="ec-home-card" onClick={onCreateServer}>
          <span className="ec-home-card__icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span>
            <strong>Создать сервер</strong>
            <small>Собрать новый workspace под команду или проект.</small>
          </span>
        </button>

        <button type="button" className="ec-home-card" onClick={onJoinServer}>
          <span className="ec-home-card__icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93" />
              <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.1a5 5 0 0 0 7.07 7.07L13 19.07" />
            </svg>
          </span>
          <span>
            <strong>Вступить по инвайту</strong>
            <small>Подключиться к существующему контуру.</small>
          </span>
        </button>
      </div>
    </div>
  );
}

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
    uploadServerIcon,
    deleteServerIcon,
    uploadServerBanner,
    deleteServerBanner,
    updateServerIdentity,
    error: serversError,
  } = useServers(true);

  /**
   * Per-server brand-color injection.
   * Когда активен сервер с `brandColor` (HSL "200 80% 60%") — инжектим
   * `:root { --ec-accent: hsl(X) }` через document.documentElement.style.
   * Cleanup при unmount/change на default tokens.css value.
   */
  useEffect(() => {
    const c = activeServer?.brandColor;
    const root = document.documentElement;
    if (c && /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(c.trim())) {
      const hsl = c.trim();
      root.style.setProperty("--ec-accent", `hsl(${hsl})`);
      // hover чуть светлее (+6% lightness — best-effort regex)
      const m = hsl.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
      if (m) {
        const h = Number(m[1]);
        const s = Number(m[2]);
        const l = Math.min(95, Number(m[3]) + 6);
        root.style.setProperty("--ec-accent-hover", `hsl(${h} ${s}% ${l}%)`);
        root.style.setProperty(
          "--ec-accent-soft",
          `hsl(${h} ${s}% ${m[3]}% / 0.14)`,
        );
        root.style.setProperty(
          "--ec-border-accent",
          `hsl(${h} ${s}% ${m[3]}% / 0.55)`,
        );
        root.style.setProperty(
          "--ec-accent-glow",
          `0 0 0 1px hsl(${h} ${s}% ${m[3]}% / 0.45), 0 0 22px -2px hsl(${h} ${s}% ${m[3]}% / 0.42)`,
        );
      }
    } else {
      root.style.removeProperty("--ec-accent");
      root.style.removeProperty("--ec-accent-hover");
      root.style.removeProperty("--ec-accent-soft");
      root.style.removeProperty("--ec-border-accent");
      root.style.removeProperty("--ec-accent-glow");
    }
    return () => {
      root.style.removeProperty("--ec-accent");
      root.style.removeProperty("--ec-accent-hover");
      root.style.removeProperty("--ec-accent-soft");
      root.style.removeProperty("--ec-border-accent");
      root.style.removeProperty("--ec-accent-glow");
    };
  }, [activeServer?.brandColor]);

  const {
    channels,
    selectedChannelId,
    setSelectedChannelId,
    createChannel,
    updateChannel,
    reorderChannels,
    deleteChannel,
    unread,
  } = useChannels(activeServerId, socket);

  // ===== Channel digest =====
  // Открытые задачи / решения / follow-ups / pinned — компактная сводка канала.
  // Auto-fetch при смене канала + manual refresh из ChannelDigestPanel.
  const {
    digest: channelDigest,
    loading: digestLoading,
    error: digestError,
    refresh: refreshDigest,
    aiSummary: digestAiSummary,
    aiLoading: digestAiLoading,
    aiError: digestAiError,
    requestAiSummary: requestDigestAiSummary,
  } = useChannelDigest(selectedChannelId, socket);

  // ===== DMs =====
  // DM-mode активируется когда activeServerId === null (после клика «📩 DMs»
  // в ServerList). Список конверсаций + текущий выбранный + open-or-create.
  const {
    conversations: dmConversations,
    loading: dmLoading,
    error: dmError,
    selectedDmId,
    selectDm,
    openDmWith,
  } = useDirectConversations(socket, user.id);
  const inDmMode = activeServerId === null;
  const selectedDm = dmConversations.find((c) => c.id === selectedDmId) ?? null;
  const {
    messages: dmMessages,
    loading: dmMessagesLoading,
    error: dmMessagesError,
    sendMessage: dmSend,
    retryMessage: dmRetry,
    editMessage: dmEdit,
    deleteMessage: dmDelete,
    toggleReaction: dmToggleReaction,
  } = useDirectMessages(inDmMode ? selectedDmId : null, socket, user.id);

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
    createActionItem,
    updateActionItem,
    updateActionItemStatus,
    typingUsers,
    emitTypingStart,
    emitTypingStop,
    error: messagesError,
    loading: messagesLoading,
    openActionItems,
  } = useMessages(selectedChannelId, socket, user.id);

  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showServerInfo, setShowServerInfo] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  // Incident panel — toggle в right rail (приоритет ниже thread panel).
  const [showIncidents, setShowIncidents] = useState(false);
  // Thread panel — открыт когда selectedThreadId != null. Replaces MemberList
  // в right rail. Close → возвращается MemberList.
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  // Channel settings modal — id канала, который сейчас редактируется.
  const [settingsChannelId, setSettingsChannelId] = useState<string | null>(null);

  // Закрыть thread при смене канала / сервера — не показывать thread из старого канала
  useEffect(() => {
    setSelectedThreadId(null);
  }, [selectedChannelId, activeServerId]);

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
    updateStatus,
    reload: reloadProfile,
  } = useProfile(true);
  const [statusAnchor, setStatusAnchor] = useState<DOMRect | null>(null);

  const {
    members,
    loading: membersLoading,
    error: membersError,
    updateMemberRole,
  } = useMembers(activeServerId, socket);

  // ===== Incidents =====
  // Список инцидентов сервера + open/resolve. IncidentPanel в right rail.
  const { openCount: incidentOpenCount } = useIncidents(activeServerId, socket);

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

  // VOICE-канал: VoiceRoom сам рендерит участников эфира, отдельная правая
  // панель (MemberList) была дублем — для voice-режима её скрываем.
  const isVoiceView =
    !inDmMode && !homeOpen && selectedChannel?.type === "VOICE";
  const inServerView = Boolean(activeServer) && !homeOpen;
  const showMembers = inServerView && !isVoiceView;
  const [navOpen, setNavOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTabletOrSmaller = useMediaQuery("(max-width: 1024px)");
  const voiceHealth = useVoiceHealth();
  const { byChannel: voiceByChannel, metaByUser: voiceMetaByUser } =
    useVoicePresence(socket);
  const voiceChannelByUser = reverseVoiceMap(voiceByChannel);
  // Voice state lifted в AppShell — persistent across channel switches, доступен sidebar'у.
  const voice = useVoice(socket);
  // Speaking userIds — derived из voice.participants (live LiveKit ActiveSpeakers).
  const speakingUserIds = new Set(
    voice.participants.filter((p) => p.isSpeaking && !p.isMicMuted).map((p) => p.identity),
  );
  const activeVoiceChannelName =
    voice.activeChannelId != null
      ? channels.find((c) => c.id === voice.activeChannelId)?.name ?? null
      : null;
  const selectedVoiceOccupants =
    selectedChannel?.type === "VOICE"
      ? (voiceByChannel[selectedChannel.id] ?? [])
          .map((userId) => members.find((member) => member.userId === userId))
          .filter((member): member is MemberRow => Boolean(member))
      : [];
  // Лукап name канала по id — для tooltip в MemberList «в голосовом «X»»
  const channelNameById = (cid: string): string | undefined =>
    channels.find((c) => c.id === cid)?.name;

  // Авто-закрытие drawer'ов при breakpoint upscale (например phone→desktop)
  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);
  useEffect(() => {
    if (!isTabletOrSmaller) setMembersOpen(false);
  }, [isTabletOrSmaller]);

  // На mobile: select channel → закрыть nav drawer (UX как в Discord/Telegram)
  const handleSelectChannel = (channelId: string) => {
    setHomeOpen(false);
    setSelectedChannelId(channelId);
    if (isMobile) setNavOpen(false);
  };

  const openHome = () => {
    setHomeOpen(true);
    setSelectedChannelId(null);
    selectDm(null);
    setNavOpen(false);
    setMembersOpen(false);
  };

  const openActiveServer = () => {
    setHomeOpen(false);
    if (activeServerId == null && servers[0]) {
      setActiveServerId(servers[0].id);
      return;
    }
    const firstChannelId = channels.find((c) => c.type === "TEXT")?.id ?? channels[0]?.id ?? null;
    if (firstChannelId) {
      setSelectedChannelId(firstChannelId);
    }
  };

  const shellClass =
    "ec-shell" +
    (showMembers ? " ec-shell--has-server" : "") +
    (navOpen ? " ec-shell--nav-open" : "") +
    (membersOpen ? " ec-shell--members-open" : "");

  return (
    <div className={shellClass}>
      <header className="ec-shell__top" style={topbar}>
        <div className="ec-shell__top-left" style={{ display: "flex", alignItems: "center", minWidth: 0, gap: "var(--ec-space-2)" }}>
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
          <button
            type="button"
            className="ec-shell__brand-home"
            style={brand}
            onClick={openHome}
            aria-label="Открыть главную страницу"
            title="Главная"
          >
            <span className="ec-brand-mark" style={brandMark} aria-hidden />
            <span className="ec-shell__brand-title">Eclipse Chat</span>
          </button>
          {homeOpen ? (
            <span className="ec-shell__breadcrumb" style={breadcrumbStyle}>
              <span style={{ opacity: 0.5 }}>/</span>
              <span style={{ color: "var(--ec-text)", fontWeight: 500 }}>Главная</span>
            </span>
          ) : activeServer && (
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
        <div className="ec-shell__top-actions" style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)" }}>
          <span
            className={isReady ? "ec-dot ec-dot--online" : "ec-dot ec-dot--offline"}
            title={isReady ? "Подключено" : "Соединение разорвано"}
            aria-label={isReady ? "online" : "offline"}
          />
          {inServerView && (
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
          {showMembers && (
            <button
              type="button"
              onClick={() => {
                setShowIncidents((v) => !v);
                setSelectedThreadId(null);
                if (isTabletOrSmaller) setMembersOpen(true);
              }}
              title={
                incidentOpenCount > 0
                  ? `Инциденты — ${incidentOpenCount} активных`
                  : "Инциденты"
              }
              aria-label="Инциденты"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              style={{
                padding: "0.35rem 0.65rem",
                position: "relative",
                color: incidentOpenCount > 0 ? "var(--ec-danger)" : undefined,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {incidentOpenCount > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 14,
                    height: 14,
                    padding: "0 3px",
                    borderRadius: "var(--ec-radius-full)",
                    background: "var(--ec-danger)",
                    color: "#fff",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                    lineHeight: 1,
                  }}
                >
                  {incidentOpenCount > 9 ? "9+" : incidentOpenCount}
                </span>
              )}
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
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setStatusAnchor(rect);
            }}
            title="Статус и профиль"
            className="ec-shell__user-chip"
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
            <span style={{ position: "relative", display: "inline-block" }}>
              <Avatar url={headerAvatar} name={headerName} size={26} />
              {/* presence dot на собственном avatar */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: -1,
                  right: -1,
                  width: 9,
                  height: 9,
                  borderRadius: "var(--ec-radius-full)",
                  border: "2px solid var(--ec-surface-1)",
                  background:
                    profile?.status === "INVISIBLE"
                      ? "var(--ec-presence-offline)"
                      : profile?.status === "IDLE"
                      ? "var(--ec-presence-idle)"
                      : profile?.status === "DND"
                      ? "var(--ec-presence-dnd)"
                      : "var(--ec-presence-online)",
                }}
              />
            </span>
            <span className="ec-shell__user-name">{headerName}</span>
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
            <span className="ec-shell__logout-label" style={{ marginLeft: 4 }}>Выйти</span>
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
            setHomeOpen(false);
            setActiveServerId(id);
            if (isMobile) setNavOpen(false);
          }}
          onCreateRequest={() => setShowCreateServer(true)}
          onJoinRequest={() => setShowJoinServer(true)}
          dmsActive={inDmMode}
          dmsUnread={dmConversations.reduce((sum, c) => sum + c.unread, 0)}
          onDmsRequest={() => {
            setHomeOpen(false);
            setActiveServerId(null);
            if (isMobile) setNavOpen(false);
          }}
        />
      </div>

      <div className="ec-shell__channels">
        {inDmMode ? (
          <DirectConversationList
            conversations={dmConversations}
            loading={dmLoading}
            error={dmError}
            selectedDmId={selectedDmId}
            onSelect={(id) => {
              setHomeOpen(false);
              selectDm(id);
              if (isMobile) setNavOpen(false);
            }}
            onlineUserIds={new Set(members.filter((m) => m.online).map((m) => m.userId))}
          />
        ) : (
          <ChannelList
            serverName={activeServer?.name ?? null}
            serverRole={activeServer?.role ?? null}
            inviteCode={activeServer?.inviteCode ?? null}
            channels={channels}
            unread={unread}
            selectedChannelId={selectedChannelId}
            onSelect={handleSelectChannel}
            onCreate={async (name, type) => {
              setHomeOpen(false);
              await createChannel(name, type);
            }}
            onDelete={deleteChannel}
            onOpenSettings={(channelId) => setSettingsChannelId(channelId)}
            onReorder={reorderChannels}
            onShowServerInfo={() => activeServer && setShowServerInfo(true)}
            voiceByChannel={voiceByChannel}
            voiceMetaByUser={voiceMetaByUser}
            members={members}
            speakingUserIds={speakingUserIds}
            myVoiceChannelId={voice.activeChannelId}
          />
        )}
      </div>

      <section className="ec-shell__chat" style={chatColumn}>
        <div className="ec-chat-header" style={chatHeader}>
          {homeOpen ? (
            <span className="ec-chat-title" style={chatTitle}>
              <span className="ec-brand-mark" style={{ ...brandMark, width: 18, height: 18 }} aria-hidden />
              Главная
            </span>
          ) : inDmMode && selectedDm ? (
            <span className="ec-chat-title" style={chatTitle}>
              <Avatar url={selectedDm.other.avatar} name={selectedDm.other.displayName} size={22} />
              {selectedDm.other.displayName}
            </span>
          ) : inDmMode ? (
            <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
              Выберите диалог
            </span>
          ) : selectedChannel ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ec-space-3)",
                minWidth: 0,
                flex: 1,
              }}
            >
              <span className="ec-chat-title" style={chatTitle}>
                {selectedChannel.emoji ? (
                  <span style={{ fontSize: "1rem", lineHeight: 1 }}>{selectedChannel.emoji}</span>
                ) : selectedChannel.type === "VOICE" ? (
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
              {selectedChannel.description && (
                <>
                  <span
                    aria-hidden
                    style={{
                      width: 1,
                      height: 18,
                      background: "var(--ec-border-default)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "var(--ec-text-2xs)",
                      color: "var(--ec-text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      minWidth: 0,
                      flex: 1,
                    }}
                    title={selectedChannel.description}
                  >
                    <RichContent
                      content={selectedChannel.description}
                      mentionNames={members.map((m) => m.user.displayName)}
                      currentUserName={headerName}
                    />
                  </span>
                </>
              )}
              {(activeServer?.role === "OWNER" ||
                activeServer?.role === "ADMIN" ||
                activeServer?.role === "MODERATOR") && (
                <button
                  type="button"
                  onClick={() => setSettingsChannelId(selectedChannel.id)}
                  aria-label="Настройки канала"
                  title="Настройки канала"
                  style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    display: "grid",
                    placeItems: "center",
                    background: "transparent",
                    border: 0,
                    borderRadius: "var(--ec-radius-sm)",
                    color: "var(--ec-text-dim)",
                    cursor: "pointer",
                    transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--ec-surface-2)";
                    e.currentTarget.style.color = "var(--ec-text)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--ec-text-dim)";
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
              {activeServer ? "Выберите канал слева" : "Нет активного сервера"}
            </span>
          )}
        </div>

        {(serversError || messagesError || dmError || dmMessagesError) && (
          <div style={errorBanner}>
            {serversError ?? messagesError ?? dmError ?? dmMessagesError}
          </div>
        )}

        {homeOpen ? (
          <HomePanel
            userName={headerName}
            serversCount={servers.length}
            dmCount={dmConversations.length}
            unreadTotal={unreadTotal}
            activeServerName={activeServer?.name ?? servers[0]?.name ?? null}
            onOpenServer={openActiveServer}
            onOpenDms={() => {
              setHomeOpen(false);
              setActiveServerId(null);
              selectDm(null);
            }}
            onCreateServer={() => setShowCreateServer(true)}
            onJoinServer={() => setShowJoinServer(true)}
          />
        ) : inDmMode ? (
          !selectedDm ? (
            <div className="ec-empty">
              <div className="ec-empty-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <div className="ec-empty-title">Личные сообщения</div>
              <div className="ec-empty-hint">
                Выбери диалог слева или открой профиль участника любого сервера и нажми «Написать в личку».
              </div>
            </div>
          ) : (
            <>
              <MessageList
                messages={dmMessages}
                emptyHint={dmMessagesLoading ? "Загрузка…" : "Это начало вашего диалога. Напиши первое сообщение."}
                channelName={selectedDm.other.displayName}
                currentUserId={user.id}
                currentUserName={headerName}
                currentRole={null}
                mentionNames={[selectedDm.other.displayName]}
                onRetry={(mid) => dmRetry(mid, senderForMessages)}
                onEdit={dmEdit}
                onDelete={dmDelete}
                onPin={async () => false}
                onUnpin={async () => false}
                onToggleReaction={dmToggleReaction}
              />
              <MessageInput
                channelName={selectedDm.other.displayName}
                disabled={!isReady}
                onSend={(content, attachments) => dmSend(content, senderForMessages, attachments)}
                onTypingStart={() => undefined}
                onTypingStop={() => undefined}
              />
            </>
          )
        ) : !activeServer ? (
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
          voiceHealth.enabled ? (
            <VoiceRoom
              channelId={selectedChannel.id}
              channelName={selectedChannel.name}
              members={members}
              occupants={selectedVoiceOccupants}
              activeVoiceChannelName={activeVoiceChannelName}
              voice={voice}
            />
          ) : (
            <VoicePlaceholder channelName={selectedChannel.name} />
          )
        ) : (
          <>
            {/* Voice mini-bar — если ты сейчас в voice, но смотришь TEXT канал */}
            {voice.activeChannelId &&
              voice.activeChannelId !== selectedChannelId &&
              (voice.state === "connected" || voice.state === "reconnecting") && (
                <VoiceMiniBar
                  voice={voice}
                  channelName={
                    channels.find((c) => c.id === voice.activeChannelId)?.name ?? "канал"
                  }
                  onOpenVoiceChannel={() => {
                    if (voice.activeChannelId) {
                      setSelectedChannelId(voice.activeChannelId);
                    }
                  }}
                />
              )}
            <ActionQueueBar
              items={openActionItems}
              currentUserId={user.id}
              members={members}
              onUpdateAction={updateActionItem}
            />
            <div style={{ padding: "var(--ec-space-2) var(--ec-space-5)" }}>
              <ChannelDigestPanel
                digest={channelDigest}
                loading={digestLoading}
                error={digestError}
                onRefresh={() => void refreshDigest()}
                compact={isMobile}
                aiSummary={digestAiSummary}
                aiLoading={digestAiLoading}
                aiError={digestAiError}
                onRequestAiSummary={() => void requestDigestAiSummary(7)}
              />
            </div>
            <PinnedBar messages={messages} />
            <MessageList
              messages={messages}
              emptyHint={messagesLoading ? "Загрузка…" : undefined}
              channelName={selectedChannel.name}
              currentUserId={user.id}
              currentUserName={headerName}
              currentRole={currentRole}
              mentionNames={members.map((m) => m.user.displayName)}
              onRetry={(mid) => retryMessage(mid, senderForMessages)}
              onEdit={editMessage}
              onDelete={deleteMessage}
              onPin={pinMessage}
              onUnpin={unpinMessage}
              onToggleReaction={toggleReaction}
              onCreateAction={createActionItem}
              onToggleActionStatus={updateActionItemStatus}
              onOpenThread={(messageId) => {
                setSelectedThreadId(messageId);
                if (isTabletOrSmaller) setMembersOpen(true);
              }}
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
          {selectedThreadId ? (
            <ThreadPanel
              rootId={selectedThreadId}
              socket={socket}
              currentUser={user}
              currentUserName={headerName}
              currentUserAvatar={headerAvatar}
              mentionNames={members.map((m) => m.user.displayName)}
              onClose={() => setSelectedThreadId(null)}
            />
          ) : showIncidents && activeServerId ? (
            <IncidentPanel
              serverId={activeServerId}
              socket={socket}
              currentUserId={user.id}
              currentRole={currentRole}
              onOpenChannel={(channelId) => {
                setHomeOpen(false);
                setSelectedChannelId(channelId);
                setShowIncidents(false);
                if (isMobile) setNavOpen(false);
              }}
              onClose={() => setShowIncidents(false)}
            />
          ) : (
            <MemberList
              members={members}
              loading={membersLoading}
              error={membersError}
              onClose={isTabletOrSmaller ? () => setMembersOpen(false) : undefined}
              voiceChannelByUser={voiceChannelByUser}
              channelNameById={channelNameById}
              currentUserId={user.id}
              onOpenDm={(otherId) => {
                void openDmWith(otherId).then((convoId) => {
                  if (convoId) {
                    // Переключаемся в DM mode
                    setActiveServerId(null);
                    // selectDm уже вызван внутри openDmWith
                    if (isTabletOrSmaller) setMembersOpen(false);
                  }
                });
              }}
            />
          )}
        </div>
      )}

      {showCreateServer && (
        <CreateServerModal
          onClose={() => setShowCreateServer(false)}
          onCreate={async (name) => {
            setHomeOpen(false);
            const res = await createServer({ name });
            return res != null;
          }}
        />
      )}

      {showJoinServer && (
        <JoinServerModal
          onClose={() => setShowJoinServer(false)}
          onJoin={async (code) => {
            setHomeOpen(false);
            const res = await joinByInvite(code);
            return res ? { alreadyMember: res.alreadyMember } : null;
          }}
        />
      )}

      {showServerInfo && activeServer && (
        <ServerInfoModal
          server={activeServer}
          members={members}
          currentUserId={user.id}
          onClose={() => setShowServerInfo(false)}
          onLeave={() => leaveServer(activeServer.id)}
          onDelete={() => deleteServer(activeServer.id)}
          onUploadIcon={(file) => uploadServerIcon(activeServer.id, file)}
          onDeleteIcon={() => deleteServerIcon(activeServer.id)}
          onUpdateRole={updateMemberRole}
          onOpenSettings={
            activeServer.role === "OWNER"
              ? () => {
                  setShowServerInfo(false);
                  setShowServerSettings(true);
                }
              : undefined
          }
        />
      )}

      {showServerSettings && activeServer && activeServer.role === "OWNER" && (
        <ServerSettingsModal
          server={activeServer}
          onClose={() => setShowServerSettings(false)}
          onUploadBanner={(file) => uploadServerBanner(activeServer.id, file)}
          onDeleteBanner={() => deleteServerBanner(activeServer.id)}
          onUpdateIdentity={(patch) => updateServerIdentity(activeServer.id, patch)}
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
          onTwoFactorChanged={() => {
            // Refresh profile чтобы twoFactorEnabled flag обновился.
            void reloadProfile?.();
          }}
        />
      )}

      {statusAnchor && profile && (
        <StatusMenu
          anchorRect={statusAnchor}
          current={profile.status ?? "ONLINE"}
          onSelect={(s) => void updateStatus(s)}
          onOpenProfile={() => setShowProfile(true)}
          onClose={() => setStatusAnchor(null)}
        />
      )}

      {settingsChannelId && (() => {
        const ch = channels.find((c) => c.id === settingsChannelId);
        if (!ch) return null;
        return (
          <ChannelSettingsModal
            channel={ch}
            onClose={() => setSettingsChannelId(null)}
            onUpdate={(patch) => updateChannel(ch.id, patch)}
          />
        );
      })()}

      {showSearch && activeServerId && (
        <SearchOverlay
          query={searchQuery}
          setQuery={setSearchQuery}
          results={searchResults}
          loading={searchLoading}
          error={searchError}
            onSelect={(hit) => {
              // Переключаемся на канал hit + закрываем overlay
              setHomeOpen(false);
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
