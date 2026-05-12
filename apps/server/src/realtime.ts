import type { Server as SocketServer } from "socket.io";

let io: SocketServer | null = null;

export function setSocketIO(server: SocketServer) {
  io = server;
}

/** Эмит нового сообщения в room `channel:${channelId}`. */
export function emitMessageOnChannel(
  channelId: string,
  payload: {
    messageId: string;
    content: string;
    channelId: string;
    userId: string;
    displayName: string;
    /** Аватар автора на момент отправки. Null если у user'а нет аватара. */
    avatar: string | null;
    createdAt: string;
  },
) {
  io?.to(`channel:${channelId}`).emit("message:new", payload);
}

/** Эмит при создании канала в сервере. Подписанные на server room — обновят список каналов. */
export function emitChannelCreated(
  serverId: string,
  payload: {
    channelId: string;
    serverId: string;
    name: string;
    slug: string;
    type: "TEXT" | "VOICE";
    position: number;
    createdAt: string;
  },
) {
  io?.to(`server:${serverId}`).emit("channel:created", payload);
}

/**
 * Эмит при удалении канала. Frontend должен убрать его из списка
 * и сбросить selectedChannelId если был активным.
 */
export function emitChannelDeleted(
  serverId: string,
  payload: { channelId: string; serverId: string },
) {
  io?.to(`server:${serverId}`).emit("channel:deleted", payload);
}

/** Эмит при вступлении нового члена в сервер. */
export function emitMemberJoined(
  serverId: string,
  payload: {
    memberId: string;
    userId: string;
    serverId: string;
    role: string;
    displayName: string;
    avatar: string | null;
    joinedAt: string;
  },
) {
  io?.to(`server:${serverId}`).emit("member:joined", payload);
}

/** Эмит при выходе члена из сервера. */
export function emitMemberLeft(
  serverId: string,
  payload: { memberId: string; userId: string; serverId: string },
) {
  io?.to(`server:${serverId}`).emit("member:left", payload);
}

/** Сообщение отредактировано: frontend обновляет content + editedAt. */
export function emitMessageUpdated(
  channelId: string,
  payload: {
    messageId: string;
    channelId: string;
    content: string;
    editedAt: string;
  },
) {
  io?.to(`channel:${channelId}`).emit("message:updated", payload);
}

/** Soft-delete: frontend меняет render на placeholder. */
export function emitMessageDeleted(
  channelId: string,
  payload: { messageId: string; channelId: string; deletedAt: string },
) {
  io?.to(`channel:${channelId}`).emit("message:deleted", payload);
}

/** Pin: frontend добавляет в pinned-bar (если открыт) + помечает сообщение. */
export function emitMessagePinned(
  channelId: string,
  payload: { messageId: string; channelId: string; pinnedAt: string },
) {
  io?.to(`channel:${channelId}`).emit("message:pinned", payload);
}

/** Unpin: frontend убирает из pinned-bar + снимает помету. */
export function emitMessageUnpinned(
  channelId: string,
  payload: { messageId: string; channelId: string },
) {
  io?.to(`channel:${channelId}`).emit("message:unpinned", payload);
}

/**
 * Реакция добавлена. Payload содержит userId (кто) — клиент использует
 * для `mine: userId === currentUserId` агрегата.
 */
export function emitReactionAdded(
  channelId: string,
  payload: {
    messageId: string;
    channelId: string;
    emoji: string;
    userId: string;
  },
) {
  io?.to(`channel:${channelId}`).emit("reaction:added", payload);
}

/** Реакция снята. */
export function emitReactionRemoved(
  channelId: string,
  payload: {
    messageId: string;
    channelId: string;
    emoji: string;
    userId: string;
  },
) {
  io?.to(`channel:${channelId}`).emit("reaction:removed", payload);
}
