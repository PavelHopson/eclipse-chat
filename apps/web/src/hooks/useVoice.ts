import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Room as RoomType,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
} from "livekit-client";
import { ApiError, apiJson } from "../lib/api";

/**
 * `livekit-client` весит ~500 KB raw / 140 KB gzip — слишком много для
 * initial bundle. Lazy-loaded через dynamic import при первом `join()`,
 * чтобы users которые не открывают voice channels не платили этим
 * bundle-весом.
 *
 * Все типы (Room, ConnectionState и т.д.) импортируются `type`-only —
 * это не попадает в runtime bundle (только в .d.ts).
 */

export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export type VoiceParticipant = {
  identity: string;
  name: string;
  /** Подаёт ли звук сейчас (isSpeaking из LiveKit). */
  isSpeaking: boolean;
  /** Сам себя замьютил (mic publication отсутствует или muted). */
  isMicMuted: boolean;
  /** Сам себя «оглушил» — отключил все subscriptions remote tracks (только для local). */
  isDeafened: boolean;
  /** Local participant flag — для UI distinction. */
  isLocal: boolean;
};

type JoinResponse = {
  wsUrl: string;
  token: string;
  roomName: string;
  identity: string;
  metadata: { displayName: string; avatar: string | null };
};

export function useVoice() {
  const [room, setRoom] = useState<RoomType | null>(null);
  const [state, setState] = useState<VoiceConnectionState>("disconnected");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const roomRef = useRef<RoomType | null>(null);
  roomRef.current = room;

  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const refreshParticipants = useCallback(() => {
    const r = roomRef.current;
    if (!r) {
      setParticipants([]);
      return;
    }
    // Импортируем enum lazily — нужен для Track.Source.Microphone
    void import("livekit-client").then((lk) => {
      const list: VoiceParticipant[] = [];
      const lp = r.localParticipant;
      list.push({
        identity: lp.identity,
        name: lp.name || lp.identity,
        isSpeaking: lp.isSpeaking,
        isMicMuted: !lp.isMicrophoneEnabled,
        isDeafened,
        isLocal: true,
      });
      for (const p of r.remoteParticipants.values()) {
        const micPub = p.getTrackPublication(lk.Track.Source.Microphone);
        list.push({
          identity: p.identity,
          name: p.name || p.identity,
          isSpeaking: p.isSpeaking,
          isMicMuted: micPub?.isMuted ?? !micPub,
          isDeafened: false,
          isLocal: false,
        });
      }
      setParticipants(list);
    });
  }, [isDeafened]);

  useEffect(() => {
    refreshParticipants();
  }, [room, refreshParticipants]);

  const leave = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await r.disconnect();
    } catch {
      /* ignore */
    }
    for (const el of audioElsRef.current.values()) {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        /* */
      }
    }
    audioElsRef.current.clear();
    setRoom(null);
    setActiveChannelId(null);
    setState("disconnected");
    setParticipants([]);
  }, []);

  const join = useCallback(
    async (channelId: string): Promise<boolean> => {
      setError(null);
      if (busy) return false;
      if (activeChannelId === channelId && state === "connected") return true;
      if (roomRef.current) {
        await leave();
      }
      setBusy(true);
      try {
        const data = await apiJson<JoinResponse>(
          `/api/channels/${encodeURIComponent(channelId)}/voice/join`,
          { method: "POST" },
        );

        // Lazy load livekit-client (~140 KB gzip)
        const lk = await import("livekit-client");
        const { Room, RoomEvent, Track } = lk;

        const r = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            audioPreset: { maxBitrate: 64_000 },
          },
        });

        r.on(RoomEvent.ConnectionStateChanged, (s) => {
          // map LiveKit state → simple enum
          if (s === lk.ConnectionState.Connected) setState("connected");
          else if (s === lk.ConnectionState.Connecting) setState("connecting");
          else if (s === lk.ConnectionState.Reconnecting) setState("reconnecting");
          else setState("disconnected");
        });
        r.on(RoomEvent.ParticipantConnected, refreshParticipants);
        r.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
        r.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
        r.on(RoomEvent.TrackMuted, refreshParticipants);
        r.on(RoomEvent.TrackUnmuted, refreshParticipants);
        r.on(RoomEvent.LocalTrackPublished, refreshParticipants);
        r.on(RoomEvent.LocalTrackUnpublished, refreshParticipants);

        r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach() as HTMLAudioElement;
            el.style.display = "none";
            el.autoplay = true;
            document.body.appendChild(el);
            audioElsRef.current.set(`${participant.identity}-${pub.trackSid}`, el);
          }
        });
        r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach();
            const key = `${participant.identity}-${pub.trackSid}`;
            const el = audioElsRef.current.get(key);
            if (el) {
              el.remove();
              audioElsRef.current.delete(key);
            }
          }
        });

        await r.connect(data.wsUrl, data.token);

        try {
          await r.localParticipant.setMicrophoneEnabled(true);
          setIsMicMuted(false);
        } catch (micErr) {
          setError(
            micErr instanceof Error && micErr.name === "NotAllowedError"
              ? "Микрофон заблокирован браузером. Разреши доступ и перезайди."
              : "Не удалось включить микрофон",
          );
        }

        setRoom(r);
        setActiveChannelId(channelId);
        refreshParticipants();
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 503) {
          setError("Голосовая связь не настроена на сервере");
        } else {
          setError(e instanceof Error ? e.message : "Не удалось подключиться");
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [activeChannelId, busy, leave, refreshParticipants, state],
  );

  const toggleMic = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      const next = !isMicMuted;
      await r.localParticipant.setMicrophoneEnabled(!next);
      setIsMicMuted(next);
      refreshParticipants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переключить микрофон");
    }
  }, [isMicMuted, refreshParticipants]);

  const toggleDeafen = useCallback(() => {
    const next = !isDeafened;
    for (const el of audioElsRef.current.values()) {
      el.muted = next;
    }
    setIsDeafened(next);
    if (next && !isMicMuted) {
      void toggleMic();
    }
    refreshParticipants();
  }, [isDeafened, isMicMuted, toggleMic, refreshParticipants]);

  useEffect(() => {
    return () => {
      void leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    participants,
    activeChannelId,
    error,
    busy,
    isMicMuted,
    isDeafened,
    join,
    leave,
    toggleMic,
    toggleDeafen,
  };
}
