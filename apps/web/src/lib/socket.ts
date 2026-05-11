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

export type MessageNewPayload = {
  messageId: string;
  content: string;
  channelId: string;
  userId: string;
  displayName: string;
  createdAt: string;
};

export type ChannelCreatedPayload = {
  channelId: string;
  serverId: string;
  name: string;
  slug: string;
  position: number;
  createdAt: string;
};

export type MemberJoinedPayload = {
  memberId: string;
  userId: string;
  serverId: string;
  role: string;
  displayName: string;
  joinedAt: string;
};

export type MemberLeftPayload = {
  memberId: string;
  userId: string;
  serverId: string;
};

/** Совпадает с naming из docs/SOCKET_EVENTS.md и кода сервера. */
export const SocketEvents = {
  ServerHello: "server:hello",
  MessageNew: "message:new",
  ChannelCreated: "channel:created",
  MemberJoined: "member:joined",
  MemberLeft: "member:left",
  ChannelJoin: "channel:join",
  ChannelLeave: "channel:leave",
} as const;
