import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  SocketEvents,
  type VoiceParticipantJoinedPayload,
  type VoiceParticipantLeftPayload,
  type VoiceStatePayload,
} from "../lib/socket";

/**
 * Подписка на voice presence events.
 *
 * Возвращает Record<voiceChannelId, userId[]> — кто сейчас в каком канале
 * среди серверов где user member (backend filter'ит по member-rooms).
 *
 * State seeded backend'овским `voice:state` snapshot'ом при connect и
 * далее инкрементально обновляется через `voice:participant:joined`/`left`.
 */
export function useVoicePresence(socket: Socket | null) {
  const [voiceByChannel, setVoiceByChannel] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!socket) {
      setVoiceByChannel({});
      return;
    }

    const onState = (snap: VoiceStatePayload) => {
      // Полная замена — это snapshot, не дельта.
      setVoiceByChannel(snap);
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
    };

    socket.on(SocketEvents.VoiceState, onState);
    socket.on(SocketEvents.VoiceParticipantJoined, onJoined);
    socket.on(SocketEvents.VoiceParticipantLeft, onLeft);

    return () => {
      socket.off(SocketEvents.VoiceState, onState);
      socket.off(SocketEvents.VoiceParticipantJoined, onJoined);
      socket.off(SocketEvents.VoiceParticipantLeft, onLeft);
    };
  }, [socket]);

  return voiceByChannel;
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
