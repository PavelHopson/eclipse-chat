import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { CreateChannelModal } from "./CreateChannelModal";
import type { ChannelRow } from "../hooks/useChannels";
import type { MemberRow } from "../hooks/useMembers";
import type { ChannelType, VoiceMeta } from "../lib/socket";

/** v0.96 UX refactor: sidebar разделён на 3 таба. Persist active tab
 *  per-server в localStorage. */
type SidebarTab = "channels" | "work" | "tables";

type Props = {
  /** v0.96: serverId для per-server-persisted sidebarTab. */
  serverId: string | null;
  serverName: string | null;
  serverRole: string | null;
  inviteCode: string | null;
  channels: ChannelRow[];
  /** Channels async loading state (после server-switch до GET ответа). */
  channelsLoading?: boolean;
  unread: Record<string, number>;
  selectedChannelId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, type: ChannelType) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  /** Открыть ChannelSettingsModal. Скрывает кнопку если не передано. */
  onOpenSettings?: (channelId: string) => void;
  /** Batch reorder каналов через drag-drop. Скрывает DnD если не передано. */
  onReorder?: (order: { id: string; position: number }[]) => Promise<boolean>;
  onShowServerInfo: () => void;
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

const wrap: CSSProperties = {
  background: "var(--ec-surface-1)",
  borderRight: "1px solid var(--ec-border-subtle)",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  // v0.68: height:100% + min-height:0 + overflow:hidden обязательны чтобы
  // listWrap (flex:1; overflow:auto) реально получил bounded height и начал
  // scrollить. Без них на коротком viewport (≤700px) или с большим числом
  // каналов content overflows за пределы grid-area и пропадает за footer'ом
  // экрана. Pavel-ask 17.05: «не у всех всё видно».
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  padding: "var(--ec-space-3) var(--ec-space-4)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
  // v1.1.5: position:relative — нужно для .ec-server-header-edge::after
  // holographic bottom line.
  position: "relative",
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
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

/** v0.97: «+» icon button рядом с section-label'ом (Текстовые / Каналы /
 *  Голосовые) — pre-select type при открытии CreateChannelModal. */
const sectionAddBtn: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 18,
  height: 18,
  padding: 0,
  background: "transparent",
  border: "1px solid var(--ec-border-subtle)",
  color: "var(--ec-text-dim)",
  borderRadius: "var(--ec-radius-xs)",
  cursor: "pointer",
  fontSize: "0.7rem",
  lineHeight: 1,
  transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const deleteBtn: CSSProperties = {
  width: 20,
  height: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-xs)",
  color: "var(--ec-text-dim)",
  cursor: "pointer",
  opacity: 0,
  transition: "opacity var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
  marginLeft: "auto",
  flexShrink: 0,
};

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

function ChannelGlyph({
  type,
  emoji,
}: {
  type: ChannelType;
  emoji?: string | null;
}) {
  if (emoji) {
    return (
      <span
        aria-hidden
        style={{ fontSize: "0.95rem", lineHeight: 1, display: "inline-block" }}
      >
        {emoji}
      </span>
    );
  }
  if (type === "VOICE") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
      </svg>
    );
  }
  if (type === "BROADCAST") {
    // Megaphone — канал-вещание (news/blogger)
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 11l15-5v12L3 13v-2z" />
        <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
        <path d="M21 9v6" />
      </svg>
    );
  }
  if (type === "EXECUTION") {
    // Kanban-board glyph — execution комната, primary view = Status Board.
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    );
  }
  return (
    <span className="ec-channel-hash" aria-hidden>
      #
    </span>
  );
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

const sidebarTabBar: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 0,
  padding: "var(--ec-space-2) var(--ec-space-3) 0",
  background: "var(--ec-surface-1)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  flexShrink: 0,
};

function sidebarTabBtn(active: boolean): CSSProperties {
  return {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "0.5rem 0.4rem 0.55rem",
    background: "transparent",
    border: 0,
    borderBottom: active
      ? "2px solid var(--ec-accent)"
      : "2px solid transparent",
    color: active ? "var(--ec-text-strong)" : "var(--ec-text-muted)",
    fontSize: "var(--ec-text-2xs)",
    fontWeight: 700,
    letterSpacing: "var(--ec-tracking-caps)",
    textTransform: "uppercase",
    cursor: "pointer",
    transition:
      "color var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
    whiteSpace: "nowrap",
    minWidth: 0,
  };
}

export function ChannelList({
  serverId,
  serverName,
  serverRole,
  inviteCode: _inviteCode,
  channels,
  channelsLoading,
  unread,
  selectedChannelId,
  onSelect,
  onCreate,
  onDelete,
  onOpenSettings,
  onReorder,
  onShowServerInfo,
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
  // DnD reorder state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // v0.97: CreateChannelModal state. Открывается через primary button
  // сверху Channels tab + через «+» icon в каждом section-header'е
  // (pre-selected тип через initialType).
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<ChannelType>("TEXT");
  const openCreateModal = (type: ChannelType) => {
    setCreateModalType(type);
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
  const canDrag = editable && Boolean(onReorder);

  // Apply reorder: используем splice (target-position insertion)
  const applyReorder = async (sourceId: string, targetId: string) => {
    if (!onReorder) return;
    if (sourceId === targetId) return;
    // Reorder только внутри типа (TEXT нельзя смешивать с VOICE)
    const source = channels.find((c) => c.id === sourceId);
    const target = channels.find((c) => c.id === targetId);
    if (!source || !target || source.type !== target.type) return;
    // Реально работаем только над одним type'ом
    const sameType = channels.filter((c) => c.type === source.type);
    const otherType = channels.filter((c) => c.type !== source.type);
    const fromIdx = sameType.findIndex((c) => c.id === sourceId);
    const toIdx = sameType.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const moved = sameType.slice();
    const [removed] = moved.splice(fromIdx, 1);
    moved.splice(toIdx, 0, removed);
    // Назначаем positions с шагом 10 (резерв под manual insertions)
    const order = moved.map((c, i) => ({ id: c.id, position: i * 10 }));
    // Опционально включить otherType, но их позиции не меняем
    const fullOrder = [
      ...order,
      ...otherType.map((c, i) => ({ id: c.id, position: 1000 + i * 10 })),
    ];
    await onReorder(fullOrder);
  };

  // v0.74 #16: EXECUTION channels группируются с TEXT (это "operational
  // rooms"), отличаются только icon + рендер mode'ом в AppShell.
  const textChannels = channels.filter(
    (c) => c.type === "TEXT" || c.type === "EXECUTION",
  );
  const broadcastChannels = channels.filter((c) => c.type === "BROADCAST");
  const voiceChannels = channels.filter((c) => c.type === "VOICE");

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

  // Sticky-список голосовых участников под voice-каналом (Discord-style):
  // аватар + имя + индикатор mic-off / deafened, speaking-glow для своей room.
  const renderVoiceOccupants = (channelId: string) => {
    const userIds = voiceByChannel?.[channelId];
    if (!userIds || userIds.length === 0) return null;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          marginLeft: "var(--ec-space-5)",
          paddingLeft: "var(--ec-space-2)",
          borderLeft: "1px dashed var(--ec-border-subtle)",
          paddingTop: 2,
          paddingBottom: 2,
        }}
      >
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
          return (
            <span
              key={userId}
              title={`${name} — ${stateLabel}`}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: 6,
                padding: "0.15rem 0.3rem",
                borderRadius: "var(--ec-radius-xs)",
                fontSize: "var(--ec-text-2xs)",
                color: speaking ? "var(--ec-accent)" : "var(--ec-text-muted)",
                fontWeight: speaking ? 600 : 400,
                transition: "color 80ms linear",
              }}
            >
              <span
                style={{
                  position: "relative",
                  display: "inline-block",
                  borderRadius: "var(--ec-radius-full)",
                  boxShadow: speaking
                    ? "0 0 0 1.5px var(--ec-accent), 0 0 10px hsl(195 70% 60% / 0.55)"
                    : "none",
                  transition: "box-shadow 80ms linear",
                  opacity: deafened || micMuted ? 0.6 : 1,
                }}
              >
                <Avatar url={avatar} name={name} size={16} />
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  opacity: deafened || micMuted ? 0.7 : 1,
                }}
              >
                {name}
              </span>
              {(deafened || micMuted) && (
                <span
                  aria-hidden
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    color: "var(--ec-danger)",
                    flexShrink: 0,
                  }}
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
        draggable={canDrag && !isDeleting}
        onDragStart={(e) => {
          if (!canDrag) return;
          setDraggedId(c.id);
          e.dataTransfer.effectAllowed = "move";
          // Some browsers required для actual drag start
          e.dataTransfer.setData("text/plain", c.id);
        }}
        onDragOver={(e) => {
          if (!draggedId || draggedId === c.id) return;
          // Reorder только внутри своего type'а
          const src = channels.find((ch) => ch.id === draggedId);
          if (!src || src.type !== c.type) return;
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
            void applyReorder(src, c.id);
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
          cursor: canDrag ? "grab" : "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.querySelectorAll<HTMLElement>("[data-channel-action]").forEach((el) => {
            el.style.opacity = "1";
          });
        }}
        onMouseLeave={(e) => {
          e.currentTarget.querySelectorAll<HTMLElement>("[data-channel-action]").forEach((el) => {
            el.style.opacity = "0";
          });
        }}
      >
        <ChannelGlyph type={c.type} emoji={c.emoji} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
        >
          {c.name}
        </span>
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
            aria-label={`${unreadCount} непрочитанных`}
            title={`${unreadCount} непрочитанных`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: "var(--ec-radius-full)",
              background: "var(--ec-accent)",
              color: "var(--ec-accent-text)",
              fontSize: "0.6rem",
              fontWeight: 700,
              fontFeatureSettings: '"tnum"',
              boxShadow: "0 0 8px hsl(195 70% 60% / 0.5)",
            }}
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
              aria-label={isMuted ? `Снять заглушку с ${c.name}` : `Заглушить ${c.name}`}
              title={isMuted ? "Заглушено — клик чтобы вернуть push" : "Заглушить push"}
              style={{
                ...deleteBtn,
                // Muted каналы — bell-off иконка всегда видна (не hover-only).
                opacity: isMuted ? 0.7 : 0,
                color: isMuted ? "var(--ec-warn)" : "var(--ec-text-dim)",
              }}
              data-channel-action={isMuted ? undefined : "true"}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ec-surface-3)";
                e.currentTarget.style.color = isMuted
                  ? "var(--ec-warn)"
                  : "var(--ec-text)";
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = isMuted
                  ? "var(--ec-warn)"
                  : "var(--ec-text-dim)";
                e.currentTarget.style.opacity = isMuted ? "0.7" : "0";
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
            data-channel-action
            role="button"
            tabIndex={0}
            aria-label={`Настройки комнаты ${c.name}`}
            title="Редактировать комнату"
            style={deleteBtn}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--ec-surface-3)";
              e.currentTarget.style.color = "var(--ec-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ec-text-dim)";
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
            data-channel-action
            role="button"
            tabIndex={0}
            aria-label={`Удалить комнату ${c.name}`}
            title="Удалить комнату"
            style={deleteBtn}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--ec-danger-soft)";
              e.currentTarget.style.color = "var(--ec-danger)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ec-text-dim)";
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
      </button>
    );
  };

  return (
    <aside style={wrap}>
      <header className="ec-server-header-edge" style={headerStyle}>
        <button type="button" onClick={onShowServerInfo} style={serverTrigger} title="Подробнее о пространстве">
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontSize: "var(--ec-text-base)",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "var(--ec-text-strong)",
              }}
            >
              {serverName ?? "Нет пространства"}
            </span>
            {serverRole && <span className={roleClass(serverRole)} style={{ alignSelf: "flex-start" }}>{serverRole}</span>}
            {/* v1.1.1 Eclipse_OS server ID hash — cyberpunk identity marker.
                Generated deterministic from serverId для consistency. */}
            {serverId && (
              <span
                style={{
                  marginTop: 4,
                  fontSize: "0.62rem",
                  color: "var(--ec-text-dim)",
                  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title="Идентификатор пространства"
              >
                ◆ ID_{serverId.slice(-6).toUpperCase()}_SYS_{serverName?.slice(0, 6).replace(/\s+/g, "").toUpperCase() || "ECLIPSE"}
              </span>
            )}
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

      {/* v0.96 sidebar tabs: Каналы / Работа / Таблицы. Расщепляет старый
          plain list ("Доска задач" + "Здоровье" + "Таблицы" + 3 группы каналов
          подряд) на 3 contextual surfaces. Persisted per-server. */}
      <div
        style={{ ...sidebarTabBar, position: "relative" }}
        className="ec-sidebar-tabs"
        role="tablist"
        aria-label="Разделы пространства"
      >
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "channels"}
          onClick={() => setSidebarTab("channels")}
          style={sidebarTabBtn(sidebarTab === "channels")}
          className="ec-hud-tab"
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
          style={sidebarTabBtn(sidebarTab === "work")}
          className="ec-hud-tab"
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
          style={sidebarTabBtn(sidebarTab === "tables")}
          className="ec-hud-tab"
          title="Таблицы — operational tables"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <span>ДАННЫЕ</span>
          {tables !== undefined && tables.length > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: "0.6rem",
                fontWeight: 700,
                fontFeatureSettings: '"tnum"',
                padding: "0.05rem 0.32rem",
                borderRadius: "var(--ec-radius-full)",
                background: "var(--ec-surface-3)",
                color: "var(--ec-text-muted)",
                letterSpacing: 0,
                textTransform: "none",
              }}
            >
              {tables.length}
            </span>
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

      <div style={listWrap}>
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
              <p
                style={{
                  color: "var(--ec-text-dim)",
                  fontSize: "var(--ec-text-sm)",
                  padding: "var(--ec-space-3) var(--ec-space-2)",
                  margin: 0,
                }}
              >
                Доска задач и здоровье команды появятся когда в пространстве
                будет хотя бы одна задача.
              </p>
            )}
          </>
        )}

        {sidebarTab === "tables" && (
          <>
            {tables === undefined || onOpenTable === undefined ? (
              <p
                style={{
                  color: "var(--ec-text-dim)",
                  fontSize: "var(--ec-text-sm)",
                  padding: "var(--ec-space-3) var(--ec-space-2)",
                  margin: 0,
                }}
              >
                Operational Tables недоступны в этом контексте.
              </p>
            ) : tables.length === 0 ? (
              <p
                style={{
                  color: "var(--ec-text-dim)",
                  fontSize: "var(--ec-text-sm)",
                  padding: "var(--ec-space-3) var(--ec-space-2)",
                  margin: 0,
                  lineHeight: "var(--ec-leading-normal)",
                }}
              >
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
            {textChannels.length > 0 && (
              <>
                <div className="ec-section-label" style={{ marginBottom: "var(--ec-space-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="ec-section-label--diamond">
                    <span>ПОТОКИ ДАННЫХ</span>
                    <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{textChannels.length}</span>
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => openCreateModal("TEXT")}
                      title="Создать текстовую комнату"
                      aria-label="Создать текстовую комнату"
                      style={sectionAddBtn}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-text)";
                        e.currentTarget.style.borderColor = "var(--ec-border-default)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-dim)";
                        e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="ec-reveal-cascade">{textChannels.map(renderChannel)}</div>
              </>
            )}

            {broadcastChannels.length > 0 && (
              <>
                <div
                  className="ec-section-label"
                  style={{
                    marginTop: textChannels.length > 0 ? "var(--ec-space-4)" : 0,
                    marginBottom: "var(--ec-space-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span className="ec-section-label--diamond ec-section-label--diamond-violet">
                    <span>ВЕЩАНИЕ</span>
                    <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{broadcastChannels.length}</span>
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => openCreateModal("BROADCAST")}
                      title="Создать канал-вещание"
                      aria-label="Создать канал-вещание"
                      style={sectionAddBtn}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-text)";
                        e.currentTarget.style.borderColor = "var(--ec-border-default)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-dim)";
                        e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
                {broadcastChannels.map(renderChannel)}
              </>
            )}

            {voiceChannels.length > 0 && (
              <>
                <div
                  className="ec-section-label"
                  style={{
                    marginTop:
                      textChannels.length > 0 || broadcastChannels.length > 0
                        ? "var(--ec-space-4)"
                        : 0,
                    marginBottom: "var(--ec-space-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span className="ec-section-label--diamond ec-section-label--diamond-mint">
                    <span>ГОЛОСОВЫЕ СВЯЗИ</span>
                    <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{voiceChannels.length}</span>
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => openCreateModal("VOICE")}
                      title="Создать голосовую комнату"
                      aria-label="Создать голосовую комнату"
                      style={sectionAddBtn}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-text)";
                        e.currentTarget.style.borderColor = "var(--ec-border-default)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-dim)";
                        e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
                      }}
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
        <div style={composerRow}>
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
        <div style={composerRow}>
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
        onClose={() => setCreateModalOpen(false)}
        onCreate={onCreate}
      />
    </aside>
  );
}
