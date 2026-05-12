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
