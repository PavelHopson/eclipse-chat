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
  createdAt: string;
  attachments?: AttachmentPayload[];
};

export type ChannelType = "TEXT" | "VOICE";

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

export type ActionItemType = "TASK" | "DECISION" | "FOLLOW_UP";
export type ActionItemStatus = "OPEN" | "DONE";

export type ActionItemPayload = {
  id: string;
  title: string;
  type: ActionItemType;
  status: ActionItemStatus;
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
  ChannelCreated: "channel:created",
  ChannelDeleted: "channel:deleted",
  MemberJoined: "member:joined",
  MemberLeft: "member:left",
  MemberUpdated: "member:updated",
  ChannelJoin: "channel:join",
  ChannelLeave: "channel:leave",
  PresenceUpdate: "presence:update",
  TypingStart: "typing:start",
  TypingStop: "typing:stop",
  VoiceJoin: "voice:join",
  VoiceLeave: "voice:leave",
  VoiceState: "voice:state",
  VoiceParticipantJoined: "voice:participant:joined",
  VoiceParticipantLeft: "voice:participant:left",
  DmJoin: "dm:join",
  DmLeave: "dm:leave",
  DmMessageNew: "dm:message:new",
  DmMessageUpdated: "dm:message:updated",
  DmMessageDeleted: "dm:message:deleted",
  DmReactionAdded: "dm:reaction:added",
  DmReactionRemoved: "dm:reaction:removed",
  DmConversationBumped: "dm:conversation:bumped",
} as const;
