import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  SocketEvents,
  type VoiceMeta,
  type VoiceMetaPayload,
  type VoiceParticipantJoinedPayload,
  type VoiceParticipantLeftPayload,
  type VoiceParticipantMetaPayload,
  type VoiceParticipantSpeakingPayload,
  type VoiceStatePayload,
} from "../lib/socket";

export type VoicePresence = {
  /** Кто сейчас в каком voice-канале. `Record<channelId, userId[]>`. */
  byChannel: Record<string, string[]>;
  /** Mic/deafen-состояние каждого участника эфира. `Record<userId, VoiceMeta>`. */
  metaByUser: Record<string, VoiceMeta>;
  /**
   * Кто сейчас говорит — `Record<userId, true>`. Сверх-транзиентно, без
   * snapshot'а (только дельты `voice:participant:speaking`). Для своей
   * voice-комнаты точнее использовать локальный LiveKit ActiveSpeakers.
   */
  speakingByUser: Record<string, boolean>;
};

/**
 * Подписка на voice presence events.
 *
 * Возвращает `{ byChannel, metaByUser }` — кто в каком канале + mic/deafen-
 * состояние каждого (для Discord-style индикаторов в sidebar) среди серверов
 * где user member (backend filter'ит по member-rooms).
 *
 * State seeded backend'овскими `voice:state` + `voice:meta` snapshot'ами при
 * connect и далее инкрементально обновляется через `voice:participant:joined`
 * / `left` / `meta`.
 */
export function useVoicePresence(socket: Socket | null): VoicePresence {
  const [voiceByChannel, setVoiceByChannel] = useState<Record<string, string[]>>({});
  const [metaByUser, setMetaByUser] = useState<Record<string, VoiceMeta>>({});
  const [speakingByUser, setSpeakingByUser] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!socket) {
      setVoiceByChannel({});
      setMetaByUser({});
      setSpeakingByUser({});
      return;
    }

    const requestSnapshot = () => {
      socket.emit(SocketEvents.VoicePresenceRequest);
    };

    const onState = (snap: VoiceStatePayload) => {
      // Полная замена — это snapshot, не дельта.
      setVoiceByChannel(snap);
    };

    const onMetaSnapshot = (snap: VoiceMetaPayload) => {
      setMetaByUser(snap);
    };

    const onJoined = (p: VoiceParticipantJoinedPayload) => {
      setVoiceByChannel((prev) => {
        const list = prev[p.voiceChannelId] ?? [];
        if (list.includes(p.userId)) return prev;
        return { ...prev, [p.voiceChannelId]: [...list, p.userId] };
      });
    };

    const onLeft = (p: VoiceParticipantLeftPayload) => {
      setVoiceByChannel((prev) => {
        const list = prev[p.voiceChannelId];
        if (!list) return prev;
        const next = list.filter((id) => id !== p.userId);
        if (next.length === 0) {
          const copy = { ...prev };
          delete copy[p.voiceChannelId];
          return copy;
        }
        return { ...prev, [p.voiceChannelId]: next };
      });
      // Участник вышел из эфира — его meta + speaking больше не нужны.
      setMetaByUser((prev) => {
        if (!(p.userId in prev)) return prev;
        const copy = { ...prev };
        delete copy[p.userId];
        return copy;
      });
      setSpeakingByUser((prev) => {
        if (!(p.userId in prev)) return prev;
        const copy = { ...prev };
        delete copy[p.userId];
        return copy;
      });
    };

    const onMeta = (p: VoiceParticipantMetaPayload) => {
      setMetaByUser((prev) => ({
        ...prev,
        [p.userId]: { micMuted: p.micMuted, deafened: p.deafened },
      }));
    };

    const onSpeaking = (p: VoiceParticipantSpeakingPayload) => {
      setSpeakingByUser((prev) => {
        if (p.speaking) {
          if (prev[p.userId]) return prev;
          return { ...prev, [p.userId]: true };
        }
        if (!(p.userId in prev)) return prev;
        const copy = { ...prev };
        delete copy[p.userId];
        return copy;
      });
    };

    socket.on(SocketEvents.VoiceState, onState);
    socket.on(SocketEvents.VoiceMeta, onMetaSnapshot);
    socket.on(SocketEvents.VoiceParticipantJoined, onJoined);
    socket.on(SocketEvents.VoiceParticipantLeft, onLeft);
    socket.on(SocketEvents.VoiceParticipantMeta, onMeta);
    socket.on(SocketEvents.VoiceParticipantSpeaking, onSpeaking);
    socket.on("connect", requestSnapshot);

    requestSnapshot();
    const snapshotInterval = window.setInterval(requestSnapshot, 30_000);

    return () => {
      window.clearInterval(snapshotInterval);
      socket.off("connect", requestSnapshot);
      socket.off(SocketEvents.VoiceState, onState);
      socket.off(SocketEvents.VoiceMeta, onMetaSnapshot);
      socket.off(SocketEvents.VoiceParticipantJoined, onJoined);
      socket.off(SocketEvents.VoiceParticipantLeft, onLeft);
      socket.off(SocketEvents.VoiceParticipantMeta, onMeta);
      socket.off(SocketEvents.VoiceParticipantSpeaking, onSpeaking);
    };
  }, [socket]);

  return { byChannel: voiceByChannel, metaByUser, speakingByUser };
}

/** Реверс: userId → voiceChannelId (или null). Полезно для MemberList. */
export function reverseVoiceMap(
  byChannel: Record<string, string[]>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [channelId, users] of Object.entries(byChannel)) {
    for (const userId of users) {
      out[userId] = channelId;
    }
  }
  return out;
}
