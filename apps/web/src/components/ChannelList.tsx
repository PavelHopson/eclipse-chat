import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { CategoryCreateModal } from "./CategoryCreateModal";
import { CreateChannelModal } from "./CreateChannelModal";
import { ChannelGlyph } from "./icons/ChannelCustomIcons";
import { ServerActionsMenu } from "./server/ServerActionsMenu";
import type { CategoryRow, ChannelRow } from "../hooks/useChannels";
import type { MemberRow } from "../hooks/useMembers";
import type { ChannelType, VoiceMeta } from "../lib/socket";
import { resolveAssetUrl } from "../lib/assets";

/** v0.96 UX refactor: sidebar разделён на 3 таба. Persist active tab
 *  per-server в localStorage. */
type SidebarTab = "channels" | "work" | "tables";

type Props = {
  /** v0.96: serverId для per-server-persisted sidebarTab. */
  serverId: string | null;
  serverName: string | null;
  serverRole: string | null;
  inviteCode: string | null;
  /**
   * v1.5.33 — server banner image path. null = нет банера, рендерим
   * compact header без background-image (backward compat). When set —
   * header принимает cinematic-style cover-фон 1500×500 webp, text
   * получает shadow для read на любом изображении.
   */
  serverBanner?: string | null;
  channels: ChannelRow[];
  categories: CategoryRow[];
  /** Channels async loading state (после server-switch до GET ответа). */
  channelsLoading?: boolean;
  unread: Record<string, number>;
  selectedChannelId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, type: ChannelType, categoryId?: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  /** Открыть ChannelSettingsModal. Скрывает кнопку если не передано. */
  onOpenSettings?: (channelId: string) => void;
  /** Batch reorder каналов через drag-drop. Скрывает DnD если не передано. */
  onReorder?: (order: { id: string; position: number }[]) => Promise<boolean>;
  onCreateCategory?: (name: string) => Promise<CategoryRow | null>;
  onRenameCategory?: (categoryId: string, name: string) => Promise<boolean>;
  onDeleteCategory?: (categoryId: string) => Promise<boolean>;
  onReorderCategories?: (orders: { id: string; position: number }[]) => Promise<boolean>;
  onMoveChannel?: (channelId: string, categoryId: string | null, position?: number) => Promise<boolean>;
  onShowServerInfo: () => void;
  onOpenServerSettings?: () => void;
  onOpenServerInvite?: () => void;
  onOpenServerNotifications?: () => void;
  onOpenServerIncident?: () => void;
  onLeaveServer?: () => Promise<boolean>;
  /** Открыть Execution Status Board (доска задач сервера). */
  onOpenStatusBoard?: () => void;
  /** Status Board сейчас открыт — для подсветки. */
  statusBoardActive?: boolean;
  /** Открыть «Здоровье команды» — team-wide aggregate поверх ActionItem. */
  onOpenTeamHealth?: () => void;
  /** Team Health сейчас открыт — для подсветки. */
  teamHealthActive?: boolean;
  /**
   * v0.83 #24 phase 1: server mode. Если CLIENT — отображаем
   * «Клиентский портал» entry в Overview-группе. На ENGINEERING — скрываем.
   */
  serverMode?: "ENGINEERING" | "CLIENT";
  /** v0.83 #24 phase 1: открыть клиентский портал. */
  onOpenClientPortal?: () => void;
  /** v0.85 #27 phase 4: muted channel ids (per-user). Если undefined —
   *  feature не активен и UI скрывает bell-toggle. */
  mutedChannels?: ReadonlySet<string>;
  /** v0.85 #27 phase 4: toggle mute. */
  onToggleMute?: (channelId: string, mute: boolean) => void;
  /** v0.59 phase 1: список таблиц активного пространства. */
  tables?: Array<{ id: string; name: string; rowCount: number }>;
  /** Открыть Operational Table panel по id. */
  onOpenTable?: (tableId: string) => void;
  /** Создать новую таблицу. */
  onCreateTable?: () => void;
  /** Активная таблица (для подсветки в list). */
  activeTableId?: string | null;
  /** Кто сейчас в каком VOICE-канале — для sticky-списка под каналом. */
  voiceByChannel?: Record<string, string[]>;
  /** Mic/deafen-состояние участников эфира — для Discord-style иконок. */
  voiceMetaByUser?: Record<string, VoiceMeta>;
  /** Members активного сервера — для avatar+name lookup. */
  members?: MemberRow[];
  /**
   * Кто сейчас говорит — userId → true. Покрывает ВСЕ voice-каналы:
   * свою комнату из локального LiveKit ActiveSpeakers, чужие — из backend
   * broadcast (`voice:participant:speaking`). Мержится в AppShell.
   */
  speakingUserIds?: Set<string>;
};

// v1.1.91 slice 2: inline-style консоли ChannelList вынесены в классы
// .ec-channel-list* / .ec-channel-action / .ec-section-add / .ec-sidebar-tab*
// (components.css). JS-hover убран — состояния через CSS.

function roleClass(role: string): string {
  if (role === "OWNER") return "ec-badge ec-badge--owner";
  if (role === "ADMIN" || role === "MODERATOR") return "ec-badge ec-badge--accent";
  return "ec-badge";
}

function canManage(role: string | null): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Edit channel name/description. Включает MODERATOR (отличается от delete). */
function canEditChannel(role: string | null): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

/** Перечёркнутый микрофон — участник эфира с выключенным микрофоном. */
function MicOffGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

/** Перечёркнутые наушники — участник эфира заглушил весь звук (deafened). */
function DeafenedGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M3 14v-3a9 9 0 0 1 14.31-7.24M21 13v1a2 2 0 0 1-.18.83" />
      <path d="M21 15a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3M3 14a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5" />
    </svg>
  );
}

export function ChannelList({
  serverId,
  serverName,
  serverBanner = null,
  serverRole,
  inviteCode: _inviteCode,
  channels,
  categories,
  channelsLoading,
  unread,
  selectedChannelId,
  onSelect,
  onCreate,
  onDelete,
  onOpenSettings,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onMoveChannel,
  onShowServerInfo,
  onOpenServerSettings,
  onOpenServerInvite,
  onOpenServerNotifications,
  onOpenServerIncident,
  onLeaveServer,
  onOpenStatusBoard,
  statusBoardActive,
  onOpenTeamHealth,
  teamHealthActive,
  serverMode,
  onOpenClientPortal,
  mutedChannels,
  onToggleMute,
  tables,
  onOpenTable,
  onCreateTable,
  activeTableId,
  voiceByChannel,
  voiceMetaByUser,
  members,
  speakingUserIds,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dropTargetCategoryId, setDropTargetCategoryId] = useState<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);
  const [categoryModal, setCategoryModal] = useState<
    | { mode: "create" }
    | { mode: "rename"; category: CategoryRow }
    | null
  >(null);
  const [categoryMenu, setCategoryMenu] = useState<{
    category: CategoryRow;
    x: number;
    y: number;
  } | null>(null);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const serverTriggerRef = useRef<HTMLButtonElement | null>(null);
  // v0.97: CreateChannelModal state. Открывается через primary button
  // сверху Channels tab + через «+» icon в каждом section-header'е
  // (pre-selected тип через initialType).
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<ChannelType>("TEXT");
  const [createModalCategoryId, setCreateModalCategoryId] = useState<string | null>(null);
  const openCreateModal = (type: ChannelType, categoryId: string | null = null) => {
    setCreateModalType(type);
    setCreateModalCategoryId(categoryId);
    setCreateModalOpen(true);
  };
  // v0.96: sidebar tab state — Каналы / Работа / Таблицы. Per-server
  // persistence в localStorage (key `ec:sidebar-tab:<serverId>`).
  const sidebarKey = serverId ? `ec:sidebar-tab:${serverId}` : null;
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
    if (typeof window === "undefined" || !sidebarKey) return "channels";
    const saved = window.localStorage.getItem(sidebarKey);
    if (saved === "channels" || saved === "work" || saved === "tables") return saved;
    return "channels";
  });
  // Перечитать saved tab при смене сервера.
  useEffect(() => {
    if (typeof window === "undefined" || !sidebarKey) {
      setSidebarTab("channels");
      return;
    }
    const saved = window.localStorage.getItem(sidebarKey);
    setSidebarTab(
      saved === "channels" || saved === "work" || saved === "tables"
        ? saved
        : "channels",
    );
  }, [sidebarKey]);
  // Save on change.
  useEffect(() => {
    if (typeof window === "undefined" || !sidebarKey) return;
    window.localStorage.setItem(sidebarKey, sidebarTab);
  }, [sidebarKey, sidebarTab]);

  const manageable = canManage(serverRole);
  const editable = canEditChannel(serverRole);
  const canDragChannels = editable && Boolean(onMoveChannel);
  const canDragCategories = manageable && Boolean(onReorderCategories);

  // v0.74 #16: EXECUTION channels группируются с TEXT (это "operational
  // rooms"), отличаются только icon + рендер mode'ом в AppShell.
  const textChannels = channels.filter(
    (c) => c.type === "TEXT" || c.type === "EXECUTION",
  );
  const broadcastChannels = channels.filter((c) => c.type === "BROADCAST");
  const voiceChannels = channels.filter((c) => c.type === "VOICE");
  const collapsedStorageKey = serverId ? `ec.channelList.collapsed.${serverId}` : null;
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(new Set());
  const collapsePersistTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !collapsedStorageKey) {
      setCollapsedCategoryIds(new Set());
      return;
    }
    try {
      const raw = window.localStorage.getItem(collapsedStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      setCollapsedCategoryIds(new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []));
    } catch {
      setCollapsedCategoryIds(new Set());
    }
  }, [collapsedStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !collapsedStorageKey) return;
    if (collapsePersistTimer.current) window.clearTimeout(collapsePersistTimer.current);
    collapsePersistTimer.current = window.setTimeout(() => {
      window.localStorage.setItem(collapsedStorageKey, JSON.stringify([...collapsedCategoryIds]));
    }, 200);
    return () => {
      if (collapsePersistTimer.current) window.clearTimeout(collapsePersistTimer.current);
    };
  }, [collapsedCategoryIds, collapsedStorageKey]);

  useEffect(() => {
    if (!categoryMenu) return;
    const close = () => setCategoryMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [categoryMenu]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "ru")),
    [categories],
  );
  const sortedChannels = useMemo(
    () => [...channels].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "ru")),
    [channels],
  );
  const uncategorizedChannels = useMemo(
    () => sortedChannels.filter((c) => !c.categoryId),
    [sortedChannels],
  );
  const channelsByCategory = useMemo(() => {
    const map = new Map<string, ChannelRow[]>();
    for (const category of sortedCategories) map.set(category.id, []);
    for (const channel of sortedChannels) {
      if (!channel.categoryId) continue;
      map.set(channel.categoryId, [...(map.get(channel.categoryId) ?? []), channel]);
    }
    return map;
  }, [sortedCategories, sortedChannels]);
  const createModalCategoryName =
    createModalCategoryId === null
      ? null
      : sortedCategories.find((category) => category.id === createModalCategoryId)?.name ?? null;

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const applyCategoryReorder = async (sourceId: string, targetId: string) => {
    if (!onReorderCategories || sourceId === targetId) return;
    const fromIdx = sortedCategories.findIndex((category) => category.id === sourceId);
    const toIdx = sortedCategories.findIndex((category) => category.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const moved = sortedCategories.slice();
    const [removed] = moved.splice(fromIdx, 1);
    moved.splice(toIdx, 0, removed);
    await onReorderCategories(moved.map((category, index) => ({ id: category.id, position: index * 10 })));
  };

  const applyChannelMove = async (
    sourceId: string,
    targetCategoryId: string | null,
    targetId: string | null,
  ) => {
    if (!onMoveChannel) return;
    const source = channels.find((channel) => channel.id === sourceId);
    if (!source) return;
    const group = sortedChannels.filter((channel) => (channel.categoryId ?? null) === targetCategoryId && channel.id !== sourceId);
    const toIdx = targetId ? group.findIndex((channel) => channel.id === targetId) : group.length;
    const moved = group.slice();
    moved.splice(toIdx < 0 ? group.length : toIdx, 0, { ...source, categoryId: targetCategoryId });
    for (let index = 0; index < moved.length; index += 1) {
      const channel = moved[index];
      const nextPosition = index * 10;
      if (channel.id === sourceId || channel.position !== nextPosition) {
        const ok = await onMoveChannel(channel.id, targetCategoryId, nextPosition);
        if (!ok) break;
      }
    }
  };

  const handleDelete = async (channelId: string, channelName: string) => {
    if (!window.confirm(`Удалить комнату «${channelName}»? Все сообщения внутри будут потеряны.`)) {
      return;
    }
    setPendingDelete(channelId);
    try {
      await onDelete(channelId);
    } finally {
      setPendingDelete(null);
    }
  };

  // v1.5.19 — Sticky-список голосовых участников под voice-каналом
  // (Discord-style). Visible для ВСЕХ server members через server-wide
  // `voice:state` snapshot + `voice:participant:joined/left` delta events.
  // Inline-styles переведены на `.ec-voice-occupant-*` classes (player.css)
  // с premium polish: accent border-left + hover halo + speaking ring breath.
  const renderVoiceOccupants = (channelId: string) => {
    const userIds = voiceByChannel?.[channelId];
    if (!userIds || userIds.length === 0) return null;
    return (
      <div className="ec-voice-occupant-list">
        {userIds.map((userId) => {
          const m = members?.find((mm) => mm.userId === userId);
          const name = m?.user.displayName ?? userId;
          const avatar = m?.user.avatar ?? null;
          const speaking = speakingUserIds?.has(userId) ?? false;
          const meta = voiceMetaByUser?.[userId];
          const deafened = Boolean(meta?.deafened);
          // deafened подразумевает mic off — показываем один значок (наушники).
          const micMuted = Boolean(meta?.micMuted) && !deafened;
          const stateLabel = deafened
            ? "звук выключен"
            : micMuted
            ? "микрофон выключен"
            : speaking
            ? "говорит"
            : "в эфире";
          const rowClass =
            "ec-voice-occupant-row" +
            (speaking ? " ec-voice-occupant-row--speaking" : "") +
            (deafened || micMuted ? " ec-voice-occupant-row--muted" : "");
          return (
            <span key={userId} title={`${name} — ${stateLabel}`} className={rowClass}>
              <span className="ec-voice-occupant-row__avatar">
                <Avatar url={avatar} name={name} size={16} />
              </span>
              <span className="ec-voice-occupant-row__name">{name}</span>
              {(deafened || micMuted) && (
                <span
                  aria-hidden
                  className="ec-voice-occupant-row__state"
                  data-state={deafened ? "deafened" : "muted"}
                >
                  {deafened ? <DeafenedGlyph /> : <MicOffGlyph />}
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const renderChannel = (c: ChannelRow) => {
    const isActive = c.id === selectedChannelId;
    const isDeleting = pendingDelete === c.id;
    const unreadCount = unread[c.id] ?? 0;
    const hasUnread = unreadCount > 0 && !isActive;
    const isDragged = draggedId === c.id;
    const isDropTarget = dropTargetId === c.id && draggedId && draggedId !== c.id;
    return (
      <button
        key={c.id}
        type="button"
        draggable={canDragChannels && !isDeleting}
        onDragStart={(e) => {
          if (!canDragChannels) return;
          setDraggedId(c.id);
          e.dataTransfer.effectAllowed = "move";
          // Some browsers required для actual drag start
          e.dataTransfer.setData("text/plain", c.id);
        }}
        onDragOver={(e) => {
          if (!draggedId || draggedId === c.id) return;
          // Reorder только внутри своего type'а
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dropTargetId !== c.id) setDropTargetId(c.id);
        }}
        onDragLeave={(e) => {
          // Только если actually выходим из элемента
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          if (dropTargetId === c.id) setDropTargetId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const src = draggedId;
          setDraggedId(null);
          setDropTargetId(null);
          if (src && src !== c.id) {
            void applyChannelMove(src, c.categoryId ?? null, c.id);
          }
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setDropTargetId(null);
        }}
        onClick={() => {
          if (draggedId) return;
          onSelect(c.id);
        }}
        className={isActive ? "ec-channel-item ec-channel-item--active" : "ec-channel-item"}
        style={{
          ...(isDeleting ? { opacity: 0.5, pointerEvents: "none" } : undefined),
          ...(hasUnread ? { color: "var(--ec-text-strong)", fontWeight: 600 } : undefined),
          ...(isDragged ? { opacity: 0.4 } : undefined),
          ...(isDropTarget
            ? { boxShadow: "inset 0 2px 0 0 var(--ec-accent), inset 0 -2px 0 0 var(--ec-accent)" }
            : undefined),
          cursor: canDragChannels ? "grab" : "pointer",
        }}
      >
        <ChannelGlyph type={c.type} icon={c.emoji} />
        <span className="ec-channel-item__name">{c.name}</span>
        {c.internal && (
          <span
            aria-label="Внутренняя комната — скрыта от клиентов"
            title="Внутренняя: скрыта от MEMBER в Client mode пространстве"
            style={{
              display: "inline-flex",
              alignItems: "center",
              color: "var(--ec-warn)",
              opacity: 0.7,
              flexShrink: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </span>
        )}
        {hasUnread && (
          <span
            className="ec-unread-badge"
            aria-label={`${unreadCount} непрочитанных`}
            title={`${unreadCount} непрочитанных`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {!hasUnread && !isActive && c.type === "TEXT" && c._count.messages > 0 && (
          <span className="ec-channel-count">{c._count.messages}</span>
        )}
        {onToggleMute && mutedChannels && (() => {
          const isMuted = mutedChannels.has(c.id);
          return (
            <span
              role="button"
              tabIndex={0}
              className={
                "ec-channel-action" +
                (isMuted ? " ec-channel-action--shown" : "")
              }
              aria-label={isMuted ? `Снять заглушку с ${c.name}` : `Заглушить ${c.name}`}
              title={isMuted ? "Заглушено — клик чтобы вернуть push" : "Заглушить push"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute(c.id, !isMuted);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleMute(c.id, !isMuted);
                }
              }}
            >
              {isMuted ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
                  <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              )}
            </span>
          );
        })()}
        {editable && onOpenSettings && (
          <span
            role="button"
            tabIndex={0}
            className="ec-channel-action"
            aria-label={`Настройки комнаты ${c.name}`}
            title="Редактировать комнату"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings(c.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onOpenSettings(c.id);
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </span>
        )}
        {manageable && (
          <span
            role="button"
            tabIndex={0}
            className="ec-channel-action ec-channel-action--danger"
            aria-label={`Удалить комнату ${c.name}`}
            title="Удалить комнату"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete(c.id, c.name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                void handleDelete(c.id, c.name);
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
            </svg>
          </span>
        )}
        {editable && onMoveChannel && (
          <select
            className="ec-channel-move-select"
            value={c.categoryId ?? ""}
            aria-label={`Переместить ${c.name}`}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              const nextCategoryId = e.target.value || null;
              void onMoveChannel(c.id, nextCategoryId);
            }}
          >
            <option value="">Без категории</option>
            {sortedCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </button>
    );
  };

  const renderChannelDropZone = (categoryId: string | null, empty: boolean) => (
    <div
      className={
        "ec-channel-category__drop" +
        (dropGroupId === (categoryId ?? "__uncategorized__") ? " ec-channel-category__drop--active" : "") +
        (empty ? " ec-channel-category__drop--empty" : "")
      }
      onDragOver={(e) => {
        if (!draggedId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropGroupId(categoryId ?? "__uncategorized__");
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDropGroupId(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const sourceId = draggedId;
        setDraggedId(null);
        setDropGroupId(null);
        if (sourceId) void applyChannelMove(sourceId, categoryId, null);
      }}
    >
      {empty ? "Перетащите комнату сюда" : ""}
    </div>
  );

  const renderCategory = (category: CategoryRow) => {
    const group = channelsByCategory.get(category.id) ?? [];
    const collapsed = collapsedCategoryIds.has(category.id);
    const isDropTarget = dropTargetCategoryId === category.id && draggedCategoryId !== category.id;
    return (
      <section
        key={category.id}
        className={
          "ec-channel-category" +
          (collapsed ? " ec-channel-category--collapsed" : "") +
          (isDropTarget ? " ec-channel-category--drop-target" : "")
        }
      >
        <button
          type="button"
          className="ec-channel-category__header"
          aria-expanded={!collapsed}
          draggable={canDragCategories}
          onClick={() => toggleCategory(category.id)}
          onContextMenu={(e) => {
            if (!manageable) return;
            e.preventDefault();
            setCategoryMenu({ category, x: e.clientX, y: e.clientY });
          }}
          onDragStart={(e) => {
            if (!canDragCategories) return;
            setDraggedCategoryId(category.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", category.id);
          }}
          onDragOver={(e) => {
            if (!draggedCategoryId || draggedCategoryId === category.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDropTargetCategoryId(category.id);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDropTargetCategoryId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const sourceId = draggedCategoryId;
            setDraggedCategoryId(null);
            setDropTargetCategoryId(null);
            if (sourceId) void applyCategoryReorder(sourceId, category.id);
          }}
          onDragEnd={() => {
            setDraggedCategoryId(null);
            setDropTargetCategoryId(null);
          }}
        >
          <span className="ec-channel-category__chevron" aria-hidden>
            ▶
          </span>
          <span className="ec-channel-category__name">{category.name}</span>
          <span className="ec-channel-category__count">{group.length}</span>
          {editable && (
            <span
              role="button"
              tabIndex={0}
              className="ec-channel-category__add"
              title="Создать комнату в категории"
              aria-label={`Создать комнату в категории ${category.name}`}
              onClick={(e) => {
                e.stopPropagation();
                openCreateModal("TEXT", category.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  openCreateModal("TEXT", category.id);
                }
              }}
            >
              +
            </span>
          )}
        </button>
        {!collapsed && (
          <div className="ec-channel-category__body">
            {group.map((channel) => (
              <div key={channel.id}>
                {renderChannel(channel)}
                {channel.type === "VOICE" && renderVoiceOccupants(channel.id)}
              </div>
            ))}
            {renderChannelDropZone(category.id, group.length === 0)}
          </div>
        )}
      </section>
    );
  };

  // v1.5.33 — banner cover for rail header. resolveAssetUrl wraps в
  // BASE_URL чтобы prod path-based deploy (/eclipse-chat/) работал.
  const bannerUrl = serverBanner ? resolveAssetUrl(serverBanner) : null;
  const headerClass = bannerUrl
    ? "ec-server-header-edge ec-channel-list__header ec-channel-list__header--banner"
    : "ec-server-header-edge ec-channel-list__header";
  const headerStyle: CSSProperties | undefined = bannerUrl
    ? { backgroundImage: `url("${bannerUrl}")` }
    : undefined;

  return (
    <aside className="ec-channel-list">
      <header className={headerClass} style={headerStyle}>
        <button
          ref={serverTriggerRef}
          type="button"
          onClick={() => setServerMenuOpen((value) => !value)}
          className="ec-channel-list__server-btn ec-server-header-trigger"
          title="Действия пространства"
          aria-haspopup="menu"
          aria-expanded={serverMenuOpen}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span className="ec-channel-list__server-name">
              {serverName ?? "Нет пространства"}
            </span>
            {serverRole && (
              <span
                className={roleClass(serverRole)}
                style={{ alignSelf: "flex-start" }}
              >
                {serverRole}
              </span>
            )}
          </span>
          <svg
            className="ec-server-header-chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {serverId && serverName && (
          <ServerActionsMenu
            open={serverMenuOpen}
            triggerRef={serverTriggerRef}
            server={{ id: serverId, name: serverName, role: serverRole ?? "MEMBER" }}
            onClose={() => setServerMenuOpen(false)}
            onOpenSettings={onOpenServerSettings ?? onShowServerInfo}
            onOpenInvite={onOpenServerInvite ?? onShowServerInfo}
            onOpenNotifications={onOpenServerNotifications ?? onShowServerInfo}
            onCreateChannel={() => openCreateModal("TEXT", null)}
            onCreateCategory={() => setCategoryModal({ mode: "create" })}
            onOpenIncident={onOpenServerIncident ?? onShowServerInfo}
            onLeaveServer={onLeaveServer ?? (async () => false)}
          />
        )}
      </header>

      {/* v0.96 sidebar tabs: Каналы / Работа / Таблицы. Расщепляет старый
          plain list ("Доска задач" + "Здоровье" + "Таблицы" + 3 группы каналов
          подряд) на 3 contextual surfaces. Persisted per-server. */}
      <div
        className="ec-sidebar-tabs"
        role="tablist"
        aria-label="Разделы пространства"
      >
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "channels"}
          onClick={() => setSidebarTab("channels")}
          className="ec-sidebar-tab ec-hud-tab"
          title="Каналы — текстовые, broadcast, голосовые"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-4l-3 4-3-4z" />
          </svg>
          <span>КАНАЛЫ</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "work"}
          onClick={() => setSidebarTab("work")}
          className="ec-sidebar-tab ec-hud-tab"
          title="Работа — доска задач, здоровье команды"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <span>ЗАДАЧИ</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "tables"}
          onClick={() => setSidebarTab("tables")}
          className="ec-sidebar-tab ec-hud-tab"
          title="Таблицы — operational tables"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <span>ДАННЫЕ</span>
          {tables !== undefined && tables.length > 0 && (
            <span className="ec-sidebar-tab__count">{tables.length}</span>
          )}
        </button>
        {/* v1.1.28 Active Navbar Indicator — скользящий cyan-бар под
            активным табом (channels=0 / work=1 / tables=2). */}
        <span
          className="ec-hud-slider"
          aria-hidden
          style={
            {
              "--ec-tab-idx":
                sidebarTab === "channels" ? 0 : sidebarTab === "work" ? 1 : 2,
            } as CSSProperties
          }
        />
      </div>

      <div className="ec-channel-list__list">
        {sidebarTab === "work" && (
          <>
            {onOpenStatusBoard && (
              <button
                type="button"
                onClick={onOpenStatusBoard}
                className={
                  statusBoardActive
                    ? "ec-channel-item ec-channel-item--active"
                    : "ec-channel-item"
                }
                title="Доска задач — все task / decision / follow-up пространства"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="7" height="9" rx="1" />
                  <rect x="14" y="3" width="7" height="5" rx="1" />
                  <rect x="14" y="12" width="7" height="9" rx="1" />
                  <rect x="3" y="16" width="7" height="5" rx="1" />
                </svg>
                <span style={{ flex: 1, minWidth: 0 }}>Доска задач</span>
              </button>
            )}
            {onOpenTeamHealth && (
              <button
                type="button"
                onClick={onOpenTeamHealth}
                className={
                  teamHealthActive
                    ? "ec-channel-item ec-channel-item--active"
                    : "ec-channel-item"
                }
                title="Здоровье команды — сводка по нагрузке и срокам"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span style={{ flex: 1, minWidth: 0 }}>Здоровье команды</span>
              </button>
            )}
            {serverMode === "CLIENT" && onOpenClientPortal && (
              <button
                type="button"
                onClick={onOpenClientPortal}
                className="ec-channel-item"
                title="Клиентский портал — прогресс проекта, одобрения, файлы"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
                <span style={{ flex: 1, minWidth: 0 }}>Клиентский портал</span>
              </button>
            )}
            {!onOpenStatusBoard && !onOpenTeamHealth && (
              <p className="ec-channel-list__hint">
                Доска задач и здоровье команды появятся когда в пространстве
                будет хотя бы одна задача.
              </p>
            )}
          </>
        )}

        {sidebarTab === "tables" && (
          <>
            {tables === undefined || onOpenTable === undefined ? (
              <p className="ec-channel-list__hint">
                Operational Tables недоступны в этом контексте.
              </p>
            ) : tables.length === 0 ? (
              <p className="ec-channel-list__hint">
                Задачи, CRM, leads — что угодно. Нажми «+ Новая таблица» внизу.
              </p>
            ) : (
              tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTable(t.id)}
                  className={
                    activeTableId === t.id
                      ? "ec-channel-item ec-channel-item--active"
                      : "ec-channel-item"
                  }
                  title={t.name}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.name}
                  </span>
                  {t.rowCount > 0 && (
                    <span className="ec-channel-count">{t.rowCount}</span>
                  )}
                </button>
              ))
            )}
          </>
        )}

        {sidebarTab === "channels" && (
          <>
            {!channelsLoading && channels.length > 0 && (
              <div className="ec-channel-category-stack">
                <section className="ec-channel-category ec-channel-category--uncategorized">
                  <div className="ec-section-label ec-channel-category__uncategorized-label">
                    <span className="ec-section-label--diamond">
                      <span>БЕЗ КАТЕГОРИИ</span>
                      <span className="ec-channel-section__count">{uncategorizedChannels.length}</span>
                    </span>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => openCreateModal("TEXT", null)}
                        title="Создать комнату без категории"
                        aria-label="Создать комнату без категории"
                        className="ec-section-add"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="ec-channel-category__body">
                    {uncategorizedChannels.map((channel) => (
                      <div key={channel.id}>
                        {renderChannel(channel)}
                        {channel.type === "VOICE" && renderVoiceOccupants(channel.id)}
                      </div>
                    ))}
                    {renderChannelDropZone(null, uncategorizedChannels.length === 0)}
                  </div>
                </section>
                {sortedCategories.map(renderCategory)}
                {manageable && onCreateCategory && (
                  <button
                    type="button"
                    className="ec-channel-category-create"
                    onClick={() => setCategoryModal({ mode: "create" })}
                  >
                    + Создать категорию
                  </button>
                )}
              </div>
            )}

            {false && textChannels.length > 0 && (
              <>
                <div className="ec-section-label">
                  <span className="ec-section-label--diamond">
                    <span>ПОТОКИ ДАННЫХ</span>
                    <span className="ec-channel-section__count">{textChannels.length}</span>
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => openCreateModal("TEXT")}
                      title="Создать текстовую комнату"
                      aria-label="Создать текстовую комнату"
                      className="ec-section-add"
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="ec-reveal-cascade">{textChannels.map(renderChannel)}</div>
              </>
            )}

            {false && broadcastChannels.length > 0 && (
              <>
                <div
                  className="ec-section-label"
                  style={{
                    marginTop: textChannels.length > 0 ? "var(--ec-space-4)" : 0,
                  }}
                >
                  <span className="ec-section-label--diamond">
                    <span>ВЕЩАНИЕ</span>
                    <span className="ec-channel-section__count">{broadcastChannels.length}</span>
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => openCreateModal("BROADCAST")}
                      title="Создать канал-вещание"
                      aria-label="Создать канал-вещание"
                      className="ec-section-add"
                    >
                      +
                    </button>
                  )}
                </div>
                {broadcastChannels.map(renderChannel)}
              </>
            )}

            {false && voiceChannels.length > 0 && (
              <>
                <div
                  className="ec-section-label"
                  style={{
                    marginTop:
                      textChannels.length > 0 || broadcastChannels.length > 0
                        ? "var(--ec-space-4)"
                        : 0,
                  }}
                >
                  <span className="ec-section-label--diamond">
                    <span>ГОЛОСОВЫЕ СВЯЗИ</span>
                    <span className="ec-channel-section__count">{voiceChannels.length}</span>
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => openCreateModal("VOICE")}
                      title="Создать голосовую комнату"
                      aria-label="Создать голосовую комнату"
                      className="ec-section-add"
                    >
                      +
                    </button>
                  )}
                </div>
                {voiceChannels.map((c) => (
                  <div key={c.id}>
                    {renderChannel(c)}
                    {renderVoiceOccupants(c.id)}
                  </div>
                ))}
              </>
            )}

            {channelsLoading && channels.length === 0 && (
              <div className="ec-skeleton-list" aria-label="Загрузка комнат">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="ec-skeleton-row"
                    style={{ gridTemplateColumns: "16px 1fr" }}
                  >
                    <div
                      className="ec-skeleton-row__avatar"
                      style={{ width: 14, height: 14, borderRadius: 3 }}
                    />
                    <div className="ec-skeleton-row__bars">
                      <div className="ec-skeleton-row__bar" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!channelsLoading && channels.length === 0 && (
              <div style={{ padding: "var(--ec-space-4) var(--ec-space-2)", textAlign: "center" }}>
                <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", margin: "0 0 var(--ec-space-3)" }}>
                  Пока нет ни одной комнаты.
                </p>
                {editable && (
                  <button
                    type="button"
                    onClick={() => openCreateModal("TEXT")}
                    className="ec-btn ec-btn--primary ec-btn--sm"
                  >
                    + Создать первую комнату
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* v0.97: composer per-tab — channels: «+ Новая комната» modal trigger,
          tables: «+ Новая таблица» button, работа: ничего (только навигация).
          Старый inline-composer (4 type buttons + input + send) удалён. */}
      {sidebarTab === "tables" && onCreateTable && (
        <div className="ec-channel-list__composer">
          <button
            type="button"
            onClick={onCreateTable}
            className="ec-btn ec-btn--primary ec-btn--sm ec-shimmer-sweep"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <span>+ НОВАЯ ТАБЛИЦА</span>
          </button>
        </div>
      )}
      {sidebarTab === "channels" && editable && (
        <div className="ec-channel-list__composer">
          <button
            type="button"
            onClick={() => openCreateModal("TEXT")}
            className="ec-btn ec-btn--primary ec-btn--sm ec-shimmer-sweep"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <span>+ СОЗДАТЬ КОМНАТУ</span>
          </button>
        </div>
      )}

      <CreateChannelModal
        open={createModalOpen}
        initialType={createModalType}
        categoryName={createModalCategoryName}
        onClose={() => setCreateModalOpen(false)}
        onCreate={(name, type) => onCreate(name, type, createModalCategoryId)}
      />
      <CategoryCreateModal
        open={categoryModal !== null}
        title={categoryModal?.mode === "rename" ? "Переименовать категорию" : "Создать категорию"}
        submitLabel={categoryModal?.mode === "rename" ? "Сохранить" : "Создать"}
        initialName={categoryModal?.mode === "rename" ? categoryModal.category.name : ""}
        onClose={() => setCategoryModal(null)}
        onSubmit={(name) => {
          if (categoryModal?.mode === "rename") {
            return onRenameCategory?.(categoryModal.category.id, name) ?? Promise.resolve(false);
          }
          return onCreateCategory?.(name) ?? Promise.resolve(null);
        }}
      />
      {categoryMenu && (
        <div
          className="ec-popover-surface ec-channel-category-menu"
          style={{ left: categoryMenu.x, top: categoryMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="ec-popover-item"
            onClick={() => {
              setCategoryModal({ mode: "rename", category: categoryMenu.category });
              setCategoryMenu(null);
            }}
          >
            Переименовать
          </button>
          <button
            type="button"
            className="ec-popover-item ec-popover-item--danger"
            onClick={() => {
              const category = categoryMenu.category;
              setCategoryMenu(null);
              if (window.confirm(`Удалить «${category.name.toUpperCase()}»? Каналы внутри станут несгруппированными`)) {
                void onDeleteCategory?.(category.id);
              }
            }}
          >
            Удалить
          </button>
        </div>
      )}
    </aside>
  );
}
