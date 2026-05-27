import { lazy, Suspense, useEffect, useRef, useState } from "react";
// v1.5.28 — Bundle split phase 3: heavy product CSS (components/responsive/
// player/cockpit, ~287KB) подгружается вместе с AppShell chunk'ом, а не в
// critical index.css. Visitor на landing'е загружает только ~180KB shared
// (fonts + tokens + reset + effects + motion).
import "../styles/app.css";
import { Avatar } from "../components/Avatar";
import { ChannelList } from "../components/ChannelList";
import { RichContent } from "../components/RichContent";
import { DirectConversationList } from "../components/DirectConversationList";
import { type AvailableUser } from "../components/CreateGroupDmModal";
import { GroupAvatar } from "../components/GroupAvatar";
import { HomeToday } from "../components/HomeToday";
import { IntelligencePanel } from "../components/IntelligencePanel";
import { ChannelInfoPanel } from "../components/ChannelInfoPanel";
import { ChatHeaderHoverButton } from "../components/ChatHeaderHoverButton";
import { LogoutButton } from "../components/LogoutButton";
import { ChannelGlyph } from "../components/icons/ChannelCustomIcons";
import { useOperationalTables } from "../hooks/useOperationalTables";
import { MusicMiniPlayer } from "../components/MusicMiniPlayer";
import { useChannelMusic } from "../hooks/useChannelMusic";
import { useServerAudioLibrary } from "../hooks/useServerAudioLibrary";
import { MessageInput } from "../components/MessageInput";
import { MessageList } from "../components/MessageList";

// v1.5.27 — Bundle split: heavy panels + modals → lazy chunks.
// Каждое из перечисленных рендерится conditionally (флаги open / выбор канала /
// selectedId). До v1.5.27 они все жили в AppShell.js (790 KB) — увеличивали
// первый paint даже когда юзер их никогда не открывал. Теперь Vite splits
// каждый в свой chunk + загружает только при mount'е. Inner Suspense
// fallback={null} — не показывает loading state (модалки/панели mount по
// клику, brief ms-задержка приемлема). Outer Suspense у App.tsx стоял до
// v1.5.27, но без inner boundaries он триггерил "Загрузка…" для всего
// AppShell при первом открытии модалки.
const HelpPanel = lazy(() => import("../components/HelpPanel").then((m) => ({ default: m.HelpPanel })));
const AdminPanel = lazy(() => import("../components/AdminPanel").then((m) => ({ default: m.AdminPanel })));
const OperationalTablePanel = lazy(() => import("../components/OperationalTablePanel").then((m) => ({ default: m.OperationalTablePanel })));
const StatusBoard = lazy(() => import("../components/StatusBoard").then((m) => ({ default: m.StatusBoard })));
const TeamHealth = lazy(() => import("../components/TeamHealth").then((m) => ({ default: m.TeamHealth })));
const VoiceRoom = lazy(() => import("../components/VoiceRoom").then((m) => ({ default: m.VoiceRoom })));
const ThreadPanel = lazy(() => import("../components/ThreadPanel").then((m) => ({ default: m.ThreadPanel })));
const IncidentPanel = lazy(() => import("../components/IncidentPanel").then((m) => ({ default: m.IncidentPanel })));
const ActionItemDrawer = lazy(() => import("../components/ActionItemDrawer").then((m) => ({ default: m.ActionItemDrawer })));
const SearchOverlay = lazy(() => import("../components/SearchOverlay").then((m) => ({ default: m.SearchOverlay })));
const PlatformAdminPanel = lazy(() => import("../components/PlatformAdminPanel").then((m) => ({ default: m.PlatformAdminPanel })));
const ServerHubModal = lazy(() => import("../components/ServerHubModal").then((m) => ({ default: m.ServerHubModal })));
const ChannelSettingsModal = lazy(() => import("../components/ChannelSettingsModal").then((m) => ({ default: m.ChannelSettingsModal })));
const ProfileModal = lazy(() => import("../components/ProfileModal").then((m) => ({ default: m.ProfileModal })));
const CreateServerModal = lazy(() => import("../components/CreateServerModal").then((m) => ({ default: m.CreateServerModal })));
const JoinServerModal = lazy(() => import("../components/JoinServerModal").then((m) => ({ default: m.JoinServerModal })));
const CreateGroupDmModal = lazy(() => import("../components/CreateGroupDmModal").then((m) => ({ default: m.CreateGroupDmModal })));
const CreateTableModal = lazy(() => import("../components/CreateTableModal").then((m) => ({ default: m.CreateTableModal })));
const MusicExpandModal = lazy(() => import("../components/MusicExpandModal").then((m) => ({ default: m.MusicExpandModal })));
const VoiceMusicPicker = lazy(() => import("../components/VoiceMusicPicker").then((m) => ({ default: m.VoiceMusicPicker })));
import { SpiderClock } from "../components/SpiderClock";
import { ServerSwitcher } from "../components/ServerSwitcher";
import { SinceLastVisitBanner } from "../components/SinceLastVisitBanner";
import { ThemeToggle } from "../components/ThemeToggle";
import { EmptyState } from "../components/EmptyState";
import { ServerWelcomeHero } from "../components/ServerWelcomeHero";
import { ExpiryBadge } from "../components/ExpiryBadge";
import {
  EmptyDmIcon,
  EmptyHomeIcon,
} from "../components/EmptyIcons";
import { StatusMenu } from "../components/StatusMenu";
import { NetworkWave, Sparkline } from "../components/TelemetryViz";
import { TypingIndicator } from "../components/TypingIndicator";
import { VoiceMiniBar } from "../components/VoiceMiniBar";
import { VoicePlaceholder } from "../components/VoicePlaceholder";
import { useChannelDigest } from "../hooks/useChannelDigest";
import { useChannels } from "../hooks/useChannels";
import { dmIsSaved, dmTitle, useDirectConversations } from "../hooks/useDirectConversations";
import { useDirectMessages } from "../hooks/useDirectMessages";
import { useIncidents } from "../hooks/useIncidents";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMembers, type MemberRole, type MemberRow } from "../hooks/useMembers";
import { useMessages } from "../hooks/useMessages";
import { useNotifications } from "../hooks/useNotifications";
import { useShareTarget } from "../hooks/useShareTarget";
import { useFocusMode } from "../hooks/useFocusMode";
import { useHomeToday } from "../hooks/useHomeToday";
import { useMutedChannels } from "../hooks/usePushPreferences";
import { useSwipeNavigate } from "../hooks/useSwipeNavigate";
import { useProfile } from "../hooks/useProfile";
import { useSearch } from "../hooks/useSearch";
import { useServerActions } from "../hooks/useServerActions";
import { useServerEmojis } from "../hooks/useServerEmojis";
import { useTeamHealth } from "../hooks/useTeamHealth";
import { useServers } from "../hooks/useServers";
import { useSinceLastVisit } from "../hooks/useSinceLastVisit";
import { useSocket } from "../hooks/useSocket";
import { useTelemetry } from "../hooks/useTelemetry";
import { useVoice } from "../hooks/useVoice";
import { useVoiceHealth } from "../hooks/useVoiceHealth";
import { useVoicePresence, reverseVoiceMap } from "../hooks/useVoicePresence";
import type { PublicUser } from "../hooks/useAuth";

type Props = {
  user: PublicUser;
  socketRev: number;
  onLogout: () => Promise<void>;
};

// v1.1.91 redesign slice 1: module-level inline-style консоли убраны —
// каркас одет в классы (.ec-shell__top / .ec-chat-header / .ec-chat-title
// / .ec-error-banner …) в components.css. См. docs/design/design-brief-v2.

export function AppShell({ user, socketRev, onLogout }: Props) {
  const socket = useSocket(socketRev);
  const brandMarkUrl = `${import.meta.env.BASE_URL}eclipse-chat-logo.png`;
  // v1.1.7: live mem/cpu/pg pills (poll /api/health каждые 10s).
  const telemetry = useTelemetry();

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
    limits: serverLimits,
    ownedCount: ownedServersCount,
    canCreateServer,
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
    loading: channelsLoading,
  } = useChannels(activeServerId, socket);

  // v1.2.22 — custom-emoji map активного сервера для RichContent
  // в сообщениях / thread'ах / channel-description / etc.
  // v1.2.25 — socket для real-time invalidation при upload/delete
  // другими admin'ами.
  const { emojis: customEmojis } = useServerEmojis(activeServerId, socket);

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
  // DM-mode активируется когда activeServerId === null (после клика «Личные
  // сообщения» в ServerSwitcher). Список конверсаций + open-or-create.
  const {
    conversations: dmConversations,
    loading: dmLoading,
    error: dmError,
    selectedDmId,
    selectDm,
    openDmWith,
    createGroupDm,
  } = useDirectConversations(socket, user.id);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  /** v0.54: открытый ActionItemDrawer. null = drawer закрыт. */
  const [openActionItemId, setOpenActionItemId] = useState<string | null>(null);
  /** v0.59 phase 1: выбранная таблица (заменяет chat main area). */
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const {
    tables: opTables,
    reload: reloadTables,
    createTable: createOpTable,
    createFromTemplate: createOpTableFromTemplate,
    deleteTable: deleteOpTable,
  } = useOperationalTables(activeServerId, socket);
  /** v0.70: открыта ли модалка создания таблицы (с template picker). */
  const [showCreateTable, setShowCreateTable] = useState(false);
  /** v0.72: открыт ли picker для запуска music в VOICE-канале. */
  const [showVoiceMusicPicker, setShowVoiceMusicPicker] = useState(false);
  /** v0.74 #32 phase 3: открыт ли expand modal плеера. */
  const [showMusicExpand, setShowMusicExpand] = useState(false);
  /** v0.96 UX refactor: открыт ли ChannelInfoPanel overlay (Сводка/Память/
   *  Дела/Файлы) поверх MessageList. Раньше эти 4 вкладки жили в right rail. */
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [infoPanelTab, setInfoPanelTab] = useState<
    "summary" | "memory" | "execution" | "files"
  >("summary");
  // Закрываем info panel при смене канала — context меняется, panel может
  // не иметь смысла. User снова откроет если нужно.
  useEffect(() => {
    setInfoPanelOpen(false);
  }, [selectedChannelId]);
  // v0.61 shared listening room. Scoped per selected TEXT/BROADCAST channel —
  // в VOICE сессии не активны (backend отвергнёт).
  const music = useChannelMusic(selectedChannelId, socket);
  // v1.5.14 — server-wide audio library для music room playlist (все audio
  // attachments в каналах сервера, member-only). Fetch только когда modal
  // open'нется и есть active session — иначе бесполезный network call.
  const musicLibrary = useServerAudioLibrary(
    showMusicExpand && music.session ? activeServerId : null,
  );
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
  // v0.74 #29 phase 1: Focus mode — filter feed to mentions/pinned/own.
  const focus = useFocusMode();
  // v1.5.32 — Web Share Target receiver. URL params (?share_title/text/url)
  // парсятся on mount, content передаётся в первый смонтированный composer
  // (channel или DM, whichever is active).
  const share = useShareTarget();

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
    updateActionItemStatus,
    typingUsers,
    emitTypingStart,
    emitTypingStop,
    error: messagesError,
    loading: messagesLoading,
    openActionItems,
    pendingBotTyping,
    ephemeralBanner,
    dismissEphemeralBanner,
  } = useMessages(selectedChannelId, socket, user.id);

  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  // v0.97: один Hub-модал вместо разделённых Info + Settings. initialTab
  // позволяет открыть его сразу на нужной вкладке (например settings-icon
  // в chat-header → tab="settings").
  const [serverHubOpen, setServerHubOpen] = useState(false);
  const [serverHubTab, setServerHubTab] = useState<
    "overview" | "branding" | "settings" | "bots"
  >("overview");
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  /** v0.73 #14: In-app help / onboarding. Полноэкранный view как Home /
   *  StatusBoard / TeamHealth — правый rail скрыт. Открывается «?» в topbar. */
  const [helpOpen, setHelpOpen] = useState(false);
  /** v0.76 #25 phase 1: Admin Panel — полноэкранный view для OWNER/ADMIN. */
  const [adminOpen, setAdminOpen] = useState(false);
  // v1.2.6 Platform Admin (trek P1) — глобальная super-admin панель.
  // Иконка в топбаре появляется ТОЛЬКО при user.isPlatformOwner = true.
  const [platformAdminOpen, setPlatformAdminOpen] = useState(false);
  // v1.5.4 — AI agent button ripple. Перемонтаж <span key={rippleKey}>
  // перезапускает CSS keyframe при каждом клике.
  const [aiRippleKey, setAiRippleKey] = useState(0);
  // Incident panel — toggle в right rail (приоритет ниже thread panel).
  const [showIncidents, setShowIncidents] = useState(false);
  // Thread panel — открыт когда selectedThreadId != null. Replaces MemberList
  // в right rail. Close → возвращается MemberList.
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  // Channel settings modal — id канала, который сейчас редактируется.
  const [settingsChannelId, setSettingsChannelId] = useState<string | null>(null);
  // Execution Status Board — server-wide доска задач в центре (вместо чата).
  const [statusBoardOpen, setStatusBoardOpen] = useState(false);
  // Team Health — server-wide aggregate ActionItem'ов. Полный full-width view
  // как Status Board (правый rail скрыт, чат не виден).
  const [teamHealthOpen, setTeamHealthOpen] = useState(false);
  // Pre-filter для Status Board — set'ится при переходе из Team Health
  // stat-карточки. Прокидывается в StatusBoard через `initialFilter` prop;
  // StatusBoard mount-effect применяет фильтр к state.
  const [statusBoardFilter, setStatusBoardFilter] = useState<
    | { kind: "overdue" }
    | { kind: "unassigned" }
    | { kind: "assignee"; userId: string }
    | null
  >(null);

  // Закрыть thread при смене канала / сервера — не показывать thread из старого канала
  useEffect(() => {
    setSelectedThreadId(null);
  }, [selectedChannelId, activeServerId]);
  // Закрыть Status Board + Team Health при смене сервера (они привязаны к серверу).
  useEffect(() => {
    setStatusBoardOpen(false);
    setTeamHealthOpen(false);
    setStatusBoardFilter(null);
  }, [activeServerId]);

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filters: searchFilters,
    setFilters: setSearchFilters,
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

  // ===== Home «TODAY» =====
  // Операционная сводка поверх всех workspace'ов — fetch при открытии Home.
  const homeToday = useHomeToday(homeOpen);

  // ===== Execution Status Board =====
  // Все ActionItem'ы активного сервера — live через action:item:* в server-room.
  const serverActions = useServerActions(activeServerId, socket);
  // Team Health — server-wide aggregate ActionItem'ов. Fetch при teamHealthOpen
  // (lazy: ничего не делаем пока юзер не открыл view).
  const teamHealth = useTeamHealth(teamHealthOpen ? activeServerId : null);

  // v0.85 #27 phase 4: muted channels per-user. Загружается один раз при
  // mount; toggle через mute/unmute optimistic updates.
  const muted = useMutedChannels();

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

  // AI Memory «Since your last visit» — фиксирует visit + дельта с prior.
  // Только для text/broadcast (voice = без feed'а).
  const visitChannelId =
    selectedChannel && selectedChannel.type !== "VOICE" ? selectedChannel.id : null;
  const sinceLastVisit = useSinceLastVisit(visitChannelId);

  // Client Mode (v0.27 brief #5): CLIENT-серверы прячут operator-инструменты
  // (Status Board / Дела / Файлы / slash-hints) — calm portal для клиента
  // агентства/dev-студии. Меняется OWNER'ом в Server Settings → Режим.
  const isClientMode = activeServer?.mode === "CLIENT";

  // BROADCAST-канал (news/blogger): читают все, публикуют только
  // OWNER/ADMIN/MODERATOR. Остальные видят read-only ленту.
  const canManageBroadcast =
    currentRole === "OWNER" ||
    currentRole === "ADMIN" ||
    currentRole === "MODERATOR";
  const broadcastReadOnly =
    selectedChannel?.type === "BROADCAST" && !canManageBroadcast;

  // Правый rail — context-aware IntelligencePanel — виден ВСЕГДА в server-view
  // (и voice, и chat): табы «Intelligence» + «Участники». `isVoiceView`
  // переключает режим панели.
  const isVoiceView =
    !inDmMode && !homeOpen && selectedChannel?.type === "VOICE";
  const inServerView =
    Boolean(activeServer) && !homeOpen && !helpOpen && !adminOpen;
  // Status Board / Team Health / Help / Admin открываются на всю ширину (как Home) — правый rail скрыт.
  const showRightRail =
    inServerView &&
    !statusBoardOpen &&
    !teamHealthOpen &&
    !helpOpen &&
    !adminOpen;
  const [navOpen, setNavOpenRaw] = useState(false);
  const [membersOpen, setMembersOpenRaw] = useState(false);

  // v0.73 mobile: drawer mutex. Открытие nav-drawer'а закрывает members,
  // и наоборот. На mobile (один-drawer-в-момент) это убирает наложение
  // двух drawer'ов одновременно — было слышно по Pavel-screenshot 17.05:
  // обе панели частично видны, чат зажат, composer wrap'ит по символу.
  const setNavOpen = (value: boolean | ((p: boolean) => boolean)) => {
    setNavOpenRaw((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) setMembersOpenRaw(false);
      return next;
    });
  };
  const setMembersOpen = (value: boolean | ((p: boolean) => boolean)) => {
    setMembersOpenRaw((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) setNavOpenRaw(false);
      return next;
    });
  };
  // Правый rail сворачивается, чтобы не съедать ширину центра (особенно
  // в voice-immersive режиме). По умолчанию свёрнут в voice, развёрнут в chat.
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);
  const rightRailVisible = showRightRail && !rightRailCollapsed;

  // v1.1.20: mobile breakpoint 900 → 1024 (sync с responsive.css).
  // Всё ≤1024px = single-column + drawers; промежуточный планшетный
  // 3-колоночный режим убран (cramped на large phones / low-DPI).
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const isTabletOrSmaller = useMediaQuery("(max-width: 1024px)");
  const voiceHealth = useVoiceHealth();
  const {
    byChannel: rawVoiceByChannel,
    metaByUser: rawVoiceMeta,
    speakingByUser,
  } = useVoicePresence(socket);
  // Voice state lifted в AppShell — persistent across channel switches, доступен sidebar'у.
  const voice = useVoice(socket);
  // Для voice-канала, где ты сейчас подключён, источник истины — сам LiveKit
  // (`voice.participants`), а НЕ socket-tracked voiceByChannel. Тот может
  // рассинхрониться: socket disconnect ≠ LiveKit disconnect → backend думает
  // что в канале 1, а реально 4 (sidebar показывал неполный состав).
  // Накрываем активный канал реальным составом + live mic/deafen-стейтом.
  const liveVoiceOverride = voice.activeChannelId && voice.participants.length > 0;
  const voiceByChannel = liveVoiceOverride
    ? {
        ...rawVoiceByChannel,
        [voice.activeChannelId as string]: voice.participants.map((p) => p.identity),
      }
    : rawVoiceByChannel;
  const voiceMetaByUser = liveVoiceOverride
    ? {
        ...rawVoiceMeta,
        ...Object.fromEntries(
          voice.participants.map((p) => [
            p.identity,
            { micMuted: p.isMicMuted, deafened: p.isDeafened },
          ]),
        ),
      }
    : rawVoiceMeta;
  const voiceChannelByUser = reverseVoiceMap(voiceByChannel);
  // Speaking userIds для sidebar-glow во ВСЕХ voice-каналах:
  //  - чужие комнаты — из backend broadcast (speakingByUser);
  //  - своя комната — из локального LiveKit ActiveSpeakers (точнее, без
  //    socket round-trip), overlay поверх backend.
  const speakingUserIds = new Set<string>();
  for (const [uid, isSpeaking] of Object.entries(speakingByUser)) {
    if (isSpeaking && voiceChannelByUser[uid] !== voice.activeChannelId) {
      speakingUserIds.add(uid);
    }
  }
  for (const p of voice.participants) {
    if (p.isSpeaking && !p.isMicMuted) speakingUserIds.add(p.identity);
  }
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
  // Voice = immersive: сворачиваем правый rail. Chat — разворачиваем.
  useEffect(() => {
    setRightRailCollapsed(isVoiceView);
  }, [isVoiceView]);

  // На mobile: select channel → закрыть nav drawer (UX как в Discord/Telegram)
  const handleSelectChannel = (channelId: string) => {
    setHomeOpen(false);
    setHelpOpen(false);
    setAdminOpen(false);
    setStatusBoardOpen(false);
    setTeamHealthOpen(false);
    setSelectedTableId(null);
    setSelectedChannelId(channelId);
    if (isMobile) setNavOpen(false);
  };

  // v0.81 #27 phase 2 PWA: swipe-навигация между TEXT/EXECUTION каналами
  // на mobile. Disabled когда: не mobile / drawer открыт / в DM/voice/etc.
  const swipeEnabled =
    isMobile &&
    !navOpen &&
    !membersOpen &&
    !inDmMode &&
    !helpOpen &&
    !adminOpen &&
    !homeOpen &&
    !statusBoardOpen &&
    !teamHealthOpen &&
    !selectedTableId &&
    selectedChannel?.type !== "VOICE";
  useSwipeNavigate({
    enabled: swipeEnabled,
    onSwipeLeft: () => {
      const texts = channels.filter(
        (c) => c.type === "TEXT" || c.type === "EXECUTION",
      );
      if (texts.length < 2 || !selectedChannelId) return;
      const idx = texts.findIndex((c) => c.id === selectedChannelId);
      if (idx === -1) return;
      const next = texts[(idx + 1) % texts.length];
      if (next) handleSelectChannel(next.id);
    },
    onSwipeRight: () => {
      const texts = channels.filter(
        (c) => c.type === "TEXT" || c.type === "EXECUTION",
      );
      if (texts.length < 2 || !selectedChannelId) return;
      const idx = texts.findIndex((c) => c.id === selectedChannelId);
      if (idx === -1) return;
      const prev = texts[(idx - 1 + texts.length) % texts.length];
      if (prev) handleSelectChannel(prev.id);
    },
  });

  // v0.59 phase 1: при смене сервера сбрасываем выбранную таблицу
  // (таблицы scoped per-server — id из другого пространства невалиден).
  useEffect(() => {
    setSelectedTableId(null);
  }, [activeServerId]);

  const openHome = () => {
    setHomeOpen(true);
    setHelpOpen(false);
    setAdminOpen(false);
    setStatusBoardOpen(false);
    setTeamHealthOpen(false);
    setSelectedTableId(null);
    setSelectedChannelId(null);
    selectDm(null);
    setNavOpen(false);
    setMembersOpen(false);
  };

  const openHelp = () => {
    setHelpOpen(true);
    setAdminOpen(false);
    setHomeOpen(false);
    setStatusBoardOpen(false);
    setTeamHealthOpen(false);
    setSelectedTableId(null);
    setNavOpen(false);
    setMembersOpen(false);
  };

  const openAdmin = () => {
    setAdminOpen(true);
    setHelpOpen(false);
    setHomeOpen(false);
    setStatusBoardOpen(false);
    setTeamHealthOpen(false);
    setSelectedTableId(null);
    setNavOpen(false);
    setMembersOpen(false);
  };

  const openActiveServer = () => {
    setHomeOpen(false);
    setHelpOpen(false);
    setAdminOpen(false);
    setStatusBoardOpen(false);
    setTeamHealthOpen(false);
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
    (rightRailVisible ? " ec-shell--has-server" : "") +
    (navOpen ? " ec-shell--nav-open" : "") +
    (membersOpen ? " ec-shell--members-open" : "");

  return (
    <div className={shellClass}>
      {/* Командный хребет — шапка: бренд + переключатель пространств.
          Визуально сливается с колонкой каналов ниже в одну вертикаль. */}
      <div className="ec-shell__brandbar">
        {isMobile && (
            <button
              type="button"
              className="ec-shell__drawer-btn ec-shell__drawer-btn--nav"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? "Закрыть навигацию" : "Открыть навигацию"}
              title="Комнаты пространства"
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
            onClick={openHome}
            aria-label="Открыть главную страницу"
            title="Главная"
          >
            <img className="ec-brand-mark" src={brandMarkUrl} alt="" aria-hidden />
          </button>
          {/* v1.1.51: бывший far-left server-rail свёрнут в topbar-control. */}
          <ServerSwitcher
            servers={servers}
            activeServerId={activeServerId}
            onSelect={(id) => {
              setHomeOpen(false);
              setHelpOpen(false);
              setAdminOpen(false);
              setActiveServerId(id);
              if (isMobile) setNavOpen(false);
            }}
            onCreateRequest={() => {
              if (!canCreateServer) return;
              setShowCreateServer(true);
            }}
            onJoinRequest={() => setShowJoinServer(true)}
            onHomeRequest={openHome}
            homeActive={homeOpen}
            onSearchRequest={() => {
              if (activeServerId) setShowSearch(true);
            }}
            searchEnabled={Boolean(activeServerId)}
            dmsActive={inDmMode}
            dmsUnread={dmConversations.reduce((sum, c) => sum + c.unread, 0)}
            onDmsRequest={() => {
              setHomeOpen(false);
              setHelpOpen(false);
              setAdminOpen(false);
              setActiveServerId(null);
              if (isMobile) setNavOpen(false);
            }}
            canCreateServer={canCreateServer}
            ownedCount={ownedServersCount}
            maxOwnedServers={serverLimits.maxOwnedServers}
            compact={isMobile}
          />
      </div>

      {/* Командный бар над чатом: локация (слева) · действия (справа). */}
      <header className="ec-shell__cmdbar">
        {homeOpen ? (
          <div className="ec-shell__breadcrumb ec-shell__loc">
            <span className="ec-shell__loc-name">Главная</span>
          </div>
        ) : activeServer ? (
          <div className="ec-shell__breadcrumb ec-shell__loc">
            <span className="ec-shell__loc-space">{activeServer.name}</span>
            {selectedChannel && (
              <>
                <span className="ec-shell__loc-sep">/</span>
                <span className="ec-shell__loc-name">
                  <span className="ec-shell__loc-hash">#</span>
                  {selectedChannel.name}
                </span>
              </>
            )}
          </div>
        ) : null}
        <div className="ec-shell__top-actions">
          {/* v1.1.1+v1.1.7 telemetry. v1.1.38 (WS-1 «Облегчение»):
              ПАМ/ЦП свёрнуты — видны по hover группы ИЛИ авто-разворот
              при warn/risk. Progressive disclosure: постоянный
              визуальный вес ↓, но проблемы всплывают сами. */}
          <div className="ec-telemetry">
          <span
            className={
              "ec-telemetry-pill " +
              (isReady && telemetry.online
                ? "ec-telemetry-pill--ok"
                : "ec-telemetry-pill--warn")
            }
            title={
              !isReady
                ? "Socket: соединение потеряно"
                : !telemetry.online
                ? "Health endpoint недоступен"
                : `Socket OK · pg.active=${telemetry.pgActive ?? "—"} · ПАМ ${telemetry.memPercent ?? "—"}% · ЦП ${telemetry.cpuPercent ?? "—"}%`
            }
          >
            <span className="ec-telemetry-pill__dot" />
            СЕТЬ:{" "}
            {isReady && telemetry.online
              ? "СТАБИЛЬНА"
              : !isReady
              ? "ОБРЫВ"
              : "ДЕГРАД"}
            <NetworkWave active={isReady && telemetry.online} />
          </span>
          <span
            className={
              "ec-telemetry-pill ec-telemetry-pill--detail" +
              (telemetry.memStatus === "warn"
                ? " ec-telemetry-pill--warn"
                : telemetry.memStatus === "risk"
                ? " ec-telemetry-pill--risk"
                : "")
            }
            title={
              telemetry.memPercent != null
                ? `Память (system used / total): ${telemetry.memPercent}%`
                : "Память: ожидание данных"
            }
          >
            ПАМ:{" "}
            {telemetry.memPercent != null
              ? `${telemetry.memPercent.toFixed(0).padStart(2, "0")}%`
              : "—"}
            <Sparkline values={telemetry.memHistory} />
          </span>
          <span
            className={
              "ec-telemetry-pill ec-telemetry-pill--detail" +
              (telemetry.cpuStatus === "warn"
                ? " ec-telemetry-pill--warn"
                : telemetry.cpuStatus === "risk"
                ? " ec-telemetry-pill--risk"
                : "")
            }
            title={
              telemetry.cpuPercent != null
                ? `CPU (delta between samples): ${telemetry.cpuPercent}%`
                : "CPU: ожидание данных"
            }
          >
            ЦП:{" "}
            {telemetry.cpuPercent != null
              ? `${telemetry.cpuPercent.toFixed(0).padStart(2, "0")}%`
              : "—"}
            <Sparkline values={telemetry.cpuHistory} />
          </span>
          </div>
          {/* v1.1.81 — кластер-разделитель: статус | инструменты */}
          <span className="ec-topbar-sep" aria-hidden />
          {inServerView && (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              title="Поиск (Ctrl+K)"
              aria-label="Поиск"
              className="ec-icon-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => (helpOpen ? setHelpOpen(false) : openHelp())}
            title="Справка и онбординг"
            aria-label="Справка"
            aria-pressed={helpOpen}
            className="ec-icon-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
          {(currentRole === "OWNER" || currentRole === "ADMIN") &&
            activeServer &&
            !inDmMode && (
              <button
                type="button"
                onClick={() =>
                  adminOpen ? setAdminOpen(false) : openAdmin()
                }
                title="Админ-панель"
                aria-label="Админ-панель"
                aria-pressed={adminOpen}
                className="ec-icon-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2l9 4v6c0 5-3.5 9.5-9 10-5.5-.5-9-5-9-10V6l9-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </button>
            )}
          {/* v1.2.6 Platform Admin (trek P1) — кнопка только для владельца
              платформы. Per-server AdminPanel и Platform Admin — две
              разные иерархии: первая управляет конкретным workspace'ом,
              вторая — глобальная (баны, сброс пароля). */}
          {user.isPlatformOwner === true && (
            <button
              type="button"
              onClick={() => setPlatformAdminOpen((v) => !v)}
              title="Platform Admin — все пользователи платформы"
              aria-label="Platform Admin"
              aria-pressed={platformAdminOpen}
              className="ec-icon-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
          {/* v0.74 #29 phase 1: Focus mode toggle — фильтр feed'а на
              direct-mentions + pinned + own messages. Глобальный, не
              привязан к каналу. */}
          <button
            type="button"
            onClick={focus.toggle}
            title={
              focus.enabled
                ? "Фокус-режим включён — показаны только меншены, закреплённые и свои"
                : "Включить фокус-режим (скрыть шум)"
            }
            aria-label="Фокус-режим"
            aria-pressed={focus.enabled}
            className="ec-icon-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
          {showRightRail && (
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
              className={
                "ec-icon-btn" +
                (incidentOpenCount > 0 ? " ec-icon-btn--alert" : "")
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {incidentOpenCount > 0 && (
                <span aria-hidden className="ec-count-badge">
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
              aria-pressed={notif.permission === "granted" && notif.enabled}
              className="ec-icon-btn"
              style={
                notif.permission === "denied" ? { opacity: 0.45 } : undefined
              }
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
          {/* v1.5.4 — AI agent button: premium violet glow между notifications
              и SpiderClock'ом. Click → dispatch global `ec-ai-trigger`; composer
              (MessageInput) ловит и фокусит textarea + prefill «@ai ». */}
          <button
            type="button"
            onClick={() => {
              setAiRippleKey((k) => k + 1);
              window.dispatchEvent(new CustomEvent("ec-ai-trigger"));
            }}
            title="AI агент — спросить @ai в чате"
            aria-label="AI агент"
            className="ec-icon-btn ec-ai-btn ec-anim-ai-pulse"
          >
            {aiRippleKey > 0 && (
              <span
                key={aiRippleKey}
                className="ec-ai-btn-ripple ec-anim-ai-ripple"
                aria-hidden
              />
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {/* sparkle / star: central 4-point + 2 small accents */}
              <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
              <path d="M19 14l1 2.5 2.5 1-2.5 1L19 21l-1-2.5L15.5 17.5l2.5-1z" opacity="0.7" />
            </svg>
          </button>
          <SpiderClock />
          <ThemeToggle />
          {showRightRail && (
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
          {/* v1.1.81 — кластер-разделитель: инструменты | идентичность */}
          <span className="ec-topbar-sep" aria-hidden />
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setStatusAnchor(rect);
            }}
            title="Статус и профиль"
            className="ec-shell__user-chip"
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
          <LogoutButton onLogout={onLogout} />
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
            currentUserId={user.id}
            onCreateGroup={() => setCreateGroupOpen(true)}
          />
        ) : (
          <ChannelList
            serverId={activeServer?.id ?? null}
            serverName={activeServer?.name ?? null}
            serverRole={activeServer?.role ?? null}
            inviteCode={activeServer?.inviteCode ?? null}
            serverBanner={activeServer?.banner ?? null}
            channels={channels}
            channelsLoading={channelsLoading}
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
            onShowServerInfo={() => {
              if (!activeServer) return;
              setServerHubTab("overview");
              setServerHubOpen(true);
            }}
            onOpenStatusBoard={
              isClientMode
                ? undefined
                : () => {
                    setHomeOpen(false);
                    setTeamHealthOpen(false);
                    // Direct entry из ChannelList — сбрасываем pre-filter
                    // (он имеет смысл только при переходе из Team Health).
                    setStatusBoardFilter(null);
                    setStatusBoardOpen(true);
                    if (isMobile) setNavOpen(false);
                  }
            }
            statusBoardActive={statusBoardOpen}
            onOpenTeamHealth={
              isClientMode
                ? undefined
                : () => {
                    setHomeOpen(false);
                    setStatusBoardOpen(false);
                    setTeamHealthOpen(true);
                    if (isMobile) setNavOpen(false);
                  }
            }
            teamHealthActive={teamHealthOpen}
            serverMode={activeServer?.mode}
            mutedChannels={muted.mutedSet}
            onToggleMute={(channelId, mute) => {
              if (mute) {
                void muted.mute(channelId);
              } else {
                void muted.unmute(channelId);
              }
            }}
            onOpenClientPortal={
              isClientMode && activeServer
                ? () => {
                    // v0.83 #24 phase 1: navigate to portal через hash route.
                    // App.tsx detect'нет hash и переключит на ClientPortalContainer.
                    window.location.hash = `#/portal/${activeServer.id}`;
                  }
                : undefined
            }
            tables={
              isClientMode
                ? undefined
                : opTables.map((t) => ({
                    id: t.id,
                    name: t.name,
                    rowCount: t.rowCount,
                  }))
            }
            onOpenTable={
              isClientMode
                ? undefined
                : (tableId) => {
                    setHomeOpen(false);
                    setStatusBoardOpen(false);
                    setTeamHealthOpen(false);
                    setSelectedTableId(tableId);
                    if (isMobile) setNavOpen(false);
                  }
            }
            onCreateTable={
              isClientMode ? undefined : () => setShowCreateTable(true)
            }
            activeTableId={selectedTableId}
            voiceByChannel={voiceByChannel}
            voiceMetaByUser={voiceMetaByUser}
            members={members}
            speakingUserIds={speakingUserIds}
          />
        )}
      </div>

      <section className="ec-shell__chat">
        <div className="ec-chat-header">
          {homeOpen ? (
            <span className="ec-chat-title">
              <img className="ec-brand-mark ec-brand-mark--sm" src={brandMarkUrl} alt="" aria-hidden />
              Главная
            </span>
          ) : helpOpen ? (
            <span className="ec-chat-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Справка
            </span>
          ) : adminOpen ? (
            <span className="ec-chat-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 2l9 4v6c0 5-3.5 9.5-9 10-5.5-.5-9-5-9-10V6l9-4z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Админ-панель
            </span>
          ) : statusBoardOpen ? (
            <span className="ec-chat-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
              Доска задач
            </span>
          ) : teamHealthOpen ? (
            <span className="ec-chat-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Здоровье команды
            </span>
          ) : inDmMode && selectedDm ? (
            <span className="ec-chat-title">
              {dmIsSaved(selectedDm) ? (
                <>
                  <span
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "var(--ec-radius-sm)",
                      display: "grid",
                      placeItems: "center",
                      background: "var(--ec-accent-soft)",
                      color: "var(--ec-accent)",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                    </svg>
                  </span>
                  Избранное
                </>
              ) : selectedDm.isGroup ? (
                <>
                  <GroupAvatar participants={selectedDm.participants} size={22} />
                  {dmTitle(selectedDm, user.id)}
                </>
              ) : (
                <>
                  <Avatar url={selectedDm.other.avatar} name={selectedDm.other.displayName} size={22} />
                  {selectedDm.other.displayName}
                </>
              )}
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
              <span className="ec-chat-title">
                <ChannelGlyph
                  type={selectedChannel.type}
                  icon={selectedChannel.emoji}
                  size={16}
                  className="ec-chat-title__glyph"
                />
                {selectedChannel.name}
              </span>
              {selectedChannel.expiresAt && (
                <ExpiryBadge expiresAt={selectedChannel.expiresAt} />
              )}
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
                      customEmojis={customEmojis}
                    />
                  </span>
                </>
              )}
              {music.session && (
                // v0.72: убрано исключение для VOICE — теперь music
                // работает и в voice-каналах (synchronous listening
                // во время голосового созвона). Backend разрешил VOICE.
                <MusicMiniPlayer
                  session={music.session}
                  derivedPositionMs={music.derivedPositionMs}
                  isHost={music.session.host.id === user.id}
                  onTogglePlayPause={() => void music.togglePlayPause()}
                  onSkip={() => void music.skip()}
                  onSeek={(ms) => void music.seek(ms)}
                  onStop={() => void music.stop()}
                  onExpand={() => setShowMusicExpand(true)}
                />
              )}
              {/* v0.72: для VOICE-канала без активной music session —
                  кнопка «Запустить музыку» открывает picker. Для TEXT
                  каналов это не нужно (можно нажать «Слушать вместе»
                  на любом audio attachment в чате). */}
              {!music.session && selectedChannel.type === "VOICE" && (
                <button
                  type="button"
                  onClick={() => setShowVoiceMusicPicker(true)}
                  title="Запустить музыку для всех в голосовой комнате"
                  aria-label="Запустить музыку"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0.35rem 0.7rem",
                    borderRadius: "var(--ec-radius-full)",
                    background: "var(--ec-accent-soft)",
                    color: "var(--ec-accent)",
                    border: "1px solid var(--ec-border-accent)",
                    cursor: "pointer",
                    fontSize: "var(--ec-text-2xs)",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Музыка
                </button>
              )}
              {/* v0.98: hover-buttons для pins / tasks. Раньше ActionQueueBar
                  + PinnedBar занимали постоянное место сверху MessageList'а.
                  Теперь — compact icons в chat-header с count badge; hover
                  показывает top 3 items popover; click открывает full
                  ChannelInfoPanel на соответствующем tab'е. Pavel-ask 19.05
                  «при наведении отображались поверх экрана чата». */}
              {(() => {
                const pinnedList = messages
                  .filter((m) => m.pinnedAt && !m.deletedAt)
                  .slice(-50)
                  .reverse();
                const pinnedPreview = pinnedList.slice(0, 3);
                return (
                  <ChatHeaderHoverButton
                    icon={
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14V5l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
                      </svg>
                    }
                    label="Закреплённые"
                    count={pinnedList.length}
                    items={pinnedPreview}
                    itemKey={(m) => m.id}
                    renderItem={(m) => (
                      <>
                        <span style={{ display: "block", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)", marginBottom: 2 }}>
                          {m.user.displayName}
                        </span>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "pre-wrap", color: "var(--ec-text)" }}>
                          {m.content || "[без текста — вложение]"}
                        </span>
                      </>
                    )}
                    accent="var(--ec-warn)"
                    onOpenFull={() => {
                      setInfoPanelTab("memory");
                      setInfoPanelOpen(true);
                    }}
                  />
                );
              })()}
              {(() => {
                const openTasks = openActionItems;
                const tasksPreview = openTasks.slice(0, 3);
                return (
                  <ChatHeaderHoverButton
                    icon={
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                      </svg>
                    }
                    label="Открытые дела"
                    count={openTasks.length}
                    items={tasksPreview}
                    itemKey={(a) => a.id}
                    renderItem={(a) => {
                      const glyph = a.type === "DECISION" ? "◆" : a.type === "FOLLOW_UP" ? "↻" : "□";
                      const dueAt = a.dueAt
                        ? new Date(a.dueAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                        : null;
                      return (
                        <>
                          <span style={{ display: "block", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)", marginBottom: 2 }}>
                            <span aria-hidden style={{ fontFamily: "var(--ec-font-mono)", marginRight: 6 }}>
                              {glyph}
                            </span>
                            {a.assignee?.displayName ?? "без ответственного"}
                            {dueAt ? ` · до ${dueAt}` : ""}
                          </span>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ec-text)" }}>
                            {a.title}
                          </span>
                        </>
                      );
                    }}
                    accent="var(--ec-status-exec)"
                    onOpenFull={() => {
                      setInfoPanelTab("execution");
                      setInfoPanelOpen(true);
                    }}
                  />
                );
              })()}
              {/* v0.96: (i) кнопка — открывает ChannelInfoPanel overlay
                  с 4 inner tabs (Сводка/Память/Дела/Файлы). Раньше эти
                  вкладки жили в right rail; теперь rail = только Участники. */}
              <button
                type="button"
                onClick={() => setInfoPanelOpen((v) => !v)}
                aria-label={infoPanelOpen ? "Закрыть информацию о комнате" : "Информация о комнате"}
                aria-pressed={infoPanelOpen}
                title={infoPanelOpen ? "Закрыть информацию" : "Сводка / Память / Дела / Файлы"}
                className="ec-icon-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </button>
              {(activeServer?.role === "OWNER" ||
                activeServer?.role === "ADMIN" ||
                activeServer?.role === "MODERATOR") && (
                <button
                  type="button"
                  onClick={() => setSettingsChannelId(selectedChannel.id)}
                  aria-label="Настройки комнаты"
                  title="Настройки комнаты"
                  className="ec-icon-btn"
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
              {activeServer ? "Выберите комнату слева" : "Нет активного пространства"}
            </span>
          )}
        </div>

        {(serversError || messagesError || dmError || dmMessagesError) && (
          <div className="ec-error-banner">
            {serversError ?? messagesError ?? dmError ?? dmMessagesError}
          </div>
        )}

        {/* v0.96: ChannelInfoPanel — открывается (i)-кнопкой в chat-header.
            4 inner tabs: Сводка/Память/Дела/Файлы. Раньше эти вкладки жили
            в right rail (IntelligencePanel) — теперь rail = только Участники. */}
        {selectedChannel && infoPanelOpen && !inDmMode && (
          <ChannelInfoPanel
            channelId={selectedChannel.id}
            open={infoPanelOpen}
            onClose={() => setInfoPanelOpen(false)}
            activeTab={infoPanelTab}
            onTabChange={setInfoPanelTab}
            digest={channelDigest}
            digestLoading={digestLoading}
            digestError={digestError}
            onRefreshDigest={() => void refreshDigest()}
            digestCompact={isMobile}
            aiSummary={digestAiSummary}
            aiLoading={digestAiLoading}
            aiError={digestAiError}
            onRequestAiSummary={() => void requestDigestAiSummary(7)}
            pinnedMessages={messages
              .filter((m) => m.pinnedAt && !m.deletedAt)
              .map((m) => ({
                id: m.id,
                content: m.content,
                pinnedAt: m.pinnedAt,
                user: {
                  displayName: m.user.displayName,
                  avatar: m.user.avatar,
                },
              }))}
            attachments={messages.flatMap((m) =>
              m.attachments.map((a) => ({
                id: a.id,
                filename: a.filename,
                mimeType: a.mimeType,
                size: a.size,
                url: a.url,
                thumbnailUrl: a.thumbnailUrl,
              })),
            )}
            executionItems={openActionItems.map((a) => ({
              id: a.id,
              title: a.title,
              type: a.type,
              status: a.status,
              dueAt: a.dueAt ?? null,
              assignee: a.assignee
                ? {
                    displayName: a.assignee.displayName,
                    avatar: a.assignee.avatar,
                  }
                : null,
            }))}
            onToggleExecutionStatus={(id, status) =>
              void updateActionItemStatus(id, status)
            }
            onOpenAction={(id) => setOpenActionItemId(id)}
            clientMode={isClientMode}
          />
        )}

        {/* v1.5.27 — lazy panel chain wrapped в Suspense. Все ветви ternary
         * (HelpPanel / AdminPanel / OperationalTablePanel / StatusBoard /
         *  TeamHealth / VoiceRoom) lazy-loaded — fallback={null} избегает
         * "Загрузка…" flash из App.tsx outer Suspense. */}
        <Suspense fallback={null}>
        {helpOpen ? (
          <HelpPanel onClose={() => setHelpOpen(false)} />
        ) : adminOpen && activeServer ? (
          <AdminPanel
            serverId={activeServer.id}
            serverName={activeServer.name}
            serverMode={activeServer.mode}
            currentRole={currentRole}
            members={members}
            channels={channels}
            teamHealth={teamHealth.data}
            onUpdateMemberRole={async (userId, role) => {
              await updateMemberRole(userId, role);
            }}
            onOpenChannelSettings={(channelId) => {
              setSettingsChannelId(channelId);
            }}
            onOpenServerSettings={() => {
              setServerHubTab("settings");
              setServerHubOpen(true);
            }}
            onOpenClientPortal={() => {
              window.location.hash = `#/portal/${activeServer.id}`;
            }}
            onClose={() => setAdminOpen(false)}
          />
        ) : selectedTableId ? (
          <OperationalTablePanel
            tableId={selectedTableId}
            onClose={() => setSelectedTableId(null)}
            onDelete={async () => {
              if (!window.confirm("Удалить таблицу со всеми данными?")) return;
              const ok = await deleteOpTable(selectedTableId);
              if (ok) {
                setSelectedTableId(null);
                await reloadTables();
              }
            }}
            members={members.map((m) => ({
              userId: m.userId,
              user: {
                displayName: m.user.displayName,
                avatar: m.user.avatar,
              },
            }))}
            socket={socket}
            availableTables={opTables
              .filter((t) => t.id !== selectedTableId)
              .map((t) => ({ id: t.id, name: t.name }))}
            onOpenLinkedAction={(actionItemId) => setOpenActionItemId(actionItemId)}
          />
        ) : homeOpen ? (
          <HomeToday
            userName={headerName}
            data={homeToday.data}
            loading={homeToday.loading}
            error={homeToday.error}
            onReload={() => void homeToday.reload()}
            serversCount={servers.length}
            dmCount={dmConversations.length}
            onOpenChannel={(serverId, channelId) => {
              setHomeOpen(false);
              setActiveServerId(serverId);
              setSelectedChannelId(channelId);
              if (isMobile) setNavOpen(false);
            }}
            onOpenServer={openActiveServer}
            onOpenDms={() => {
              setHomeOpen(false);
              setActiveServerId(null);
              selectDm(null);
            }}
            onCreateServer={() => setShowCreateServer(true)}
          />
        ) : statusBoardOpen && activeServer ? (
          <StatusBoard
            serverName={activeServer.name}
            actions={serverActions.actions}
            loading={serverActions.loading}
            error={serverActions.error}
            onReload={() => void serverActions.reload()}
            currentUserId={user.id}
            channelNameById={(cid) => channelNameById(cid)}
            onUpdateStatus={(id, status) => void serverActions.updateStatus(id, status)}
            onOpenChannel={(channelId) => {
              setStatusBoardOpen(false);
              setStatusBoardFilter(null);
              setSelectedChannelId(channelId);
              if (isMobile) setNavOpen(false);
            }}
            onOpenAction={(id) => setOpenActionItemId(id)}
            initialFilter={statusBoardFilter}
          />
        ) : teamHealthOpen && activeServer ? (
          <TeamHealth
            serverName={activeServer.name}
            data={teamHealth.data}
            loading={teamHealth.loading}
            error={teamHealth.error}
            onReload={() => void teamHealth.reload()}
            onClose={() => setTeamHealthOpen(false)}
            onOpenBoard={(filter) => {
              // v0.31: filter активируется через StatusBoard initialFilter prop.
              // null = просто открыть Board без pre-filter (клик по «Открыто»
              // stat-карточке).
              setStatusBoardFilter(filter);
              setTeamHealthOpen(false);
              setStatusBoardOpen(true);
            }}
          />
        ) : inDmMode ? (
          !selectedDm ? (
            <EmptyState
              icon={<EmptyDmIcon />}
              title="Личные сообщения"
              hint="Выбери диалог слева или открой профиль участника любого пространства и нажми «Написать в личку»."
            />
          ) : (
            <>
              <MessageList
                messages={dmMessages}
                emptyHint={
                  dmMessagesLoading
                    ? "Загрузка…"
                    : dmIsSaved(selectedDm)
                    ? "Избранное — твой личный буфер. Сохраняй сюда заметки, ссылки и файлы."
                    : selectedDm.isGroup
                    ? "Это начало группового чата. Напиши первое сообщение."
                    : "Это начало вашего диалога. Напиши первое сообщение."
                }
                channelName={dmTitle(selectedDm, user.id)}
                listKey={`dm:${selectedDm.id}`}
                currentUserId={user.id}
                currentUserName={headerName}
                currentRole={null}
                mentionNames={
                  selectedDm.isGroup
                    ? selectedDm.participants
                        .filter((p) => p.id !== user.id)
                        .map((p) => p.displayName)
                    : [selectedDm.other.displayName]
                }
                onRetry={(mid) => dmRetry(mid, senderForMessages)}
                onEdit={dmEdit}
                onDelete={dmDelete}
                onPin={async () => false}
                onUnpin={async () => false}
                onToggleReaction={dmToggleReaction}
                isDm
              />
              <MessageInput
                channelName={dmTitle(selectedDm, user.id)}
                placeholder={dmIsSaved(selectedDm) ? "Заметка в Избранное" : undefined}
                draftKey={`dm:${selectedDm.id}`}
                disabled={!isReady}
                hideSlashCommands
                onSend={(content, attachments) => dmSend(content, senderForMessages, attachments)}
                onTypingStart={() => undefined}
                onTypingStop={() => undefined}
                prefillContent={share.pendingContent}
                onPrefillConsumed={share.consume}
                prefillFiles={share.pendingFiles}
                onPrefillFilesConsumed={share.consumeFiles}
              />
            </>
          )
        ) : !activeServer ? (
          <EmptyState
            icon={<EmptyHomeIcon />}
            title="Нет активного пространства"
            hint="Создайте своё пространство или вступите по инвайту — кнопки в левой колонке."
            action={
              <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
                <button
                  type="button"
                  className="ec-btn ec-btn--primary ec-btn--sm"
                  onClick={() => setShowCreateServer(true)}
                >
                  Создать пространство
                </button>
                <button
                  type="button"
                  className="ec-btn ec-btn--sm"
                  onClick={() => setShowJoinServer(true)}
                >
                  Вступить по инвайту
                </button>
              </div>
            }
          />
        ) : !selectedChannelId || !selectedChannel ? (
          // v1.5.34 — Server banners trek #2. Replace plain EmptyState на
          // cinematic ServerWelcomeHero: banner background + name + description
          // + welcome message + featured channels grid. Без banner — solid
          // fallback с radial gradient + те же data.
          <ServerWelcomeHero
            server={activeServer}
            channels={channels}
            onSelectChannel={(id) => {
              setSelectedChannelId(id);
              if (isMobile) setNavOpen(false);
            }}
          />
        ) : selectedChannel.type === "VOICE" ? (
          voiceHealth.enabled ? (
            <VoiceRoom
              channelId={selectedChannel.id}
              channelName={selectedChannel.name}
              members={members}
              occupants={selectedVoiceOccupants}
              activeVoiceChannelName={activeVoiceChannelName}
              voice={voice}
              socket={socket}
            />
          ) : (
            <VoicePlaceholder channelName={selectedChannel.name} />
          )
        ) : selectedChannel.type === "EXECUTION" && activeServer ? (
          // v0.74 #16 phase 1: execution-комната = channel-scoped kanban.
          // Reuse StatusBoard, фильтруем actions по channelId. Chat не
          // показывается — это «room as kanban» mode.
          <StatusBoard
            serverName={`${activeServer.name} · #${selectedChannel.name}`}
            actions={serverActions.actions.filter(
              (a) => a.channelId === selectedChannel.id,
            )}
            loading={serverActions.loading}
            error={serverActions.error}
            onReload={() => void serverActions.reload()}
            currentUserId={user.id}
            channelNameById={(cid) => channelNameById(cid)}
            onUpdateStatus={(id, status) =>
              void serverActions.updateStatus(id, status)
            }
            onOpenChannel={(channelId) => {
              setSelectedChannelId(channelId);
              if (isMobile) setNavOpen(false);
            }}
            onOpenAction={(id) => setOpenActionItemId(id)}
            initialFilter={null}
          />
        ) : (
          <>
            {/* Voice mini-bar — если ты сейчас в voice, но смотришь TEXT канал */}
            {voice.activeChannelId &&
              voice.activeChannelId !== selectedChannelId &&
              (voice.state === "connected" || voice.state === "reconnecting") && (
                <VoiceMiniBar
                  voice={voice}
                  channelName={
                    channels.find((c) => c.id === voice.activeChannelId)?.name ?? "комната"
                  }
                  onOpenVoiceChannel={() => {
                    if (voice.activeChannelId) {
                      setSelectedChannelId(voice.activeChannelId);
                    }
                  }}
                />
              )}
            <SinceLastVisitBanner
              data={sinceLastVisit.data}
              onDismiss={sinceLastVisit.dismiss}
              aiSummary={sinceLastVisit.aiSummary}
              aiLoading={sinceLastVisit.aiLoading}
              aiError={sinceLastVisit.aiError}
              onRequestAiSummary={() => void sinceLastVisit.requestAiSummary()}
            />
            {/* v0.98: ActionQueueBar + PinnedBar убраны из ленты. Pavel-ask
                «при наведении отображались поверх экрана чата». Функционал
                переехал в hover-buttons chat-header'а (📌 + ✓ icons рядом с
                (i)) → preview popover на hover + full panel на click. Лента
                стала чище — chat-header → MessageList → composer, без banners. */}
            {/* v0.74 #29 phase 1: Focus mode banner — explicit affordance
                чтобы юзер не думал, что сообщения «пропали». */}
            {focus.enabled && (
              <div
                style={{
                  margin: "6px var(--ec-space-3) 0",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "var(--ec-radius-md)",
                  background: "var(--ec-accent-soft)",
                  border: "1px solid var(--ec-border-accent)",
                  color: "var(--ec-accent)",
                  fontSize: "var(--ec-text-2xs)",
                  letterSpacing: "var(--ec-tracking-caps)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span>Фокус — только меншены, закреплённые и свои</span>
                <button
                  type="button"
                  onClick={focus.toggle}
                  style={{
                    padding: "0.15rem 0.55rem",
                    borderRadius: "var(--ec-radius-sm)",
                    background: "transparent",
                    border: "1px solid var(--ec-border-accent)",
                    color: "var(--ec-accent)",
                    fontSize: "0.6rem",
                    cursor: "pointer",
                    letterSpacing: 0,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Выключить
                </button>
              </div>
            )}
            <MessageList
              messages={
                focus.enabled
                  ? messages.filter((m) => {
                      // Direct mention by display name
                      const lcContent = m.content.toLowerCase();
                      const mentioned =
                        headerName &&
                        lcContent.includes(`@${headerName.toLowerCase()}`);
                      // Pinned
                      const pinned = m.pinnedAt != null;
                      // Own message
                      const mine = m.user?.id === user.id;
                      // Bot / system messages keep
                      const bot = m.user?.isBot === true;
                      return Boolean(mentioned || pinned || mine || bot);
                    })
                  : messages
              }
              pendingBotTyping={pendingBotTyping}
              ephemeralBanner={ephemeralBanner}
              onDismissEphemeralBanner={dismissEphemeralBanner}
              emptyHint={messagesLoading ? "Загрузка…" : undefined}
              channelName={selectedChannel.name}
              channelTopBanner={activeServer?.banner ?? null}
              channelTopSubtitle={activeServer?.name ?? null}
              listKey={`channel:${selectedChannel.id}`}
              currentUserId={user.id}
              currentUserName={headerName}
              currentRole={currentRole}
              mentionNames={members.map((m) => m.user.displayName)}
              customEmojis={customEmojis}
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
                // v0.46 fix: auto-expand right rail if collapsed —
                // иначе click silent, ThreadPanel рендерится только
                // когда rightRailVisible (см. AppShell line ~446).
                // Павел report: «треды не работают» — root cause найден.
                setRightRailCollapsed(false);
                if (isTabletOrSmaller) setMembersOpen(true);
              }}
              onPlayShared={(attachmentId) => void music.start(attachmentId)}
            />
            <TypingIndicator users={typingUsers} />
            {broadcastReadOnly ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ec-space-2)",
                  padding: "var(--ec-space-3) var(--ec-space-5)",
                  margin: "var(--ec-space-2) var(--ec-space-3)",
                  borderRadius: "var(--ec-radius-md)",
                  background: "var(--ec-surface-2)",
                  border: "1px solid var(--ec-border-subtle)",
                  color: "var(--ec-text-muted)",
                  fontSize: "var(--ec-text-sm)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, color: "var(--ec-accent)" }}>
                  <path d="M3 11l15-5v12L3 13v-2z" />
                  <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
                  <path d="M21 9v6" />
                </svg>
                Это канал-вещание — публикуют только владелец и модераторы. Ты подписан и видишь все публикации.
              </div>
            ) : (
              <MessageInput
                channelName={selectedChannel.name}
                draftKey={`channel:${selectedChannel.id}`}
                disabled={!isReady}
                hideSlashCommands={isClientMode}
                mentionNames={members.map((m) => m.user.displayName)}
                customEmojis={customEmojis}
                onSend={(content, attachments, actionItem) =>
                  sendMessage(content, senderForMessages, attachments, actionItem)
                }
                onTypingStart={emitTypingStart}
                onTypingStop={emitTypingStop}
                prefillContent={share.pendingContent}
                onPrefillConsumed={share.consume}
                prefillFiles={share.pendingFiles}
                onPrefillFilesConsumed={share.consumeFiles}
              />
            )}
          </>
        )}
        </Suspense>
      </section>

      {showRightRail && rightRailCollapsed && !isTabletOrSmaller && (
        <button
          type="button"
          className="ec-rail-expand"
          onClick={() => setRightRailCollapsed(false)}
          aria-label="Развернуть панель участников"
          title="Развернуть панель"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {rightRailVisible && (
        <div className="ec-shell__members">
          {/* v1.5.27 — right rail trio (Thread/Incident/IntelligencePanel)
           * под Suspense; ThreadPanel + IncidentPanel lazy, IntelligencePanel
           * eager (всегда default). */}
          <Suspense fallback={null}>
          {selectedThreadId ? (
            <ThreadPanel
              rootId={selectedThreadId}
              socket={socket}
              currentUser={user}
              currentUserName={headerName}
              currentUserAvatar={headerAvatar}
              mentionNames={members.map((m) => m.user.displayName)}
              customEmojis={customEmojis}
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
            <IntelligencePanel
              members={members}
              membersLoading={membersLoading}
              membersError={membersError}
              voiceChannelByUser={voiceChannelByUser}
              channelNameById={channelNameById}
              currentUserId={user.id}
              onClose={isTabletOrSmaller ? () => setMembersOpen(false) : undefined}
              onCollapse={isTabletOrSmaller ? undefined : () => setRightRailCollapsed(true)}
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
          </Suspense>
        </div>
      )}

      {/* v1.5.27 — modals section under one outer Suspense.
       * Все 12 lazy-modal'ов условно рендерятся (по флагам). Они typically
       * не co-render'ятся одновременно (один open at a time), потому единая
       * Suspense с fallback={null} даёт чистый UX без визуальных blip'ов.
       * StatusMenu (line ~2230) — единственный non-lazy, инсайд скоупа OK. */}
      <Suspense fallback={null}>
      {openActionItemId && (
        <ActionItemDrawer
          actionItemId={openActionItemId}
          socket={socket}
          currentUserId={user.id}
          members={members.map((m) => ({
            userId: m.userId,
            user: { displayName: m.user.displayName, avatar: m.user.avatar },
          }))}
          channelNameById={(cid) => channelNameById(cid) ?? null}
          onClose={() => setOpenActionItemId(null)}
          onJumpToSource={(channelId, _messageId) => {
            setOpenActionItemId(null);
            setStatusBoardOpen(false);
            setSelectedChannelId(channelId);
            if (isMobile) setNavOpen(false);
          }}
          serverActions={
            activeServerId ? serverActions.actions : undefined
          }
        />
      )}

      {showVoiceMusicPicker && activeServerId && (
        <VoiceMusicPicker
          serverId={activeServerId}
          onClose={() => setShowVoiceMusicPicker(false)}
          onPick={async (attachmentId) => {
            const ok = await music.start(attachmentId);
            return ok;
          }}
        />
      )}

      {showMusicExpand && music.session && (
        <MusicExpandModal
          session={music.session}
          derivedPositionMs={music.derivedPositionMs}
          currentUserId={user.id}
          library={musicLibrary.tracks}
          libraryLoading={musicLibrary.loading}
          onClose={() => setShowMusicExpand(false)}
          onTogglePlayPause={() => void music.togglePlayPause()}
          onSkip={() => void music.skip()}
          onSeek={(ms) => void music.seek(ms)}
          onStop={() => void music.stop()}
          onStartTrack={(id) => void music.start(id)}
          onAddToQueue={(id) => void music.addToQueue(id)}
          onStartPlaylist={(ids) => void music.startPlaylist(ids)}
        />
      )}

      {showCreateTable && (
        <CreateTableModal
          onClose={() => setShowCreateTable(false)}
          onCreate={async (templateId, name) => {
            // v0.70: blank template = legacy create (single «Название» field),
            // другие — серверный from-template endpoint с pre-seeded полями.
            const id =
              templateId === "blank"
                ? await createOpTable(name)
                : await createOpTableFromTemplate(templateId, name);
            if (id) {
              setHomeOpen(false);
              setStatusBoardOpen(false);
              setTeamHealthOpen(false);
              setSelectedTableId(id);
              return true;
            }
            return false;
          }}
        />
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

      {createGroupOpen && (
        <CreateGroupDmModal
          availableUsers={members.map<AvailableUser>((m) => ({
            id: m.userId,
            displayName: m.user.displayName,
            avatar: m.user.avatar,
          }))}
          currentUserId={user.id}
          onClose={() => setCreateGroupOpen(false)}
          onCreate={async (memberUserIds, name) => {
            const id = await createGroupDm(memberUserIds, name);
            if (id) {
              setHomeOpen(false);
              if (isMobile) setNavOpen(false);
            }
            return id;
          }}
        />
      )}

      {serverHubOpen && activeServer && (
        <ServerHubModal
          server={activeServer}
          members={members}
          currentUserId={user.id}
          initialTab={serverHubTab}
          onClose={() => setServerHubOpen(false)}
          onLeave={() => leaveServer(activeServer.id)}
          onDelete={() => deleteServer(activeServer.id)}
          onUploadIcon={(file) => uploadServerIcon(activeServer.id, file)}
          onDeleteIcon={() => deleteServerIcon(activeServer.id)}
          onUpdateRole={updateMemberRole}
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

      {platformAdminOpen && user.isPlatformOwner === true && (
        <PlatformAdminPanel
          onClose={() => setPlatformAdminOpen(false)}
          currentUserId={user.id}
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
        // v0.47: Internal toggle видим OWNER/ADMIN/MOD В ЛЮБОМ server'е
        // (mode=ENGINEERING прячет channel только когда server переключат в CLIENT).
        const canMod =
          currentRole === "OWNER" ||
          currentRole === "ADMIN" ||
          currentRole === "MODERATOR";
        return (
          <ChannelSettingsModal
            channel={ch}
            onClose={() => setSettingsChannelId(null)}
            onUpdate={(patch) => updateChannel(ch.id, patch)}
            showInternalToggle={canMod}
          />
        );
      })()}

      {showSearch && activeServerId && (
        <SearchOverlay
          query={searchQuery}
          setQuery={setSearchQuery}
          filters={searchFilters}
          onChangeFilters={setSearchFilters}
          channels={channels.map((c) => ({ id: c.id, name: c.name }))}
          results={searchResults}
          loading={searchLoading}
          error={searchError}
          onSelectMessage={(hit) => {
            // Переключаемся на канал hit + закрываем overlay.
            setHomeOpen(false);
            setSelectedChannelId(hit.channel.id);
            setShowSearch(false);
            searchReset();
          }}
          onSelectAction={(hit) => {
            // Открываем ActionItemDrawer над текущим контекстом.
            setShowSearch(false);
            searchReset();
            setOpenActionItemId(hit.id);
          }}
          onSelectFile={(hit) => {
            // Прыгаем в канал-источник файла; lightbox откроется при клике
            // на attachment в чате (v1 — без deep-link на конкретное message).
            setHomeOpen(false);
            setSelectedChannelId(hit.channel.id);
            setShowSearch(false);
            searchReset();
          }}
          onClose={() => {
            setShowSearch(false);
            searchReset();
          }}
          semanticServerId={activeServerId}
        />
      )}
      </Suspense>
    </div>
  );
}
