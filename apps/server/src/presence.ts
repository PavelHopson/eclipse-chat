/**
 * Presence — in-memory tracker онлайн-юзеров.
 *
 * Source of truth — открытые Socket.io connections. Когда user connects
 * хотя бы одним сокетом → ONLINE. Когда последний отваливается → OFFLINE.
 *
 * Лучше Redis pub/sub (v0.11), но для single-instance прод-инстанса
 * Eclipse Chat на одном Node-процессе этого достаточно. При рестарте
 * `eclipse-chat-server` все user'ы получают OFFLINE до reconnect — это
 * корректно, так как все sockets реально отрываются.
 *
 * Emit логика:
 *  - При первом socket'е user'а → emit `presence:update {online}` во все
 *    server-rooms где user member (получаем prefetch'ем при connect).
 *  - При последнем disconnect → emit `presence:update {offline}` в те же.
 *  - Re-connect быстрее чем `OFFLINE_GRACE_MS` — никаких лишних эмитов
 *    (offline-эмит откладывается на grace-период; при reconnect отменяется).
 */

import type { Server as SocketServer } from "socket.io";

type Status = "online" | "offline" | "idle" | "dnd";

const sockets = new Map<string, Set<string>>(); // userId → socketIds
const serverIdsByUser = new Map<string, Set<string>>(); // userId → server-rooms для broadcast
const pendingOffline = new Map<string, NodeJS.Timeout>(); // userId → timer для grace-period

const OFFLINE_GRACE_MS = 5_000;

let ioRef: SocketServer | null = null;

export function setPresenceIO(io: SocketServer) {
  ioRef = io;
}

function emit(userId: string, status: Status): void {
  const rooms = serverIdsByUser.get(userId);
  if (!ioRef || !rooms || rooms.size === 0) return;
  const payload = { userId, status };
  for (const serverId of rooms) {
    ioRef.to(`server:${serverId}`).emit("presence:update", payload);
  }
}

/**
 * Broadcast manual status change. Используется когда user меняет
 * status через PATCH /api/users/me/status. Берёт server-ids из
 * presence-tracker (если он online); если offline — пытаемся отдельно
 * найти memberships (но обычно изменение статуса делается online).
 */
export function broadcastStatusChange(
  userId: string,
  manualStatus: "ONLINE" | "IDLE" | "DND" | "INVISIBLE",
): void {
  // INVISIBLE → клиенты должны увидеть offline. IDLE/DND/ONLINE → как есть.
  let wire: Status = "online";
  if (manualStatus === "INVISIBLE") wire = "offline";
  else if (manualStatus === "IDLE") wire = "idle";
  else if (manualStatus === "DND") wire = "dnd";
  else wire = "online";
  emit(userId, wire);
}

/**
 * Регистрация открытого socket'а. `serverIds` — список server'ов где
 * user является member (нужно один раз prefetch'ить при connect).
 */
export function trackConnect(userId: string, socketId: string, serverIds: string[]): void {
  const existing = sockets.get(userId);
  const isFirst = !existing || existing.size === 0;
  if (existing) {
    existing.add(socketId);
  } else {
    sockets.set(userId, new Set([socketId]));
  }
  serverIdsByUser.set(userId, new Set(serverIds));

  // Если был pending OFFLINE — отменяем, человек reconnect'нулся в grace
  const pending = pendingOffline.get(userId);
  if (pending) {
    clearTimeout(pending);
    pendingOffline.delete(userId);
  }

  if (isFirst && !pending) {
    emit(userId, "online");
  }
}

export function trackDisconnect(userId: string, socketId: string): void {
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size > 0) return;
  sockets.delete(userId);
  // grace-period — на случай быстрого reconnect (refresh страницы)
  const t = setTimeout(() => {
    pendingOffline.delete(userId);
    emit(userId, "offline");
    serverIdsByUser.delete(userId);
  }, OFFLINE_GRACE_MS);
  pendingOffline.set(userId, t);
}

/** Текущий статус (для GET /api/servers/:id/members). */
export function isOnline(userId: string): boolean {
  const set = sockets.get(userId);
  return Boolean(set && set.size > 0);
}

/** Все online userIds (для bulk-проверки в members route). */
export function onlineUserIds(): Set<string> {
  const result = new Set<string>();
  for (const [userId, set] of sockets.entries()) {
    if (set.size > 0) result.add(userId);
  }
  return result;
}

/**
 * Добавить user в server-room broadcast list (когда он вступил в новый
 * сервер из активной сессии). Иначе presence-эмиты не дойдут до этого
 * server-room до следующего reconnect.
 */
export function addServerRoom(userId: string, serverId: string): void {
  const rooms = serverIdsByUser.get(userId);
  if (rooms) rooms.add(serverId);
}

/** Аналогично — при leave/delete сервера. */
export function removeServerRoom(userId: string, serverId: string): void {
  const rooms = serverIdsByUser.get(userId);
  if (rooms) rooms.delete(serverId);
}
