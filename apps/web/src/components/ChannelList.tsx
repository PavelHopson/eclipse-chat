import type { CSSProperties } from "react";
import { useState } from "react";
import { Avatar } from "./Avatar";
import type { ChannelRow } from "../hooks/useChannels";
import type { MemberRow } from "../hooks/useMembers";
import type { ChannelType, VoiceMeta } from "../lib/socket";

type Props = {
  serverName: string | null;
  serverRole: string | null;
  inviteCode: string | null;
  channels: ChannelRow[];
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

const typeToggle: CSSProperties = {
  display: "flex",
  gap: 2,
  padding: 3,
  background: "var(--ec-surface-2)",
  borderRadius: "var(--ec-radius-sm)",
};

function typeBtn(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "0.3rem 0.4rem",
    fontSize: "var(--ec-text-2xs)",
    color: active ? "var(--ec-text-strong)" : "var(--ec-text-muted)",
    background: active ? "var(--ec-surface-3)" : "transparent",
    border: 0,
    borderRadius: "var(--ec-radius-xs)",
    cursor: "pointer",
    fontWeight: 600,
    letterSpacing: "var(--ec-tracking-wide)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--ec-space-1)",
  };
}

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

export function ChannelList({
  serverName,
  serverRole,
  inviteCode: _inviteCode,
  channels,
  unread,
  selectedChannelId,
  onSelect,
  onCreate,
  onDelete,
  onOpenSettings,
  onReorder,
  onShowServerInfo,
  voiceByChannel,
  voiceMetaByUser,
  members,
  speakingUserIds,
}: Props) {
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<ChannelType>("TEXT");
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // DnD reorder state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

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

  const textChannels = channels.filter((c) => c.type === "TEXT");
  const broadcastChannels = channels.filter((c) => c.type === "BROADCAST");
  const voiceChannels = channels.filter((c) => c.type === "VOICE");

  const handleDelete = async (channelId: string, channelName: string) => {
    if (!window.confirm(`Удалить канал «${channelName}»? Все сообщения внутри будут потеряны.`)) {
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
        {editable && onOpenSettings && (
          <span
            data-channel-action
            role="button"
            tabIndex={0}
            aria-label={`Настройки канала ${c.name}`}
            title="Редактировать канал"
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
            aria-label={`Удалить канал ${c.name}`}
            title="Удалить канал"
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
        {textChannels.length > 0 && (
          <>
            <div className="ec-section-label" style={{ marginBottom: "var(--ec-space-2)" }}>
              <span>Текстовые</span>
              <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{textChannels.length}</span>
            </div>
            {textChannels.map(renderChannel)}
          </>
        )}

        {broadcastChannels.length > 0 && (
          <>
            <div
              className="ec-section-label"
              style={{
                marginTop: textChannels.length > 0 ? "var(--ec-space-4)" : 0,
                marginBottom: "var(--ec-space-2)",
              }}
            >
              <span>Каналы</span>
              <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{broadcastChannels.length}</span>
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
              }}
            >
              <span>Голосовые</span>
              <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{voiceChannels.length}</span>
            </div>
            {voiceChannels.map((c) => (
              <div key={c.id}>
                {renderChannel(c)}
                {renderVoiceOccupants(c.id)}
              </div>
            ))}
          </>
        )}

        {channels.length === 0 && (
          <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-2)", margin: 0 }}>
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
            await onCreate(draft.trim(), draftType);
            setDraft("");
          } finally {
            setSubmitting(false);
          }
        }}
        style={composerRow}
      >
        <div style={typeToggle} role="tablist" aria-label="Тип канала">
          <button
            type="button"
            onClick={() => setDraftType("TEXT")}
            style={typeBtn(draftType === "TEXT")}
            role="tab"
            aria-selected={draftType === "TEXT"}
            title="Текстовый канал"
          >
            <span aria-hidden style={{ fontSize: "0.8rem" }}>#</span>
            Текст
          </button>
          <button
            type="button"
            onClick={() => setDraftType("BROADCAST")}
            style={typeBtn(draftType === "BROADCAST")}
            role="tab"
            aria-selected={draftType === "BROADCAST"}
            title="Канал-вещание — публикуют модераторы, читают все"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 11l15-5v12L3 13v-2z" />
              <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
            </svg>
            Канал
          </button>
          <button
            type="button"
            onClick={() => setDraftType("VOICE")}
            style={typeBtn(draftType === "VOICE")}
            role="tab"
            aria-selected={draftType === "VOICE"}
            title="Голосовой канал"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
            </svg>
            Голос
          </button>
        </div>
        <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
          <input
            className="ec-field"
            placeholder={
              draftType === "VOICE"
                ? "Новый голосовой канал…"
                : draftType === "BROADCAST"
                ? "Новый канал-вещание…"
                : "Новый канал…"
            }
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
        </div>
      </form>
    </aside>
  );
}
