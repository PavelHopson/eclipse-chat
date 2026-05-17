/**
 * Socket.io клиент.
 *
 * Подключается на тот же origin что и страница (Vite proxy /socket.io → :3001
 * в dev; same-origin в prod). Auth — через `handshake.auth.token` = access JWT.
 *
 * При успешном refresh access-токена нужен **пересоздать** socket (новый
 * handshake), иначе сервер всё ещё видит старый userId. Хук `useSocket()`
 * подписывается на `onTokenRefresh` и пересоздаёт.
 */

import { io, type Socket } from "socket.io-client";
import { getAccess } from "./storage";
import type { BotRole } from "./botRoles";

/**
 * Socket.io path = `${BASE_URL}socket.io`. BASE_URL всегда заканчивается
 * `/`, поэтому конкатенация даёт `/socket.io` в dev или
 * `/eclipse-chat/socket.io` в path-based prod.
 *
 * Server слушает на `/socket.io` (без prefix); nginx в prod / Vite proxy
 * в dev делает rewrite убирая `/eclipse-chat` префикс.
 */
const SOCKET_PATH = `${import.meta.env.BASE_URL}socket.io`;

export function createSocket(): Socket {
  const t = getAccess() ?? undefined;
  return io({
    path: SOCKET_PATH,
    auth: t ? { token: t } : {},
  });
}

export type ServerHello = { t: number; msg: string };

export type TranscriptStatus = "NONE" | "PENDING" | "READY" | "FAILED";

export type AttachmentPayload = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  position: number;
  /** v0.58: транскрипция аудио. Все три поля optional — старый бэкенд
   *  до 0.58 их не возвращает (но прод уже >=0.58). undefined трактуется
   *  как NONE. */
  transcript?: string | null;
  transcriptStatus?: TranscriptStatus;
  transcriptError?: string | null;
  /** v0.66: pre-computed audio waveform peaks (32..256 чисел 0..100).
   *  Null/undefined → frontend fallback'нется на linear progress bar.
   *  Только для audio/* attachments. */
  waveformPeaks?: number[] | null;
};

/** v0.58: socket-event при обновлении транскрипции attachment'а. */
export type AttachmentTranscriptUpdatedPayload = {
  attachmentId: string;
  transcriptStatus: TranscriptStatus;
  transcript: string | null;
  transcriptError: string | null;
};

export type MessageNewPayload = {
  messageId: string;
  content: string;
  channelId: string;
  userId: string;
  displayName: string;
  /** Аватар автора на момент отправки. Null если у user'а нет аватара. */
  avatar: string | null;
  /** Автор — Bot shadow user. Используется для UI badge. Default false. */
  isBot?: boolean;
  /** Taxonomy-роль бота (GENERIC/MODERATOR/PM/KNOWLEDGE/SALES). Null/undefined для
      human-сообщений и system @ai bot без Bot row. */
  botRole?: BotRole | null;
  createdAt: string;
  attachments?: AttachmentPayload[];
};

export type ChannelType = "TEXT" | "VOICE" | "BROADCAST";

export type ChannelCreatedPayload = {
  channelId: string;
  serverId: string;
  name: string;
  slug: string;
  type: ChannelType;
  position: number;
  createdAt: string;
};

export type ChannelDeletedPayload = {
  channelId: string;
  serverId: string;
};

export type ChannelUpdatedPayload = {
  channelId: string;
  serverId: string;
  name: string;
  slug: string;
  type: ChannelType;
  position: number;
  description: string | null;
  emoji: string | null;
};

export type MemberJoinedPayload = {
  memberId: string;
  userId: string;
  serverId: string;
  role: string;
  displayName: string;
  avatar: string | null;
  joinedAt: string;
};

export type MemberLeftPayload = {
  memberId: string;
  userId: string;
  serverId: string;
};

export type MemberUpdatedPayload = {
  memberId: string;
  userId: string;
  serverId: string;
  role: string;
};

export type PresenceStatus = "online" | "offline" | "idle" | "dnd";

export type PresenceUpdatePayload = {
  userId: string;
  status: PresenceStatus;
};

export type MessageUpdatedPayload = {
  messageId: string;
  channelId: string;
  content: string;
  editedAt: string;
};

export type MessageDeletedPayload = {
  messageId: string;
  channelId: string;
  deletedAt: string;
};

export type MessagePinnedPayload = {
  messageId: string;
  channelId: string;
  pinnedAt: string;
};

export type MessageUnpinnedPayload = {
  messageId: string;
  channelId: string;
};

export type ReactionAddedPayload = {
  messageId: string;
  channelId: string;
  emoji: string;
  userId: string;
};

export type ReactionRemovedPayload = {
  messageId: string;
  channelId: string;
  emoji: string;
  userId: string;
};

/** Новый thread reply — broadcast в room `thread:${rootId}`. */
export type ThreadReplyNewPayload = {
  messageId: string;
  rootId: string;
  channelId: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  isBot?: boolean;
  botRole?: BotRole | null;
  content: string;
  createdAt: string;
  attachments?: AttachmentPayload[];
};

/** Thread meta-update — для UI badge «N replies» на root в main feed. */
export type ThreadMetaUpdatePayload = {
  rootId: string;
  channelId: string;
  replyCount: number;
  lastReplyAt: string;
};

/** Инцидент открыт — broadcast в server-room. */
export type IncidentOpenedPayload = {
  incidentId: string;
  serverId: string;
  title: string;
  channelId: string | null;
  openedByUserId: string;
  openedByName: string;
  openedAt: string;
};

/** Инцидент закрыт — broadcast в server-room. */
export type IncidentResolvedPayload = {
  incidentId: string;
  serverId: string;
  resolvedAt: string;
  hasPostMortem: boolean;
};

export type ActionItemType = "TASK" | "DECISION" | "FOLLOW_UP";
/** v0.71: 4-status kanban. Promoted from binary OPEN/DONE для execution
 *  flow с intermediate states. Backend enum в Prisma — see migration
 *  20260517220000_action_item_status_phase2. */
export type ActionItemStatus = "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type ActionItemPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ApprovalStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export type ActionItemPayload = {
  id: string;
  title: string;
  description: string | null;
  type: ActionItemType;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  serverId: string;
  channelId: string;
  sourceMessageId: string;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  createdBy: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  assignee: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
  approvalNote: string | null;
  approvedAt: string | null;
  approver: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
};

export type ActionItemCommentAddedPayload = {
  id: string;
  actionItemId: string;
  serverId: string;
  channelId: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  user: { id: string; displayName: string; avatar: string | null };
};

export type ActionItemCommentDeletedPayload = {
  commentId: string;
  actionItemId: string;
};

/** Совпадает с naming из docs/SOCKET_EVENTS.md и кода сервера. */
export type TypingStartPayload = {
  channelId: string;
  userId: string;
  displayName: string;
};

export type TypingStopPayload = {
  channelId: string;
  userId: string;
};

/** Server-side bot генерирует AI-ответ (v0.48). */
export type BotTypingPayload = {
  channelId: string;
  userId: string;
  displayName: string;
  botRole: BotRole;
};

/**
 * Voice presence — кто сейчас в каком VOICE-канале.
 * Backend трекает по Socket.io connect/disconnect + явным 'voice:join'/'voice:leave'.
 */
export type VoiceParticipantJoinedPayload = {
  userId: string;
  voiceChannelId: string;
  serverId: string;
};

export type VoiceParticipantLeftPayload = {
  userId: string;
  voiceChannelId: string;
  serverId: string;
};

/** Snapshot — `Record<voiceChannelId, userId[]>`. Шлётся раз на connect. */
export type VoiceStatePayload = Record<string, string[]>;

/** Mic/deafen-состояние участника эфира — для Discord-style индикаторов. */
export type VoiceMeta = { micMuted: boolean; deafened: boolean };

/** Snapshot meta — `Record<userId, VoiceMeta>`. Шлётся раз на connect. */
export type VoiceMetaPayload = Record<string, VoiceMeta>;

/** Дельта meta — один участник переключил микрофон / звук. */
export type VoiceParticipantMetaPayload = {
  userId: string;
  voiceChannelId: string;
  serverId: string;
  micMuted: boolean;
  deafened: boolean;
};

/** Дельта speaking — один участник начал/перестал говорить (сверх-транзиентно). */
export type VoiceParticipantSpeakingPayload = {
  userId: string;
  voiceChannelId: string;
  serverId: string;
  speaking: boolean;
};

// ============================
// DM (Direct Messages) payloads
// ============================

export type DmMessageNewPayload = {
  messageId: string;
  conversationId: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  /** Автор — Bot shadow user. Default false. */
  isBot?: boolean;
  /** Taxonomy-роль бота-автора. Null/undefined для human + system bot. */
  botRole?: BotRole | null;
  content: string;
  createdAt: string;
  attachments?: AttachmentPayload[];
};

export type DmMessageUpdatedPayload = {
  messageId: string;
  conversationId: string;
  content: string;
  editedAt: string;
};

export type DmMessageDeletedPayload = {
  messageId: string;
  conversationId: string;
  deletedAt: string;
};

export type DmReactionAddedPayload = {
  messageId: string;
  conversationId: string;
  emoji: string;
  userId: string;
};

export type DmReactionRemovedPayload = DmReactionAddedPayload;

/** Bump conversation в sidebar list — отправлено индивидуально каждому participant'у. */
export type DmConversationBumpedPayload = {
  conversationId: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderUserId: string;
};

export const SocketEvents = {
  ServerHello: "server:hello",
  MessageNew: "message:new",
  MessageUpdated: "message:updated",
  MessageDeleted: "message:deleted",
  MessagePinned: "message:pinned",
  MessageUnpinned: "message:unpinned",
  ReactionAdded: "reaction:added",
  ReactionRemoved: "reaction:removed",
  ActionItemCreated: "action:item:created",
  ActionItemUpdated: "action:item:updated",
  ActionItemCommentAdded: "action:item:comment:added",
  ActionItemCommentDeleted: "action:item:comment:deleted",
  AttachmentTranscriptUpdated: "attachment:transcript:updated",
  MusicSessionUpdated: "music:session:updated",
  TableUpdated: "table:updated",
  TableDeleted: "table:deleted",
  TableFieldAdded: "table:field:added",
  TableFieldUpdated: "table:field:updated",
  TableFieldDeleted: "table:field:deleted",
  TableRowAdded: "table:row:added",
  TableRowUpdated: "table:row:updated",
  TableRowDeleted: "table:row:deleted",
  ChannelCreated: "channel:created",
  ChannelDeleted: "channel:deleted",
  ChannelUpdated: "channel:updated",
  IncidentOpened: "incident:opened",
  IncidentResolved: "incident:resolved",
  MemberJoined: "member:joined",
  MemberLeft: "member:left",
  MemberUpdated: "member:updated",
  ChannelJoin: "channel:join",
  ChannelLeave: "channel:leave",
  PresenceUpdate: "presence:update",
  TypingStart: "typing:start",
  TypingStop: "typing:stop",
  BotTyping: "bot:typing",
  VoiceJoin: "voice:join",
  VoiceLeave: "voice:leave",
  VoiceState: "voice:state",
  VoiceMeta: "voice:meta",
  VoiceMetaUpdate: "voice:meta:update",
  VoiceSpeakingUpdate: "voice:speaking:update",
  VoiceParticipantJoined: "voice:participant:joined",
  VoiceParticipantLeft: "voice:participant:left",
  VoiceParticipantMeta: "voice:participant:meta",
  VoiceParticipantSpeaking: "voice:participant:speaking",
  ThreadJoin: "thread:join",
  ThreadLeave: "thread:leave",
  ThreadReplyNew: "thread:reply:new",
  ThreadMetaUpdate: "thread:meta:update",
  DmJoin: "dm:join",
  DmLeave: "dm:leave",
  DmMessageNew: "dm:message:new",
  DmMessageUpdated: "dm:message:updated",
  DmMessageDeleted: "dm:message:deleted",
  DmReactionAdded: "dm:reaction:added",
  DmReactionRemoved: "dm:reaction:removed",
  DmConversationBumped: "dm:conversation:bumped",
} as const;
