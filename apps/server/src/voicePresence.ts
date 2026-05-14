/**
 * Voice presence — кто сейчас в каком VOICE-канале.
 *
 * Source of truth — Socket.io события `voice:join` / `voice:leave` от клиентов,
 * плюс автоматический cleanup при `disconnect`. Логика symmetric к presence.ts,
 * только трекаем per-channel rather than per-user.
 *
 * Альтернатива: poll'ить LiveKit Room API. Но тогда нет real-time'а — нужен
 * либо webhook'и от LiveKit (требуют отдельной настройки) либо polling
 * с N-сек задержкой. Socket-driven proxy дешевле и достаточно точен —
 * на disconnect socket мы знаем что чел вышел.
 *
 * Trade-off: если у пользователя крашится браузер без proper disconnect,
 * он останется «в эфире» на ~5-15 секунд пока Socket.io не заметит. Допустимо.
 */

import type { Server as SocketServer } from "socket.io";

type VoiceState = {
  userId: string;
  voiceChannelId: string;
  serverId: string;
};

/** Mic/deafen-состояние участника эфира — для Discord-style индикаторов. */
type VoiceMeta = { micMuted: boolean; deafened: boolean };

const socketStates = new Map<string, VoiceState>(); // socketId → state
const channelOccupants = new Map<string, Set<string>>(); // channelId → userIds
const userActiveChannel = new Map<string, string>(); // userId → channelId (последний join)
const userMeta = new Map<string, VoiceMeta>(); // userId → mic/deafen state

let ioRef: SocketServer | null = null;

export function setVoicePresenceIO(io: SocketServer) {
  ioRef = io;
}

function emitJoined(state: VoiceState) {
  ioRef?.to(`server:${state.serverId}`).emit("voice:participant:joined", {
    userId: state.userId,
    voiceChannelId: state.voiceChannelId,
    serverId: state.serverId,
  });
}

function emitLeft(state: VoiceState) {
  ioRef?.to(`server:${state.serverId}`).emit("voice:participant:left", {
    userId: state.userId,
    voiceChannelId: state.voiceChannelId,
    serverId: state.serverId,
  });
}

/** Снимок текущего состояния — `Record<channelId, userId[]>`. */
export function snapshot(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [channelId, set] of channelOccupants.entries()) {
    out[channelId] = Array.from(set);
  }
  return out;
}

/** Снимок только для конкретного сервера (по списку channelIds). */
export function snapshotForServer(serverChannelIds: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const channelId of serverChannelIds) {
    const set = channelOccupants.get(channelId);
    if (set && set.size > 0) {
      out[channelId] = Array.from(set);
    }
  }
  return out;
}

/** Снимок mic/deafen-состояния для набора userId (тех, кто сейчас в эфире). */
export function metaSnapshotForUsers(userIds: string[]): Record<string, VoiceMeta> {
  const out: Record<string, VoiceMeta> = {};
  for (const userId of userIds) {
    const meta = userMeta.get(userId);
    if (meta) out[userId] = { ...meta };
  }
  return out;
}

/**
 * Клиент сообщил, что переключил микрофон / звук (Socket.io 'voice:meta:update').
 * Обновляем стейт и рассылаем дельту всем участникам сервера — sidebar у всех
 * показывает актуальные mute/deafen-иконки (Discord-style).
 */
export function updateVoiceMeta(
  socketId: string,
  meta: Partial<VoiceMeta>,
): void {
  const state = socketStates.get(socketId);
  if (!state) return;
  const current = userMeta.get(state.userId) ?? { micMuted: false, deafened: false };
  const next: VoiceMeta = {
    micMuted: meta.micMuted ?? current.micMuted,
    deafened: meta.deafened ?? current.deafened,
  };
  userMeta.set(state.userId, next);
  ioRef?.to(`server:${state.serverId}`).emit("voice:participant:meta", {
    userId: state.userId,
    voiceChannelId: state.voiceChannelId,
    serverId: state.serverId,
    micMuted: next.micMuted,
    deafened: next.deafened,
  });
}

/**
 * Пользователь вошёл в voice-канал (Socket.io event 'voice:join').
 *
 * Если у этого же socket'а была старая voice-привязка — сначала чистим её,
 * иначе пользователь окажется «одновременно в двух каналах».
 */
export function trackVoiceJoin(
  socketId: string,
  userId: string,
  voiceChannelId: string,
  serverId: string,
): void {
  const old = socketStates.get(socketId);
  if (old) {
    untrackInternal(socketId, old);
  }

  const state: VoiceState = { userId, voiceChannelId, serverId };
  socketStates.set(socketId, state);

  let occupants = channelOccupants.get(voiceChannelId);
  if (!occupants) {
    occupants = new Set();
    channelOccupants.set(voiceChannelId, occupants);
  }
  const wasEmpty = !occupants.has(userId);
  occupants.add(userId);
  userActiveChannel.set(userId, voiceChannelId);
  // Дефолтное meta-состояние — клиент сразу после join эмитит реальное
  // через 'voice:meta:update'.
  if (!userMeta.has(userId)) {
    userMeta.set(userId, { micMuted: false, deafened: false });
  }

  // Эмитим только если user реально только что появился в этом канале
  // (защита от дубликата — у user может быть несколько tabs).
  if (wasEmpty) {
    emitJoined(state);
  }
}

/** Socket emitted 'voice:leave' или disconnect. */
export function trackVoiceLeave(socketId: string): void {
  const state = socketStates.get(socketId);
  if (!state) return;
  untrackInternal(socketId, state);
}

function untrackInternal(socketId: string, state: VoiceState): void {
  socketStates.delete(socketId);

  // Может ли у user'а ещё быть другой socket в этом же канале?
  let hasOtherInSameChannel = false;
  for (const s of socketStates.values()) {
    if (s.userId === state.userId && s.voiceChannelId === state.voiceChannelId) {
      hasOtherInSameChannel = true;
      break;
    }
  }

  if (!hasOtherInSameChannel) {
    const occupants = channelOccupants.get(state.voiceChannelId);
    if (occupants) {
      occupants.delete(state.userId);
      if (occupants.size === 0) {
        channelOccupants.delete(state.voiceChannelId);
      }
    }
    // Обновляем active channel pointer
    if (userActiveChannel.get(state.userId) === state.voiceChannelId) {
      // Может user в другом канале с другого socket'а? Поиск.
      let nextActive: string | null = null;
      for (const s of socketStates.values()) {
        if (s.userId === state.userId) {
          nextActive = s.voiceChannelId;
          break;
        }
      }
      if (nextActive) userActiveChannel.set(state.userId, nextActive);
      else {
        userActiveChannel.delete(state.userId);
        // Полностью вышел из эфира — meta больше не нужна.
        userMeta.delete(state.userId);
      }
    }
    emitLeft(state);
  }
}
