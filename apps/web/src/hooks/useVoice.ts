import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Room as RoomType,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
} from "livekit-client";
import { ApiError, apiJson } from "../lib/api";
import {
  noiseModeToConstraints,
  useVoiceSettings,
} from "./useVoiceSettings";

/**
 * `livekit-client` весит ~500 KB raw / 140 KB gzip — слишком много для
 * initial bundle. Lazy-loaded через dynamic import при первом `join()`,
 * чтобы users которые не открывают voice channels не платили этим
 * bundle-весом.
 */

export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export type VoiceParticipant = {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMicMuted: boolean;
  isDeafened: boolean;
  isLocal: boolean;
};

type JoinResponse = {
  wsUrl: string;
  token: string;
  roomName: string;
  identity: string;
  metadata: { displayName: string; avatar: string | null };
};

type RemoteTrackEntry = {
  audioEl: HTMLAudioElement;
  /** LiveKit RemoteAudioTrack — для getRtcStats и других track-level API. */
  track: RemoteTrack;
  publication: RemoteTrackPublication;
  participantIdentity: string;
};

export function useVoice() {
  const {
    settings,
    setInputDevice,
    setOutputDevice,
    setNoiseSuppression,
    setPushToTalk,
    setParticipantVolume,
    resetParticipantVolume,
    toggleParticipantMute,
    setMasterOutputVolume,
    setMicGain,
  } = useVoiceSettings();

  const [room, setRoom] = useState<RoomType | null>(null);
  const [state, setState] = useState<VoiceConnectionState>("disconnected");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  /** True пока удерживается PTT hotkey. */
  const [pttActive, setPttActive] = useState(false);

  const roomRef = useRef<RoomType | null>(null);
  roomRef.current = room;

  /** identity-trackSid → entry. Используется для cleanup, volume, stats. */
  const remoteTracksRef = useRef<Map<string, RemoteTrackEntry>>(new Map());

  /** Snapshot последних settings — для use в callbacks без зависимостей. */
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /**
   * Применяет per-participant volume + mute к audio-элементу.
   * Audio.volume = settings.participantVolumes[identity] ?? 1.0
   * Audio.muted = settings.mutedParticipants.includes(identity) || isDeafened.
   */
  const applyRemoteAudioState = useCallback(
    (entry: RemoteTrackEntry, deafened: boolean) => {
      const s = settingsRef.current;
      const perPart = s.participantVolumes[entry.participantIdentity];
      const perPartFinal = perPart === undefined ? 1 : perPart;
      const combined = perPartFinal * s.masterOutputVolume;
      entry.audioEl.volume = Math.max(0, Math.min(1, combined));
      entry.audioEl.muted =
        deafened || s.mutedParticipants.includes(entry.participantIdentity);
    },
    [],
  );

  /** Применяет current settings ко всем уже подписанным remote tracks. */
  const applyAllRemoteState = useCallback(() => {
    for (const entry of remoteTracksRef.current.values()) {
      applyRemoteAudioState(entry, isDeafened);
    }
  }, [applyRemoteAudioState, isDeafened]);

  // Реагируем на изменение settings — volumes/mutes/output device должны
  // применяться real-time без переподключения.
  useEffect(() => {
    applyAllRemoteState();
  }, [
    settings.participantVolumes,
    settings.mutedParticipants,
    settings.masterOutputVolume,
    applyAllRemoteState,
  ]);

  // Если output device сменился — переключаем sink на всех audio-элементах
  // + говорим LiveKit'у через switchActiveDevice (для future tracks).
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    const targetId = settings.outputDeviceId;
    if (targetId == null) return;
    // LiveKit Room.switchActiveDevice
    void r
      .switchActiveDevice("audiooutput", targetId)
      .catch((e) => console.warn("switchActiveDevice audiooutput failed", e));
    // setSinkId на каждом audio-элементе (для уже attached tracks)
    for (const entry of remoteTracksRef.current.values()) {
      const el = entry.audioEl as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (typeof el.setSinkId === "function") {
        el.setSinkId(targetId).catch((e) =>
          console.warn("setSinkId failed", e),
        );
      }
    }
  }, [settings.outputDeviceId]);

  // Если input device или noise mode сменились — переподписываем mic трек
  // (LiveKit Room.switchActiveDevice + republish mic).
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    const targetId = settings.inputDeviceId;
    if (targetId != null) {
      void r
        .switchActiveDevice("audioinput", targetId)
        .catch((e) => console.warn("switchActiveDevice audioinput failed", e));
    }
  }, [settings.inputDeviceId]);

  const refreshParticipants = useCallback(() => {
    const r = roomRef.current;
    if (!r) {
      setParticipants([]);
      return;
    }
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
    for (const entry of remoteTracksRef.current.values()) {
      try {
        entry.audioEl.pause();
        entry.audioEl.srcObject = null;
        entry.audioEl.remove();
      } catch {
        /* */
      }
    }
    remoteTracksRef.current.clear();
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

            // Применяем output sink если задан
            const targetSink = settingsRef.current.outputDeviceId;
            const elTyped = el as HTMLAudioElement & {
              setSinkId?: (id: string) => Promise<void>;
            };
            if (targetSink && typeof elTyped.setSinkId === "function") {
              elTyped.setSinkId(targetSink).catch((e) =>
                console.warn("setSinkId failed", e),
              );
            }

            const key = `${participant.identity}-${pub.trackSid}`;
            const entry: RemoteTrackEntry = {
              audioEl: el,
              track,
              publication: pub,
              participantIdentity: participant.identity,
            };
            remoteTracksRef.current.set(key, entry);
            applyRemoteAudioState(entry, isDeafened);
          }
        });
        r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach();
            const key = `${participant.identity}-${pub.trackSid}`;
            const entry = remoteTracksRef.current.get(key);
            if (entry) {
              entry.audioEl.remove();
              remoteTracksRef.current.delete(key);
            }
          }
        });

        await r.connect(data.wsUrl, data.token);

        // Output device — switchActiveDevice для future tracks subscription order
        const outDevice = settingsRef.current.outputDeviceId;
        if (outDevice) {
          try {
            await r.switchActiveDevice("audiooutput", outDevice);
          } catch (e) {
            console.warn("switchActiveDevice audiooutput failed", e);
          }
        }

        // Включаем mic c noise/echo/AGC constraints + selected input device.
        // Если PTT — mic стартует MUTED.
        try {
          const constraints = noiseModeToConstraints(
            settingsRef.current.noiseSuppression,
          );
          const inputId = settingsRef.current.inputDeviceId;
          const ptt = settingsRef.current.pushToTalk;

          await r.localParticipant.setMicrophoneEnabled(
            !ptt, // если PTT — стартуем muted
            {
              ...constraints,
              ...(inputId ? { deviceId: { exact: inputId } } : {}),
            },
          );
          setIsMicMuted(ptt);
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
    [activeChannelId, busy, leave, refreshParticipants, state, applyRemoteAudioState, isDeafened],
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
    // Применяем mute к всем audio elements (учитывая per-participant mute из settings).
    for (const entry of remoteTracksRef.current.values()) {
      applyRemoteAudioState(entry, next);
    }
    setIsDeafened(next);
    if (next && !isMicMuted) {
      void toggleMic();
    }
    refreshParticipants();
  }, [isDeafened, isMicMuted, toggleMic, refreshParticipants, applyRemoteAudioState]);

  /**
   * Push-to-talk: глобально слушаем keydown/keyup. Активно только если
   * `settings.pushToTalk = true` И мы connected.
   */
  useEffect(() => {
    if (!settings.pushToTalk) return;
    if (state !== "connected") return;

    const key = settings.pttKey;
    let pressed = false;

    const isPttKey = (e: KeyboardEvent) => e.code === key;
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable
      );
    };

    const onDown = (e: KeyboardEvent) => {
      if (!isPttKey(e)) return;
      // Не активируем PTT когда юзер печатает в input/textarea.
      if (isTypingTarget(e.target)) return;
      if (e.repeat) return;
      if (pressed) return;
      pressed = true;
      setPttActive(true);
      const r = roomRef.current;
      if (r) {
        void r.localParticipant.setMicrophoneEnabled(true).then(() => {
          setIsMicMuted(false);
          refreshParticipants();
        });
      }
      e.preventDefault();
    };

    const onUp = (e: KeyboardEvent) => {
      if (!isPttKey(e)) return;
      if (!pressed) return;
      pressed = false;
      setPttActive(false);
      const r = roomRef.current;
      if (r) {
        void r.localParticipant.setMicrophoneEnabled(false).then(() => {
          setIsMicMuted(true);
          refreshParticipants();
        });
      }
      e.preventDefault();
    };

    const onBlur = () => {
      // Window lost focus — release mic если был зажат.
      if (pressed) {
        pressed = false;
        setPttActive(false);
        const r = roomRef.current;
        if (r) {
          void r.localParticipant.setMicrophoneEnabled(false).then(() => {
            setIsMicMuted(true);
            refreshParticipants();
          });
        }
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [settings.pushToTalk, settings.pttKey, state, refreshParticipants]);

  // Когда PTT toggle меняется на запущенной сессии — синхронизируем mic state.
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    if (state !== "connected") return;
    // PTT включили → mute mic.
    // PTT выключили → unmute mic (если юзер вручную не замьютил).
    if (settings.pushToTalk) {
      if (!isMicMuted) {
        void r.localParticipant.setMicrophoneEnabled(false).then(() => {
          setIsMicMuted(true);
          refreshParticipants();
        });
      }
    } else {
      if (isMicMuted && !isDeafened) {
        void r.localParticipant.setMicrophoneEnabled(true).then(() => {
          setIsMicMuted(false);
          refreshParticipants();
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.pushToTalk]);

  useEffect(() => {
    return () => {
      void leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Snapshot RTCStats для каждого remote audio track (для stats overlay). */
  const getRemoteStats = useCallback(async () => {
    const out: Array<{
      identity: string;
      bitrate: number | null;
      packetsLost: number | null;
      jitter: number | null;
      roundTripMs: number | null;
    }> = [];
    for (const entry of remoteTracksRef.current.values()) {
      try {
        // RemoteAudioTrack.getRTCStatsReport — LiveKit-метод
        // (внутри это RTCPeerConnection.getStats для конкретного track)
        const trk = entry.track as RemoteTrack & {
          getRTCStatsReport?: () => Promise<RTCStatsReport | undefined>;
        };
        const report = trk.getRTCStatsReport
          ? await trk.getRTCStatsReport()
          : undefined;
        if (!report) {
          out.push({
            identity: entry.participantIdentity,
            bitrate: null,
            packetsLost: null,
            jitter: null,
            roundTripMs: null,
          });
          continue;
        }
        let bitrate: number | null = null;
        let packetsLost: number | null = null;
        let jitter: number | null = null;
        let rtt: number | null = null;
        report.forEach((s) => {
          const rec = s as Record<string, unknown>;
          if (rec.type === "inbound-rtp" && rec.kind === "audio") {
            // bitrate невозможно посчитать без diff'а двух snapshot'ов;
            // оставим bytesReceived как proxy → caller сделает diff если нужен.
            const bytes = typeof rec.bytesReceived === "number" ? rec.bytesReceived : null;
            bitrate = bytes;
            packetsLost = typeof rec.packetsLost === "number" ? rec.packetsLost : null;
            jitter = typeof rec.jitter === "number" ? rec.jitter * 1000 : null; // ms
          }
          if (rec.type === "remote-inbound-rtp" && rec.kind === "audio") {
            const rttSec = typeof rec.roundTripTime === "number" ? rec.roundTripTime : null;
            rtt = rttSec !== null ? rttSec * 1000 : null;
          }
        });
        out.push({
          identity: entry.participantIdentity,
          bitrate,
          packetsLost,
          jitter,
          roundTripMs: rtt,
        });
      } catch {
        out.push({
          identity: entry.participantIdentity,
          bitrate: null,
          packetsLost: null,
          jitter: null,
          roundTripMs: null,
        });
      }
    }
    return out;
  }, []);

  return {
    state,
    participants,
    activeChannelId,
    error,
    busy,
    isMicMuted,
    isDeafened,
    pttActive,
    join,
    leave,
    toggleMic,
    toggleDeafen,
    // settings passthrough — для UI элементов
    settings,
    setInputDevice,
    setOutputDevice,
    setNoiseSuppression,
    setPushToTalk,
    setParticipantVolume,
    resetParticipantVolume,
    toggleParticipantMute,
    setMasterOutputVolume,
    setMicGain,
    getRemoteStats,
  };
}

// Re-export для удобства (в т.ч. для unit-тестов когда добавим)
export { getVoiceSettings } from "./useVoiceSettings";
