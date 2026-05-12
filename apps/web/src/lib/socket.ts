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

export const SocketEvents = {
  ServerHello: "server:hello",
  MessageNew: "message:new",
  MessageUpdated: "message:updated",
  MessageDeleted: "message:deleted",
  MessagePinned: "message:pinned",
  MessageUnpinned: "message:unpinned",
  ReactionAdded: "reaction:added",
  ReactionRemoved: "reaction:removed",
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
} as const;
