import type { Server as SocketServer } from "socket.io";

let io: SocketServer | null = null;

export function setSocketIO(server: SocketServer) {
  io = server;
}

/** Attachment в socket-payload — minimal subset для отображения. */
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
    /** True если автор — Bot shadow user (для UI badge). Default false. */
    isBot?: boolean;
    createdAt: string;
    attachments?: AttachmentPayload[];
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

/** Эмит при изменении роли участника. */
export function emitMemberUpdated(
  serverId: string,
  payload: {
    memberId: string;
    userId: string;
    serverId: string;
    role: string;
  },
) {
  io?.to(`server:${serverId}`).emit("member:updated", payload);
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

export function emitActionItemCreated(
  channelId: string,
  payload: {
    id: string;
    title: string;
    type: "TASK" | "DECISION" | "FOLLOW_UP";
    status: "OPEN" | "DONE";
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
  },
) {
  io?.to(`channel:${channelId}`).emit("action:item:created", payload);
}

export function emitActionItemUpdated(
  channelId: string,
  payload: {
    id: string;
    title: string;
    type: "TASK" | "DECISION" | "FOLLOW_UP";
    status: "OPEN" | "DONE";
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
  },
) {
  io?.to(`channel:${channelId}`).emit("action:item:updated", payload);
}

// ============================
// Direct Messages (DM) events
// ============================

/** Новое DM-сообщение. Broadcast в room `dm:${conversationId}`. */
export function emitDmMessageNew(
  conversationId: string,
  payload: {
    messageId: string;
    conversationId: string;
    userId: string;
    displayName: string;
    avatar: string | null;
    /** True если автор — Bot shadow user. Default false. */
    isBot?: boolean;
    content: string;
    createdAt: string;
    attachments?: AttachmentPayload[];
  },
) {
  io?.to(`dm:${conversationId}`).emit("dm:message:new", payload);
}

/** DM-сообщение отредактировано. */
export function emitDmMessageUpdated(
  conversationId: string,
  payload: {
    messageId: string;
    conversationId: string;
    content: string;
    editedAt: string;
  },
) {
  io?.to(`dm:${conversationId}`).emit("dm:message:updated", payload);
}

/** DM-сообщение удалено (soft). */
export function emitDmMessageDeleted(
  conversationId: string,
  payload: {
    messageId: string;
    conversationId: string;
    deletedAt: string;
  },
) {
  io?.to(`dm:${conversationId}`).emit("dm:message:deleted", payload);
}

/** Реакция на DM-сообщение добавлена. */
export function emitDmReactionAdded(
  conversationId: string,
  payload: {
    messageId: string;
    conversationId: string;
    emoji: string;
    userId: string;
  },
) {
  io?.to(`dm:${conversationId}`).emit("dm:reaction:added", payload);
}

/** Реакция на DM-сообщение снята. */
export function emitDmReactionRemoved(
  conversationId: string,
  payload: {
    messageId: string;
    conversationId: string;
    emoji: string;
    userId: string;
  },
) {
  io?.to(`dm:${conversationId}`).emit("dm:reaction:removed", payload);
}

/**
 * Обновление conversation в боковом списке у получателя — поднимает
 * convo в топ списка при новом message, обновляет previewText и lastMessageAt.
 *
 * Шлём индивидуально каждому участнику в его user-room `user:${userId}`.
 */
export function emitDmConversationBumped(
  userId: string,
  payload: {
    conversationId: string;
    lastMessageAt: string;
    /** Превью последнего сообщения (для unread + sidebar preview). */
    lastMessagePreview: string;
    /** Кто отправил последнее (если не я — это unread bump). */
    lastSenderUserId: string;
  },
) {
  io?.to(`user:${userId}`).emit("dm:conversation:bumped", payload);
}
