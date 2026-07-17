import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  LocalVideoTrack,
  Room as RoomType,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteVideoTrack,
} from "livekit-client";
import { ApiError, apiJson } from "../lib/api";
import { SocketEvents } from "../lib/socket";
import {
  createAudioEnhancer,
  type AudioEnhancerHandle,
} from "../lib/audioEnhancer";
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
  connectionQuality: "excellent" | "good" | "poor" | "lost" | "unknown";
};

export type VoiceVisualTrack = {
  id: string;
  identity: string;
  name: string;
  source: "camera" | "screen";
  isLocal: boolean;
  isMuted: boolean;
  track: LocalVideoTrack | RemoteVideoTrack;
};

const CAMERA_CAPTURE_OPTIONS = {
  resolution: {
    width: 1280,
    height: 720,
    frameRate: 30,
  },
};

const CAMERA_PUBLISH_OPTIONS = {
  videoEncoding: {
    maxBitrate: 1_800_000,
    maxFramerate: 30,
  },
};

const SCREEN_SHARE_CAPTURE_OPTIONS = {
  audio: false,
  resolution: {
    width: 1920,
    height: 1080,
    frameRate: 30,
  },
};

const SCREEN_SHARE_PUBLISH_OPTIONS = {
  videoEncoding: {
    maxBitrate: 4_500_000,
    maxFramerate: 30,
  },
};

type JoinResponse = {
  wsUrl: string;
  token: string;
  roomName: string;
  livekitIdentity?: string;
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

function normalizeConnectionQuality(value: unknown): VoiceParticipant["connectionQuality"] {
  if (value === 2 || value === "excellent" || value === "EXCELLENT") return "excellent";
  if (value === 1 || value === "good" || value === "GOOD") return "good";
  if (value === 0 || value === "poor" || value === "POOR") return "poor";
  if (value === 3 || value === "lost" || value === "LOST") return "lost";
  return "unknown";
}

type LivekitParticipantLike = {
  identity: string;
  name?: string;
  metadata?: string;
};

type VoiceParticipantProfile = {
  userId: string;
  displayName: string;
  avatar: string | null;
};

function parseVoiceParticipantProfile(participant: LivekitParticipantLike): VoiceParticipantProfile {
  if (participant.metadata) {
    try {
      const parsed = JSON.parse(participant.metadata) as {
        userId?: unknown;
        displayName?: unknown;
        avatar?: unknown;
      };
      if (typeof parsed.userId === "string" && parsed.userId.length > 0) {
        const displayName =
          typeof parsed.displayName === "string" && parsed.displayName.length > 0
            ? parsed.displayName
            : participant.name || parsed.userId;
        return {
          userId: parsed.userId,
          displayName,
          avatar: typeof parsed.avatar === "string" ? parsed.avatar : null,
        };
      }
    } catch {
      /* Legacy tokens may not have JSON metadata. Fall back to identity. */
    }
  }

  return {
    userId: participant.identity,
    displayName: participant.name || participant.identity,
    avatar: null,
  };
}

export function useVoice(socket: Socket | null = null) {
  const {
    settings,
    setInputDevice,
    setOutputDevice,
    setNoiseSuppression,
    setMicActivationMode,
    setPttKey,
    setVadThreshold,
    setAfkTimeout,
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
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [visualTracks, setVisualTracks] = useState<VoiceVisualTrack[]>([]);
  /** True пока удерживается PTT hotkey. */
  const [pttActive, setPttActive] = useState(false);

  const roomRef = useRef<RoomType | null>(null);
  roomRef.current = room;

  /** identity-trackSid → entry. Используется для cleanup, volume, stats. */
  const remoteTracksRef = useRef<Map<string, RemoteTrackEntry>>(new Map());

  /**
   * Audio enhancer handle — Web Audio mic-цепочка перед publish. Активен
   * всегда в эфире: gain-стадия (mic gain) во всех режимах + полная
   * DSP-цепочка дополнительно в режиме noiseSuppression="aggressive".
   */
  const enhancerRef = useRef<AudioEnhancerHandle | null>(null);
  const publishedMicConfigRef = useRef<{
    inputDeviceId: string | null;
    noiseSuppression: string;
    enhancerMode: "none" | "gain" | "full";
  }>({
    inputDeviceId: null,
    noiseSuppression: "standard",
    enhancerMode: "none",
  });

  /** Snapshot последних settings — для use в callbacks без зависимостей. */
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Live-обновление mic gain: если enhancer активен — применяем без
  // пересоздания цепочки. Если enhancer'а нет (на join был gain 1.0 +
  // не-aggressive → цепочку не подключали, см. join()) — изменение
  // вступит в силу при следующем join.
  useEffect(() => {
    if (enhancerRef.current) {
      enhancerRef.current.setGain(settings.micGain);
    }
  }, [settings.micGain]);

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
      const localProfile = parseVoiceParticipantProfile(lp);
      list.push({
        identity: localProfile.userId,
        name: localProfile.displayName,
        isSpeaking: lp.isSpeaking,
        isMicMuted: !lp.isMicrophoneEnabled,
        isDeafened,
        isLocal: true,
        connectionQuality: normalizeConnectionQuality(
          (lp as { connectionQuality?: unknown }).connectionQuality,
        ),
      });
      for (const p of r.remoteParticipants.values()) {
        const micPub = p.getTrackPublication(lk.Track.Source.Microphone);
        const profile = parseVoiceParticipantProfile(p);
        list.push({
          identity: profile.userId,
          name: profile.displayName,
          isSpeaking: p.isSpeaking,
          isMicMuted: micPub?.isMuted ?? !micPub,
          isDeafened: false,
          isLocal: false,
          connectionQuality: normalizeConnectionQuality(
            (p as { connectionQuality?: unknown }).connectionQuality,
          ),
        });
      }
      setParticipants(list);
    });
  }, [isDeafened]);

  const refreshVisualTracks = useCallback(() => {
    const r = roomRef.current;
    if (!r) {
      setVisualTracks([]);
      setIsCameraEnabled(false);
      setIsScreenShareEnabled(false);
      return;
    }

    type VideoPublicationLike = {
      trackSid: string;
      source: string;
      isMuted: boolean;
      videoTrack?: LocalVideoTrack | RemoteVideoTrack;
    };

    const next: VoiceVisualTrack[] = [];
    const pushTrack = (
      publication: VideoPublicationLike,
      identity: string,
      name: string,
      isLocal: boolean,
    ) => {
      if (publication.source !== "camera" && publication.source !== "screen_share") return;
      if (!publication.videoTrack) return;
      // Muted-публикация = камера/экран выключены. Не показываем чёрную плитку
      // (раньше при выключении камеры тайл оставался пустым чёрным окном).
      if (publication.isMuted) return;
      next.push({
        id: publication.trackSid,
        identity,
        name,
        source: publication.source === "screen_share" ? "screen" : "camera",
        isLocal,
        isMuted: publication.isMuted,
        track: publication.videoTrack,
      });
    };

    for (const pub of r.localParticipant.videoTrackPublications.values()) {
      const profile = parseVoiceParticipantProfile(r.localParticipant);
      pushTrack(
        pub as unknown as VideoPublicationLike,
        profile.userId,
        profile.displayName,
        true,
      );
    }

    for (const participant of r.remoteParticipants.values()) {
      const profile = parseVoiceParticipantProfile(participant);
      for (const pub of participant.videoTrackPublications.values()) {
        pushTrack(
          pub as unknown as VideoPublicationLike,
          profile.userId,
          profile.displayName,
          false,
        );
      }
    }

    next.sort((a, b) => {
      if (a.source !== b.source) return a.source === "screen" ? -1 : 1;
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      return a.name.localeCompare(b.name, "ru");
    });

    setVisualTracks(next);
    setIsCameraEnabled(r.localParticipant.isCameraEnabled);
    setIsScreenShareEnabled(r.localParticipant.isScreenShareEnabled);
  }, []);

  const applyLocalMicrophoneSettings = useCallback(
    async (r: RoomType, preserveMuted: boolean) => {
      const constraints = noiseModeToConstraints(settingsRef.current.noiseSuppression);
      const inputId = settingsRef.current.inputDeviceId;

      if (enhancerRef.current) {
        enhancerRef.current.destroy();
        enhancerRef.current = null;
      }

      await r.localParticipant.setMicrophoneEnabled(true, {
        ...constraints,
        ...(inputId ? { deviceId: { exact: inputId } } : {}),
      });

      const lk = await import("livekit-client");
      const micPub = r.localParticipant.getTrackPublication(lk.Track.Source.Microphone);
      const localAudioTrack = micPub?.audioTrack;
      const rawTrack = localAudioTrack?.mediaStreamTrack;
      const needsEnhancer =
        settingsRef.current.noiseSuppression === "aggressive" ||
        settingsRef.current.micGain !== 1;
      let enhancerMode: "none" | "gain" | "full" = "none";

      if (needsEnhancer && localAudioTrack && rawTrack) {
        try {
          const enhancer = createAudioEnhancer(rawTrack, {
            micGain: settingsRef.current.micGain,
            gainOnly: settingsRef.current.noiseSuppression !== "aggressive",
          });
          await localAudioTrack.replaceTrack(enhancer.outputTrack);
          enhancerRef.current = enhancer;
          enhancerMode =
            settingsRef.current.noiseSuppression === "aggressive" ? "full" : "gain";
        } catch (enhErr) {
          console.warn("Audio enhancer failed, using raw mic:", enhErr);
        }
      }

      const currentTrack =
        r.localParticipant.getTrackPublication(lk.Track.Source.Microphone)?.audioTrack
          ?.mediaStreamTrack ?? null;
      if (currentTrack) {
        currentTrack.enabled = !preserveMuted;
      }

      publishedMicConfigRef.current = {
        inputDeviceId: inputId ?? null,
        noiseSuppression: settingsRef.current.noiseSuppression,
        enhancerMode,
      };
      setIsMicMuted(preserveMuted);
      refreshParticipants();
    },
    [refreshParticipants],
  );

  useEffect(() => {
    const r = roomRef.current;
    if (!r || state !== "connected") return;

    const published = publishedMicConfigRef.current;
    const nextEnhancerMode =
      settings.noiseSuppression === "aggressive"
        ? "full"
        : settings.micGain !== 1
        ? "gain"
        : "none";
    const needsRefresh =
      published.inputDeviceId !== (settings.inputDeviceId ?? null) ||
      published.noiseSuppression !== settings.noiseSuppression ||
      published.enhancerMode !== nextEnhancerMode;

    if (!needsRefresh) return;

    const preserveMuted =
      isDeafened ||
      settings.micActivationMode === "push_to_talk" ||
      (settings.micActivationMode === "voice_activity" && isMicMuted);

    void applyLocalMicrophoneSettings(r, preserveMuted).catch((e) => {
      console.warn("applyLocalMicrophoneSettings failed", e);
      setError(e instanceof Error ? e.message : "Не удалось применить настройки микрофона");
    });
  }, [
    settings.inputDeviceId,
    settings.noiseSuppression,
    settings.micGain,
    settings.micActivationMode,
    state,
    isMicMuted,
    isDeafened,
    applyLocalMicrophoneSettings,
  ]);

  useEffect(() => {
    refreshParticipants();
  }, [room, refreshParticipants]);

  useEffect(() => {
    refreshVisualTracks();
  }, [room, refreshVisualTracks]);

  const socketRef = useRef<Socket | null>(socket);
  socketRef.current = socket;

  const resetLocalVoiceState = useCallback(() => {
    for (const entry of remoteTracksRef.current.values()) {
      try {
        entry.audioEl.pause();
        entry.audioEl.srcObject = null;
        entry.audioEl.remove();
      } catch {
        /* ignore */
      }
    }
    remoteTracksRef.current.clear();
    if (enhancerRef.current) {
      enhancerRef.current.destroy();
      enhancerRef.current = null;
    }
    setRoom(null);
    setActiveChannelId(null);
    setState("disconnected");
    setParticipants([]);
    setVisualTracks([]);
    setIsCameraEnabled(false);
    setIsScreenShareEnabled(false);
  }, []);

  const leave = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    // Сначала уведомляем backend — это снимет нас из voice:state у других
    // участников быстрее чем disconnect Socket.io.
    socketRef.current?.emit(SocketEvents.VoiceLeave);
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
    // Закрываем audio enhancer (Web Audio context) если был активен
    if (enhancerRef.current) {
      enhancerRef.current.destroy();
      enhancerRef.current = null;
    }
    setRoom(null);
    setActiveChannelId(null);
    setState("disconnected");
    setParticipants([]);
    setVisualTracks([]);
    setIsCameraEnabled(false);
    setIsScreenShareEnabled(false);
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
      let voiceJoinEmitted = false;
      try {
        // v1.6.55 — token-fetch и lazy-import livekit-client (~140KB gzip)
        // независимы: раньше шли последовательно (sum латентностей), теперь
        // параллельно (max) — заметно быстрее первое подключение.
        const [data, lk] = await Promise.all([
          apiJson<JoinResponse>(
            `/api/channels/${encodeURIComponent(channelId)}/voice/join`,
            { method: "POST" },
          ),
          import("livekit-client"),
        ]);

        // Announce backend presence only after LiveKit is connected. Otherwise
        // clients can see ghost participants and stale voice state.
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
        r.on(RoomEvent.Disconnected, () => {
          if (roomRef.current !== r) return;
          socketRef.current?.emit(SocketEvents.VoiceLeave);
          resetLocalVoiceState();
        });
        r.on(RoomEvent.ParticipantConnected, refreshParticipants);
        r.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
        r.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
        r.on(RoomEvent.TrackMuted, refreshParticipants);
        r.on(RoomEvent.TrackUnmuted, refreshParticipants);
        r.on(RoomEvent.LocalTrackPublished, refreshParticipants);
        r.on(RoomEvent.LocalTrackUnpublished, refreshParticipants);
        r.on(RoomEvent.ConnectionQualityChanged, refreshParticipants);
        r.on(RoomEvent.ParticipantConnected, refreshVisualTracks);
        r.on(RoomEvent.ParticipantDisconnected, refreshVisualTracks);
        r.on(RoomEvent.TrackMuted, refreshVisualTracks);
        r.on(RoomEvent.TrackUnmuted, refreshVisualTracks);
        r.on(RoomEvent.LocalTrackPublished, refreshVisualTracks);
        r.on(RoomEvent.LocalTrackUnpublished, refreshVisualTracks);
        r.on(RoomEvent.ParticipantMetadataChanged, () => {
          refreshParticipants();
          refreshVisualTracks();
        });

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

            const profile = parseVoiceParticipantProfile(participant);
            const key = `${profile.userId}-${pub.trackSid}`;
            const entry: RemoteTrackEntry = {
              audioEl: el,
              track,
              publication: pub,
              participantIdentity: profile.userId,
            };
            remoteTracksRef.current.set(key, entry);
            applyRemoteAudioState(entry, isDeafened);
          }
          refreshVisualTracks();
        });
        r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach();
            const profile = parseVoiceParticipantProfile(participant);
            const key = `${profile.userId}-${pub.trackSid}`;
            const entry = remoteTracksRef.current.get(key);
            if (entry) {
              entry.audioEl.remove();
              remoteTracksRef.current.delete(key);
            }
          }
          refreshVisualTracks();
        });

        await r.connect(data.wsUrl, data.token);
        roomRef.current = r;
        setRoom(r);
        setActiveChannelId(channelId);

        socketRef.current?.emit(
          SocketEvents.VoiceJoin,
          { channelId },
          (err: string | null) => {
            if (err) console.warn("voice:join backend rejected:", err);
          },
        );
        voiceJoinEmitted = true;

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
        // v1.1.75 — mic публикуется ВСЕГДА (в т.ч. в PTT-режиме): тогда
        // enhancer-цепочка прикрепляется один раз на join и переживает
        // PTT. PTT/VAD глушат трек через mediaStreamTrack.enabled, не
        // пере-publish'ат (publication остаётся live — это важно для
        // LiveKit; muted-состояние сразу выставляется ниже).
        try {
          const isPtt = settingsRef.current.micActivationMode === "push_to_talk";
          await applyLocalMicrophoneSettings(r, isPtt);

          // v1.1.75 — PTT: трек опубликован (+ enhancer уже прикреплён),
          // глушим его до первого нажатия клавиши через
          // mediaStreamTrack.enabled=false. PTT-хендлеры дальше толкают
          // тот же флаг — enhancer-цепочка переживает нажатия.
          if (isPtt) {
            try {
              const lkm = await import("livekit-client");
              const ms = r.localParticipant
                .getTrackPublication(lkm.Track.Source.Microphone)
                ?.audioTrack?.mediaStreamTrack;
              if (ms) ms.enabled = false;
            } catch {
              /* no-op */
            }
          }
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
        refreshVisualTracks();

        return true;
      } catch (e) {
        // v1.6.55 — откат раннего presence-broadcast'а если LiveKit не поднялся:
        // иначе остальные видели бы нас «в комнате», хотя мы не подключились.
        if (voiceJoinEmitted) {
          socketRef.current?.emit(SocketEvents.VoiceLeave);
        }
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
    [
      activeChannelId,
      busy,
      leave,
      refreshParticipants,
      refreshVisualTracks,
      resetLocalVoiceState,
      state,
      applyRemoteAudioState,
      applyLocalMicrophoneSettings,
      isDeafened,
    ],
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

  const toggleCamera = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      const next = !r.localParticipant.isCameraEnabled;
      await r.localParticipant.setCameraEnabled(
        next,
        CAMERA_CAPTURE_OPTIONS,
        CAMERA_PUBLISH_OPTIONS,
      );
      refreshVisualTracks();
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Доступ к камере отклонён браузером"
          : e instanceof Error
          ? e.message
          : "Не удалось переключить камеру",
      );
    }
  }, [refreshVisualTracks]);

  const toggleScreenShare = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      const next = !r.localParticipant.isScreenShareEnabled;
      await r.localParticipant.setScreenShareEnabled(
        next,
        SCREEN_SHARE_CAPTURE_OPTIONS,
        SCREEN_SHARE_PUBLISH_OPTIONS,
      );
      refreshVisualTracks();
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Доступ к демонстрации экрана отклонён"
          : e instanceof Error
          ? e.message
          : "Не удалось переключить демонстрацию экрана",
      );
    }
  }, [refreshVisualTracks]);

  /**
   * Push-to-talk: глобально слушаем keydown/keyup. Активно только если
   * `settings.micActivationMode === 'push_to_talk'` И мы connected.
   */
  useEffect(() => {
    if (settings.micActivationMode !== "push_to_talk") return;
    if (state !== "connected") return;

    const key = settings.pttKey;
    let pressed = false;

    // v1.1.75 — PTT толкает mediaStreamTrack.enabled опубликованного
    // mic-трека (как VAD-gate), а НЕ setMicrophoneEnabled — последний
    // пере-acquire'ил raw-трек на каждое нажатие и ронял enhancer-цепочку
    // (mic gain + DSP). lk импортируем один раз для резолва публикации;
    // пока не загрузился / трек недоступен — fallback на старый
    // setMicrophoneEnabled (PTT не ломается, просто без enhancer).
    let lkMod: typeof import("livekit-client") | null = null;
    void import("livekit-client").then((m) => {
      lkMod = m;
    });

    const setMicLive = (live: boolean) => {
      const r = roomRef.current;
      const ms =
        lkMod && r
          ? r.localParticipant
              .getTrackPublication(lkMod.Track.Source.Microphone)
              ?.audioTrack?.mediaStreamTrack ?? null
          : null;
      if (ms) {
        ms.enabled = live;
        setIsMicMuted(!live);
        refreshParticipants();
      } else if (r) {
        // fallback — трек ещё не резолвится: старый путь.
        void r.localParticipant.setMicrophoneEnabled(live).then(() => {
          setIsMicMuted(!live);
          refreshParticipants();
        });
      }
    };

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
      setMicLive(true);
      e.preventDefault();
    };

    const onUp = (e: KeyboardEvent) => {
      if (!isPttKey(e)) return;
      if (!pressed) return;
      pressed = false;
      setPttActive(false);
      setMicLive(false);
      e.preventDefault();
    };

    const onBlur = () => {
      // Window lost focus — release mic если был зажат.
      if (pressed) {
        pressed = false;
        setPttActive(false);
        setMicLive(false);
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
  }, [settings.micActivationMode, settings.pttKey, state, refreshParticipants]);

  // Когда mode меняется на запущенной сессии — синхронизируем mic state.
  // Open / VAD → mic enabled (VAD сам потом отключит через gate).
  // PTT → mic muted, пока не зажмёшь клавишу.
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    if (state !== "connected") return;
    const setPublishedTrackEnabled = async (enabled: boolean) => {
      const lk = await import("livekit-client");
      const ms = r.localParticipant.getTrackPublication(lk.Track.Source.Microphone)
        ?.audioTrack?.mediaStreamTrack;
      if (ms) {
        ms.enabled = enabled;
        setIsMicMuted(!enabled);
        refreshParticipants();
        return true;
      }
      return false;
    };
    if (settings.micActivationMode === "push_to_talk") {
      if (!isMicMuted) {
        void setPublishedTrackEnabled(false).then((ok) => {
          if (!ok) {
            void r.localParticipant.setMicrophoneEnabled(false).then(() => {
              setIsMicMuted(true);
              refreshParticipants();
            });
          }
        });
      }
    } else {
      if (isMicMuted && !isDeafened) {
        void setPublishedTrackEnabled(true).then((ok) => {
          if (!ok) {
            void applyLocalMicrophoneSettings(r, false);
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.micActivationMode]);

  /**
   * Voice Activity Detection gate.
   * Активен когда `micActivationMode === 'voice_activity'` и мы connected.
   *
   * Подвешиваем Web Audio AnalyserNode к localParticipant.mic track'у,
   * 50ms раз меряем peak amplitude. Если > threshold → mediaStreamTrack.enabled = true.
   * Иначе false (тишина, не транслируем). enabled=false мгновенный, не вызывает
   * unpublish — другие участники видят pub.isMuted=true (через WebRTC ontrackmute).
   *
   * `mediaStreamTrack.enabled` toggle быстрее чем `setMicrophoneEnabled` — LiveKit
   * не делает heavy work (renegotiation), просто mute flag.
   */
  const vadVoiceActiveRef = useRef(false);
  useEffect(() => {
    if (settings.micActivationMode !== "voice_activity") return;
    if (state !== "connected") return;
    const r = roomRef.current;
    if (!r) return;

    let cancelled = false;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let intervalId: number | null = null;
    let releaseTimer: number | null = null;

    const setup = async () => {
      // Импортируем enum lazily — нужен Track.Source.Microphone
      const lk = await import("livekit-client");
      const pub = r.localParticipant.getTrackPublication(lk.Track.Source.Microphone);
      const track = pub?.audioTrack;
      const msTrack = track?.mediaStreamTrack;
      if (!msTrack || cancelled) return;

      stream = new MediaStream([msTrack]);
      const Ctx: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new Ctx();
      const src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      // Hold-time чтобы не мьютить на коротких паузах в речи (50-300ms).
      const HOLD_MS = 250;

      const tick = () => {
        if (cancelled || !analyser) return;
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        const threshold = settingsRef.current.vadThreshold;
        const above = peak >= threshold;
        if (above) {
          // Открываем gate сразу
          if (releaseTimer !== null) {
            window.clearTimeout(releaseTimer);
            releaseTimer = null;
          }
          if (!vadVoiceActiveRef.current) {
            vadVoiceActiveRef.current = true;
            msTrack.enabled = true;
            setIsMicMuted(false);
            refreshParticipants();
          }
        } else if (vadVoiceActiveRef.current && releaseTimer === null) {
          // Тишина — но даём hold-time перед закрытием gate
          releaseTimer = window.setTimeout(() => {
            if (cancelled) return;
            vadVoiceActiveRef.current = false;
            msTrack.enabled = false;
            setIsMicMuted(true);
            refreshParticipants();
            releaseTimer = null;
          }, HOLD_MS);
        }
      };

      // Стартуем gate в closed-state — пользователь должен заговорить.
      msTrack.enabled = false;
      vadVoiceActiveRef.current = false;
      setIsMicMuted(true);

      intervalId = window.setInterval(tick, 50);
    };

    void setup();

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      if (audioCtx) void audioCtx.close().catch(() => undefined);
      // Возвращаем track в always-on когда выходим из VAD режима
      const cur = roomRef.current;
      if (cur && state === "connected") {
        void import("livekit-client").then((lk) => {
          const pub = cur.localParticipant.getTrackPublication(lk.Track.Source.Microphone);
          const ms = pub?.audioTrack?.mediaStreamTrack;
          if (ms && !ms.enabled) ms.enabled = true;
        });
      }
      vadVoiceActiveRef.current = false;
    };
  }, [settings.micActivationMode, state, refreshParticipants]);

  /**
   * AFK auto-disconnect. Если ты один в voice room более N минут — leave.
   * Защищает от «забыл что в эфире», стандартное Discord-поведение.
   *
   * Алгоритм:
   * - timer rearm'ится каждый раз когда меняется participants.length:
   *   - participants.length > 1 → cancel timer (есть собеседник)
   *   - participants.length === 1 (только ты) → set timer на N минут
   */
  useEffect(() => {
    if (state !== "connected") return;
    if (settings.afkTimeoutMinutes <= 0) return;
    if (participants.length > 1) return; // не один — таймер не нужен
    const id = window.setTimeout(
      () => {
        // Leave only если всё ещё один и connected
        if (
          roomRef.current &&
          roomRef.current.remoteParticipants.size === 0
        ) {
          console.info(
            `[voice] AFK timeout (${settings.afkTimeoutMinutes}m alone) — auto-leave`,
          );
          void leave();
        }
      },
      settings.afkTimeoutMinutes * 60 * 1000,
    );
    return () => window.clearTimeout(id);
  }, [state, settings.afkTimeoutMinutes, participants.length, leave]);

  useEffect(() => {
    return () => {
      void leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Broadcast mic/deafen-состояния на backend при каждом изменении (пока
   * connected). Backend рассылает дельту участникам сервера — sidebar у всех
   * показывает актуальные Discord-style mute/deafen-иконки.
   */
  useEffect(() => {
    if (state !== "connected") return;
    if (!activeChannelId) return;
    socketRef.current?.emit(SocketEvents.VoiceMetaUpdate, {
      micMuted: isMicMuted,
      deafened: isDeafened,
    });
  }, [state, activeChannelId, isMicMuted, isDeafened]);

  /**
   * Broadcast собственного speaking-состояния на backend. Backend рассылает
   * дельту участникам сервера — speaking-glow виден во ВСЕХ voice-каналах
   * sidebar, не только в своей комнате. `localSpeaking` берётся из LiveKit
   * ActiveSpeakers (событийный, не polling), при muted mic — всегда false.
   */
  const localSpeaking = participants.find((p) => p.isLocal)?.isSpeaking ?? false;
  useEffect(() => {
    if (state !== "connected") return;
    if (!activeChannelId) return;
    socketRef.current?.emit(SocketEvents.VoiceSpeakingUpdate, {
      speaking: localSpeaking && !isMicMuted,
    });
  }, [state, activeChannelId, localSpeaking, isMicMuted]);

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
    isCameraEnabled,
    isScreenShareEnabled,
    visualTracks,
    pttActive,
    join,
    leave,
    toggleMic,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    // settings passthrough — для UI элементов
    settings,
    setInputDevice,
    setOutputDevice,
    setNoiseSuppression,
    setMicActivationMode,
    setPttKey,
    setVadThreshold,
    setAfkTimeout,
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
