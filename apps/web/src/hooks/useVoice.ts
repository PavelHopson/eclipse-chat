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
import { playNotificationSound } from "../lib/notificationSounds";
import { useVoiceFeedback } from "./useVoiceFeedback";

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
  /** For screen shares, whether the browser supplied a separate audio track. */
  hasAudio?: boolean;
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
  // The browser picker remains the consent boundary. Requesting audio only
  // makes its native "share audio" option available; unsupported surfaces
  // continue as video-only screen shares.
  audio: true,
  systemAudio: "include" as const,
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

function hasActiveScreenShareAudio(
  publications: Iterable<{ source: string; isMuted: boolean }>,
): boolean {
  for (const publication of publications) {
    if (publication.source === "screen_share_audio" && !publication.isMuted) return true;
  }
  return false;
}

type MicrophonePolicy = {
  mode: "open" | "push_to_talk" | "voice_activity";
  manuallyMuted: boolean;
  deafened: boolean;
  documentVisible: boolean;
  pttActive: boolean;
  vadActive: boolean;
};

function shouldTransmitMicrophone(policy: MicrophonePolicy): boolean {
  if (policy.manuallyMuted || policy.deafened) return false;
  if (policy.mode === "open") return true;
  if (!policy.documentVisible) return false;
  return policy.mode === "push_to_talk" ? policy.pttActive : policy.vadActive;
}

function shouldCaptureMicrophone(policy: MicrophonePolicy): boolean {
  if (policy.manuallyMuted || policy.deafened) return false;
  if (policy.mode === "open") return true;
  if (!policy.documentVisible) return false;
  return policy.mode === "voice_activity" || policy.pttActive;
}

function applyMicrophoneTrackPolicy(
  room: RoomType,
  enhancer: AudioEnhancerHandle | null,
  policy: MicrophonePolicy,
): { capture: boolean; transmit: boolean } {
  const capture = shouldCaptureMicrophone(policy);
  const transmit = shouldTransmitMicrophone(policy);
  enhancer?.setInputEnabled(capture);
  enhancer?.setOutputEnabled(transmit);
  for (const publication of room.localParticipant.audioTrackPublications.values()) {
    if (publication.source === "microphone") {
      const track = publication.audioTrack?.mediaStreamTrack;
      if (track) track.enabled = transmit;
    }
  }
  return { capture, transmit };
}

function disableRawMicrophoneTracks(
  room: RoomType,
  enhancer: AudioEnhancerHandle | null = null,
): void {
  enhancer?.setInputEnabled(false);
  enhancer?.setOutputEnabled(false);
  for (const publication of room.localParticipant.audioTrackPublications.values()) {
    if (publication.source === "microphone") {
      const track = publication.audioTrack?.mediaStreamTrack;
      if (track) track.enabled = false;
    }
  }
}

async function publishPreMutedMicrophone(
  lk: typeof import("livekit-client"),
  room: RoomType,
  captureOptions: Parameters<typeof lk.createLocalAudioTrack>[0],
  enhancerOptions: { micGain: number; gainOnly: boolean } | null,
): Promise<{
  publication: Awaited<ReturnType<RoomType["localParticipant"]["publishTrack"]>>;
  enhancer: AudioEnhancerHandle | null;
}> {
  const captureTrack = await lk.createLocalAudioTrack(captureOptions);
  // getUserMedia resolves with enabled=true. Close it synchronously before
  // any publish/replace await so PTT/VAD/device races cannot leak a frame.
  captureTrack.mediaStreamTrack.enabled = false;
  let enhancer: AudioEnhancerHandle | null = null;
  let publishTrack = captureTrack;

  try {
    if (enhancerOptions) {
      enhancer = createAudioEnhancer(captureTrack.mediaStreamTrack, enhancerOptions);
      enhancer.setInputEnabled(false);
      enhancer.setOutputEnabled(false);
      publishTrack = new lk.LocalAudioTrack(
        enhancer.outputTrack,
        captureTrack.constraints,
        true,
      );
    }
    const publication = await room.localParticipant.publishTrack(publishTrack, {
      source: lk.Track.Source.Microphone,
    });
    return { publication, enhancer };
  } catch (error) {
    if (enhancer) enhancer.destroy();
    else captureTrack.stop();
    throw error;
  }
}

const AUDIO_PLAYBACK_ERROR = "Браузер приостановил звук. Нажми «Включить звук», чтобы продолжить без переподключения.";
const OUTPUT_DEVICE_ERROR = "Не удалось переключить вывод звука. Выбери другое устройство в настройках.";
const OUTPUT_SINK_ERROR = "Не удалось применить устройство вывода звука.";
const INPUT_DEVICE_ERROR = "Не удалось переключить микрофон. Выбери другое устройство в настройках.";

function voiceDisconnectMessage(reason: unknown): string {
  if (reason === 2) return "Этот профиль подключился к звонку с другого устройства. Подключись снова здесь, если это было неожиданно.";
  if (reason === 4) return "Доступ к голосовой комнате отозван. Обнови страницу или обратись к администратору.";
  if (reason === 5 || reason === 10) return "Голосовая комната закрыта. Выбери другую комнату.";
  if (reason === 3) return "Голосовой сервер перезапускается. Подключись снова через несколько секунд.";
  return "Связь прервалась и не восстановилась. Нажми «Войти», чтобы подключиться снова.";
}

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
  const micCaptureAllowedRef = useRef(true);
  const micManuallyMutedRef = useRef(false);
  const documentVisibleRef = useRef(
    typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const deafenedRef = useRef(isDeafened);
  deafenedRef.current = isDeafened;
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [isAudioPlaybackBlocked, setIsAudioPlaybackBlocked] = useState(false);
  const [inputTrackRevision, setInputTrackRevision] = useState(0);
  const [visualTracks, setVisualTracks] = useState<VoiceVisualTrack[]>([]);
  /** True пока удерживается PTT hotkey. */
  const [pttActive, setPttActive] = useState(false);
  const pttActiveRef = useRef(false);
  const vadVoiceActiveRef = useRef(false);
  useVoiceFeedback({
    channelId: activeChannelId, connection: state, micMuted: isMicMuted, deafened: isDeafened,
    camera: isCameraEnabled, screen: isScreenShareEnabled,
    pushToTalk: settings.micActivationMode === "push_to_talk", error,
  });

  const roomRef = useRef<RoomType | null>(null);
  roomRef.current = room;
  const intentionalDisconnectsRef = useRef(new WeakSet<RoomType>());

  /** identity-trackSid → entry. Используется для cleanup, volume, stats. */
  const remoteTracksRef = useRef<Map<string, RemoteTrackEntry>>(new Map());

  /**
   * Audio enhancer handle — Web Audio mic-цепочка перед publish. Активен
   * всегда в эфире: gain-стадия (mic gain) во всех режимах + полная
   * DSP-цепочка дополнительно в режиме noiseSuppression="aggressive".
   */
  const enhancerRef = useRef<AudioEnhancerHandle | null>(null);
  const microphoneApplyGenerationRef = useRef(0);
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
    const targetId = settings.outputDeviceId ?? "default";
    // LiveKit Room.switchActiveDevice
    void r
      .switchActiveDevice("audiooutput", targetId)
      .then(() => setError(current => current === OUTPUT_DEVICE_ERROR ? null : current))
      .catch(() => setError(OUTPUT_DEVICE_ERROR));
    // setSinkId на каждом audio-элементе (для уже attached tracks)
    for (const entry of remoteTracksRef.current.values()) {
      const el = entry.audioEl as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (typeof el.setSinkId === "function") {
        el.setSinkId(targetId)
          .then(() => setError(current => current === OUTPUT_SINK_ERROR ? null : current))
          .catch(() => setError(OUTPUT_SINK_ERROR));
      }
    }
  }, [settings.outputDeviceId]);

  // Если input device или noise mode сменились — переподписываем mic трек
  // (LiveKit Room.switchActiveDevice + republish mic).
  useEffect(() => {
    const r = roomRef.current;
    if (!r || !micCaptureAllowedRef.current) return;
    const targetId = settings.inputDeviceId ?? "default";
    if (targetId) {
      // Close the current raw track synchronously. The SDK switch can replace
      // tracks asynchronously, so keep capture closed until the selected
      // device is reacquired and the central policy has been applied.
      disableRawMicrophoneTracks(r, enhancerRef.current);
      micCaptureAllowedRef.current = false;
      setIsMicMuted(true);
      void (async () => {
        try {
          await r.localParticipant.setMicrophoneEnabled(false);
          disableRawMicrophoneTracks(r, enhancerRef.current);
          if (roomRef.current !== r) return;
          await r.switchActiveDevice("audioinput", targetId);
          if (
            roomRef.current !== r ||
            micManuallyMutedRef.current ||
            deafenedRef.current
          ) return;
          micCaptureAllowedRef.current = true;
          await applyLocalMicrophoneSettings(r);
          if (roomRef.current !== r) return;
          setError(current => current === INPUT_DEVICE_ERROR ? null : current);
        } catch {
          disableRawMicrophoneTracks(r, enhancerRef.current);
          micManuallyMutedRef.current = true;
          micCaptureAllowedRef.current = false;
          setIsMicMuted(true);
          setError(INPUT_DEVICE_ERROR);
        }
      })();
    }
    // applyLocalMicrophoneSettings is stable; this effect intentionally runs
    // only when the selected input changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      hasScreenAudio: boolean,
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
        hasAudio: publication.source === "screen_share" ? hasScreenAudio : undefined,
        track: publication.videoTrack,
      });
    };

    const localHasScreenAudio = hasActiveScreenShareAudio(
      r.localParticipant.audioTrackPublications.values(),
    );
    for (const pub of r.localParticipant.videoTrackPublications.values()) {
      const profile = parseVoiceParticipantProfile(r.localParticipant);
      pushTrack(
        pub as unknown as VideoPublicationLike,
        profile.userId,
        profile.displayName,
        true,
        localHasScreenAudio,
      );
    }

    for (const participant of r.remoteParticipants.values()) {
      const profile = parseVoiceParticipantProfile(participant);
      const remoteHasScreenAudio = hasActiveScreenShareAudio(
        participant.audioTrackPublications.values(),
      );
      for (const pub of participant.videoTrackPublications.values()) {
        pushTrack(
          pub as unknown as VideoPublicationLike,
          profile.userId,
          profile.displayName,
          false,
          remoteHasScreenAudio,
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
    async (r: RoomType) => {
      const generation = ++microphoneApplyGenerationRef.current;
      const isCurrent = () =>
        microphoneApplyGenerationRef.current === generation && roomRef.current === r;
      const constraints = noiseModeToConstraints(settingsRef.current.noiseSuppression);
      const inputId = settingsRef.current.inputDeviceId;

      disableRawMicrophoneTracks(r, enhancerRef.current);
      if (enhancerRef.current) {
        enhancerRef.current.destroy();
        enhancerRef.current = null;
      }

      const lk = await import("livekit-client");
      if (!isCurrent() || !micCaptureAllowedRef.current) return;
      const previousTrack = r.localParticipant.getTrackPublication(lk.Track.Source.Microphone)
        ?.audioTrack;
      if (previousTrack) {
        await r.localParticipant.unpublishTrack(previousTrack, true);
        if (!isCurrent() || !micCaptureAllowedRef.current) return;
      }

      const needsEnhancer =
        settingsRef.current.noiseSuppression === "aggressive" ||
        settingsRef.current.micGain !== 1 ||
        settingsRef.current.micActivationMode === "voice_activity";
      const enhancerMode: "none" | "gain" | "full" = needsEnhancer
        ? settingsRef.current.noiseSuppression === "aggressive" ? "full" : "gain"
        : "none";
      const result = await publishPreMutedMicrophone(
        lk,
        r,
        {
          ...constraints,
          ...(inputId ? { deviceId: { exact: inputId } } : {}),
        },
        needsEnhancer
          ? {
              micGain: settingsRef.current.micGain,
              gainOnly: settingsRef.current.noiseSuppression !== "aggressive",
            }
          : null,
      );
      if (!isCurrent() || !micCaptureAllowedRef.current) {
        const publishedTrack = result.publication.audioTrack ?? result.publication.track;
        if (publishedTrack) {
          await r.localParticipant.unpublishTrack(publishedTrack, true).catch(() => undefined);
        }
        result.enhancer?.destroy();
        return;
      }
      enhancerRef.current = result.enhancer;

      const policy: MicrophonePolicy = {
        mode: settingsRef.current.micActivationMode,
        manuallyMuted: micManuallyMutedRef.current,
        deafened: deafenedRef.current,
        documentVisible: documentVisibleRef.current,
        pttActive: pttActiveRef.current,
        vadActive: vadVoiceActiveRef.current,
      };
      const { transmit } = applyMicrophoneTrackPolicy(r, enhancerRef.current, policy);

      // Deafen/manual mute may have happened while permission or publishing was
      // pending. Both tracks stayed disabled throughout; now revoke the SDK
      // publication too so the server state also fails closed.
      if (deafenedRef.current || micManuallyMutedRef.current) {
        disableRawMicrophoneTracks(r, enhancerRef.current);
        await r.localParticipant.setMicrophoneEnabled(false);
        if (!isCurrent()) return;
        micCaptureAllowedRef.current = false;
      }

      publishedMicConfigRef.current = {
        inputDeviceId: inputId ?? null,
        noiseSuppression: settingsRef.current.noiseSuppression,
        enhancerMode,
      };
      setIsMicMuted(!transmit);
      setInputTrackRevision(revision => revision + 1);
      refreshParticipants();
    },
    [refreshParticipants],
  );

  useEffect(() => {
    const r = roomRef.current;
    if (!r || state !== "connected" || !micCaptureAllowedRef.current) return;

    const published = publishedMicConfigRef.current;
    const nextEnhancerMode =
      settings.noiseSuppression === "aggressive"
        ? "full"
        : settings.micGain !== 1 || settings.micActivationMode === "voice_activity"
        ? "gain"
        : "none";
    const needsRefresh =
      published.inputDeviceId !== (settings.inputDeviceId ?? null) ||
      published.noiseSuppression !== settings.noiseSuppression ||
      published.enhancerMode !== nextEnhancerMode;

    // Defer reconfiguration until an explicit unmute. The SDK's enable call
    // can transmit before a later raw-track mute, even if the final UI says muted.
    if (!needsRefresh || isMicMuted || isDeafened || settings.micActivationMode === "push_to_talk") return;

    void applyLocalMicrophoneSettings(r).catch((e) => {
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
    microphoneApplyGenerationRef.current += 1;
    micCaptureAllowedRef.current = false;
    pttActiveRef.current = false;
    vadVoiceActiveRef.current = false;
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
    setIsAudioPlaybackBlocked(false);
    setPttActive(false);
  }, []);

  const leave = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    intentionalDisconnectsRef.current.add(r);
    microphoneApplyGenerationRef.current += 1;
    micCaptureAllowedRef.current = false;
    pttActiveRef.current = false;
    vadVoiceActiveRef.current = false;
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
    setPttActive(false);
  }, []);

  const join = useCallback(
    async (channelId: string, options: { muted?: boolean } = {}): Promise<boolean> => {
      setError(null);
      if (busy) return false;
      if (activeChannelId === channelId && state === "connected") return true;
      if (roomRef.current) {
        await leave();
      }
      micManuallyMutedRef.current = Boolean(options.muted);
      micCaptureAllowedRef.current = !options.muted;
      setIsMicMuted(Boolean(options.muted));
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
        // Existing participants can be replayed while the initial connection is
        // forming. Do not announce that roster as a burst of "joined" sounds.
        let voiceSoundReady = false;
        const onParticipantConnected = (participant: RemoteParticipant) => {
          refreshParticipants();
          refreshVisualTracks();
          if (
            !voiceSoundReady ||
            r.state !== lk.ConnectionState.Connected
          ) {
            return;
          }
          const profile = parseVoiceParticipantProfile(participant);
          playNotificationSound("voiceJoin", {
            key: `${channelId}:${profile.userId}`,
          });
        };
        const onParticipantDisconnected = (participant: RemoteParticipant) => {
          refreshParticipants();
          refreshVisualTracks();
          if (
            !voiceSoundReady ||
            r.state !== lk.ConnectionState.Connected
          ) {
            return;
          }
          const profile = parseVoiceParticipantProfile(participant);
          playNotificationSound("voiceLeave", {
            key: `${channelId}:${profile.userId}`,
          });
        };

        r.on(RoomEvent.ConnectionStateChanged, (s) => {
          if (s === lk.ConnectionState.Connected) setState("connected");
          else if (s === lk.ConnectionState.Connecting) setState("connecting");
          else if (s === lk.ConnectionState.Reconnecting) setState("reconnecting");
          else setState("disconnected");
        });
        r.on(RoomEvent.Disconnected, (reason) => {
          if (roomRef.current !== r) return;
          const intentional = intentionalDisconnectsRef.current.has(r) || reason === 1;
          socketRef.current?.emit(SocketEvents.VoiceLeave);
          resetLocalVoiceState();
          if (!intentional) setError(voiceDisconnectMessage(reason));
        });
        r.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (roomRef.current !== r) return;
          setIsAudioPlaybackBlocked(!r.canPlaybackAudio);
          for (const entry of remoteTracksRef.current.values()) {
            applyRemoteAudioState(entry, deafenedRef.current);
          }
        });
        r.on(RoomEvent.ParticipantConnected, onParticipantConnected);
        r.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
        r.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
        r.on(RoomEvent.TrackMuted, refreshParticipants);
        r.on(RoomEvent.TrackUnmuted, refreshParticipants);
        r.on(RoomEvent.LocalTrackPublished, refreshParticipants);
        r.on(RoomEvent.LocalTrackUnpublished, refreshParticipants);
        r.on(RoomEvent.ConnectionQualityChanged, refreshParticipants);
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
            applyRemoteAudioState(entry, deafenedRef.current);
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
        voiceSoundReady = true;
        roomRef.current = r;
        setRoom(r);
        setActiveChannelId(channelId);
        setIsAudioPlaybackBlocked(!r.canPlaybackAudio);

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

        // Capture and any DSP output are disabled before LiveKit sees the
        // track. The current open/PTT/VAD policy is applied only after publish.
        try {
          if (!options.muted) await applyLocalMicrophoneSettings(r);
          else setIsMicMuted(true);
        } catch (micErr) {
          micManuallyMutedRef.current = true;
          micCaptureAllowedRef.current = false;
          setIsMicMuted(true);
          disableRawMicrophoneTracks(r, enhancerRef.current);
          try {
            await r.localParticipant.setMicrophoneEnabled(false);
          } catch {
            /* no active microphone publication */
          }
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
      const nextManualMute = !micManuallyMutedRef.current;
      micManuallyMutedRef.current = nextManualMute;
      if (nextManualMute || deafenedRef.current) {
        micCaptureAllowedRef.current = false;
        disableRawMicrophoneTracks(r, enhancerRef.current);
        await r.localParticipant.setMicrophoneEnabled(false);
        setIsMicMuted(true);
      } else {
        micCaptureAllowedRef.current = true;
        await applyLocalMicrophoneSettings(r);
      }
      setError(null);
      refreshParticipants();
    } catch (e) {
      micManuallyMutedRef.current = true;
      micCaptureAllowedRef.current = false;
      setIsMicMuted(true);
      disableRawMicrophoneTracks(r, enhancerRef.current);
      try {
        await r.localParticipant.setMicrophoneEnabled(false);
      } catch {
        /* best-effort fail-closed retry */
      }
      setError(e instanceof Error ? e.message : "Не удалось переключить микрофон");
    }
  }, [refreshParticipants, applyLocalMicrophoneSettings]);

  const toggleDeafen = useCallback(async () => {
    const next = !isDeafened;
    deafenedRef.current = next;
    // Применяем mute к всем audio elements (учитывая per-participant mute из settings).
    for (const entry of remoteTracksRef.current.values()) {
      applyRemoteAudioState(entry, next);
    }
    setIsDeafened(next);
    if (next) {
      micCaptureAllowedRef.current = false;
      pttActiveRef.current = false;
      vadVoiceActiveRef.current = false;
      setPttActive(false);
      setIsMicMuted(true);
      const activeRoom = roomRef.current;
      if (activeRoom) {
        disableRawMicrophoneTracks(activeRoom, enhancerRef.current);
        try {
          await activeRoom.localParticipant.setMicrophoneEnabled(false);
        } catch (err) {
          disableRawMicrophoneTracks(activeRoom, enhancerRef.current);
          console.warn("Failed to stop microphone while deafening", err);
        }
      }
    } else if (!micManuallyMutedRef.current) {
      const activeRoom = roomRef.current;
      if (activeRoom) {
        try {
          micCaptureAllowedRef.current = true;
          await applyLocalMicrophoneSettings(activeRoom);
        } catch (err) {
          micManuallyMutedRef.current = true;
          micCaptureAllowedRef.current = false;
          setIsMicMuted(true);
          setError(err instanceof Error ? err.message : "Не удалось включить микрофон");
        }
      }
    }
    refreshParticipants();
  }, [isDeafened, refreshParticipants, applyRemoteAudioState, applyLocalMicrophoneSettings]);

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
      setError(null);
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
      const publication = await r.localParticipant.setScreenShareEnabled(
        next,
        SCREEN_SHARE_CAPTURE_OPTIONS,
        SCREEN_SHARE_PUBLISH_OPTIONS,
      );
      if (roomRef.current !== r) {
        // A browser permission prompt may resolve after leave/switch. Disable
        // the whole LiveKit screen source so both video and its optional audio
        // publication are released, then stop the returned track as fallback.
        try {
          await r.localParticipant.setScreenShareEnabled(false);
        } catch {
          /* best-effort stale cleanup */
        }
        publication?.track?.stop();
        return;
      }
      setError(null);
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

  const resumeAudioPlayback = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await r.startAudio();
      if (roomRef.current !== r) return;
      for (const entry of remoteTracksRef.current.values()) {
        applyRemoteAudioState(entry, deafenedRef.current);
      }
      setIsAudioPlaybackBlocked(!r.canPlaybackAudio);
      if (r.canPlaybackAudio) {
        setError(current => current === AUDIO_PLAYBACK_ERROR ? null : current);
      }
    } catch {
      if (roomRef.current !== r) return;
      setIsAudioPlaybackBlocked(true);
      setError(AUDIO_PLAYBACK_ERROR);
    }
  }, [applyRemoteAudioState]);

  /**
   * Push-to-talk: глобально слушаем keydown/keyup. Активно только если
   * `settings.micActivationMode === 'push_to_talk'` И мы connected.
   */
  useEffect(() => {
    if (settings.micActivationMode !== "push_to_talk") return;
    if (state !== "connected") return;

    const key = settings.pttKey;
    let pressed = false;

    const setMicLive = (live: boolean) => {
      const r = roomRef.current;
      if (!r) return;
      const gate = applyMicrophoneTrackPolicy(r, enhancerRef.current, {
        mode: "push_to_talk",
        manuallyMuted: micManuallyMutedRef.current,
        deafened: deafenedRef.current,
        documentVisible: documentVisibleRef.current,
        pttActive: live,
        vadActive: false,
      });
      if (gate.transmit) micCaptureAllowedRef.current = true;
      const hasPublication = Array.from(r.localParticipant.audioTrackPublications.values())
        .some(publication => publication.source === "microphone");
      setIsMicMuted(!gate.transmit);
      refreshParticipants();
      if (gate.transmit && !hasPublication) {
        setError("Микрофон недоступен. Проверь разрешение и войди в комнату снова.");
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
      if (deafenedRef.current) return;
      if (micManuallyMutedRef.current || !documentVisibleRef.current) return;
      if (e.repeat) return;
      if (pressed) return;
      pressed = true;
      pttActiveRef.current = true;
      setPttActive(true);
      setMicLive(true);
      e.preventDefault();
    };

    const onUp = (e: KeyboardEvent) => {
      if (!isPttKey(e)) return;
      if (!pressed) return;
      pressed = false;
      pttActiveRef.current = false;
      setPttActive(false);
      setMicLive(false);
      e.preventDefault();
    };

    const onBlur = () => {
      // Window lost focus — release mic если был зажат.
      if (pressed) {
        pressed = false;
        pttActiveRef.current = false;
        setPttActive(false);
        setMicLive(false);
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      pttActiveRef.current = false;
      if (pressed) setMicLive(false);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [settings.micActivationMode, settings.pttKey, state, refreshParticipants]);

  useEffect(() => {
    const onVisibilityChange = () => {
      documentVisibleRef.current = document.visibilityState !== "hidden";
      if (!documentVisibleRef.current) {
        pttActiveRef.current = false;
        vadVoiceActiveRef.current = false;
        setPttActive(false);
      }
      // Rebind VAD when returning and invalidate any analyser bound to the old
      // device. PTT/VAD close immediately while hidden; open-mic calls remain
      // active so ordinary background conversations are not interrupted.
      setInputTrackRevision(revision => revision + 1);
      const activeRoom = roomRef.current;
      if (!activeRoom) return;
      const { transmit } = applyMicrophoneTrackPolicy(activeRoom, enhancerRef.current, {
        mode: settingsRef.current.micActivationMode,
        manuallyMuted: micManuallyMutedRef.current,
        deafened: deafenedRef.current,
        documentVisible: documentVisibleRef.current,
        pttActive: pttActiveRef.current,
        vadActive: vadVoiceActiveRef.current,
      });
      setIsMicMuted(!transmit);
      refreshParticipants();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refreshParticipants]);

  // Когда mode меняется на запущенной сессии — синхронизируем mic state.
  // Open / VAD → mic enabled (VAD сам потом отключит через gate).
  // PTT → mic muted, пока не зажмёшь клавишу.
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    if (state !== "connected") return;
    const setPublishedTrackEnabled = (enabled: boolean) => {
      const gate = applyMicrophoneTrackPolicy(r, enhancerRef.current, {
        mode: enabled ? "open" : settingsRef.current.micActivationMode,
        manuallyMuted: micManuallyMutedRef.current,
        deafened: deafenedRef.current,
        documentVisible: documentVisibleRef.current,
        pttActive: false,
        vadActive: false,
      });
      setIsMicMuted(!gate.transmit);
      refreshParticipants();
      return Array.from(r.localParticipant.audioTrackPublications.values())
        .some(publication => publication.source === "microphone");
    };
    pttActiveRef.current = false;
    vadVoiceActiveRef.current = false;
    setPttActive(false);
    const captureAllowed =
      !micManuallyMutedRef.current && !deafenedRef.current;
    const shouldTransmit =
      settings.micActivationMode === "open" && captureAllowed;
    const hasPublication = setPublishedTrackEnabled(shouldTransmit);
    const needsVadPipeline =
      settings.micActivationMode === "voice_activity" && !enhancerRef.current;
    if ((!hasPublication || needsVadPipeline) && captureAllowed && roomRef.current === r) {
        micCaptureAllowedRef.current = true;
        void applyLocalMicrophoneSettings(r).catch(err => {
          micCaptureAllowedRef.current = false;
          micManuallyMutedRef.current = true;
          setIsMicMuted(true);
          setError(err instanceof Error ? err.message : "Не удалось включить микрофон");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.micActivationMode]);

  /**
   * Voice Activity Detection gate.
   * Активен когда `micActivationMode === 'voice_activity'` и мы connected.
   *
   * Analyser reads a private raw input before the DSP/output gate. The raw input
   * is never published; only the processed output can reach LiveKit. This lets
   * VAD hear locally while the published track remains disabled.
   *
   * `mediaStreamTrack.enabled` toggle быстрее чем `setMicrophoneEnabled` — LiveKit
   * не делает heavy work (renegotiation), просто mute flag.
   */
  useEffect(() => {
    if (settings.micActivationMode !== "voice_activity") return;
    if (state !== "connected") return;
    if (isDeafened) return;
    if (micManuallyMutedRef.current || !documentVisibleRef.current) return;
    const r = roomRef.current;
    if (!r) return;

    let cancelled = false;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let boundInputTrack: MediaStreamTrack | null = null;
    let boundPublishedTrack: MediaStreamTrack | null = null;
    let boundEnhancer: AudioEnhancerHandle | null = null;
    let intervalId: number | null = null;
    let releaseTimer: number | null = null;

    const setup = async () => {
      // Импортируем enum lazily — нужен Track.Source.Microphone
      const lk = await import("livekit-client");
      const pub = r.localParticipant.getTrackPublication(lk.Track.Source.Microphone);
      const track = pub?.audioTrack;
      const publishedTrack = track?.mediaStreamTrack;
      const enhancer = enhancerRef.current;
      const inputTrack = enhancer?.inputTrack;
      if (
        !publishedTrack ||
        !inputTrack ||
        cancelled ||
        deafenedRef.current ||
        micManuallyMutedRef.current ||
        !documentVisibleRef.current
      ) return;
      boundInputTrack = inputTrack;
      boundPublishedTrack = publishedTrack;
      boundEnhancer = enhancer;
      const isBindingCurrent = () =>
        roomRef.current === r &&
        enhancerRef.current === boundEnhancer &&
        r.localParticipant.getTrackPublication(lk.Track.Source.Microphone)
          ?.audioTrack?.mediaStreamTrack === boundPublishedTrack;

      stream = new MediaStream([inputTrack]);
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
        if (!isBindingCurrent()) return;
        if (
          deafenedRef.current ||
          micManuallyMutedRef.current ||
          !documentVisibleRef.current
        ) {
          if (releaseTimer !== null) {
            window.clearTimeout(releaseTimer);
            releaseTimer = null;
          }
          vadVoiceActiveRef.current = false;
          applyMicrophoneTrackPolicy(r, boundEnhancer, {
            mode: "voice_activity",
            manuallyMuted: micManuallyMutedRef.current,
            deafened: deafenedRef.current,
            documentVisible: documentVisibleRef.current,
            pttActive: false,
            vadActive: false,
          });
          setIsMicMuted(true);
          return;
        }
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
            const { transmit } = applyMicrophoneTrackPolicy(r, boundEnhancer, {
              mode: "voice_activity",
              manuallyMuted: micManuallyMutedRef.current,
              deafened: deafenedRef.current,
              documentVisible: documentVisibleRef.current,
              pttActive: false,
              vadActive: true,
            });
            setIsMicMuted(!transmit);
            refreshParticipants();
          }
        } else if (vadVoiceActiveRef.current && releaseTimer === null) {
          // Тишина — но даём hold-time перед закрытием gate
          releaseTimer = window.setTimeout(() => {
            if (cancelled || !isBindingCurrent()) return;
            vadVoiceActiveRef.current = false;
            applyMicrophoneTrackPolicy(r, boundEnhancer, {
              mode: "voice_activity",
              manuallyMuted: micManuallyMutedRef.current,
              deafened: deafenedRef.current,
              documentVisible: documentVisibleRef.current,
              pttActive: false,
              vadActive: false,
            });
            setIsMicMuted(true);
            refreshParticipants();
            releaseTimer = null;
          }, HOLD_MS);
        }
      };

      // Стартуем gate в closed-state — пользователь должен заговорить.
      vadVoiceActiveRef.current = false;
      applyMicrophoneTrackPolicy(r, enhancer, {
        mode: "voice_activity",
        manuallyMuted: micManuallyMutedRef.current,
        deafened: deafenedRef.current,
        documentVisible: documentVisibleRef.current,
        pttActive: false,
        vadActive: false,
      });
      setIsMicMuted(true);

      intervalId = window.setInterval(tick, 50);
    };

    void setup();

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      if (audioCtx) void audioCtx.close().catch(() => undefined);
      vadVoiceActiveRef.current = false;
      // Never let an obsolete analyser reopen a replacement track. Only the
      // currently published track receives the policy for the current mode.
      const cur = roomRef.current;
      if (cur && state === "connected") {
        void import("livekit-client").then((lk) => {
          const pub = cur.localParticipant.getTrackPublication(lk.Track.Source.Microphone);
          const ms = pub?.audioTrack?.mediaStreamTrack;
          if (
            !ms ||
            ms !== boundPublishedTrack ||
            enhancerRef.current !== boundEnhancer ||
            boundEnhancer?.inputTrack !== boundInputTrack
          ) return;
          const { transmit } = applyMicrophoneTrackPolicy(cur, boundEnhancer, {
            mode: settingsRef.current.micActivationMode,
            manuallyMuted: micManuallyMutedRef.current,
            deafened: deafenedRef.current,
            documentVisible: documentVisibleRef.current,
            pttActive: pttActiveRef.current,
            vadActive: false,
          });
          setIsMicMuted(!transmit);
        });
      }
    };
  }, [settings.micActivationMode, settings.inputDeviceId, inputTrackRevision, state, isDeafened, refreshParticipants]);

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

  const getSpeechLevel = useCallback((identity: string): number => {
    const active = roomRef.current;
    if (!active) return 0;
    const people = [active.localParticipant, ...active.remoteParticipants.values()];
    const person = people.find(candidate => parseVoiceParticipantProfile(candidate).userId === identity);
    return person?.audioLevel ?? 0;
  }, []);

  return {
    getSpeechLevel,
    state,
    participants,
    activeChannelId,
    error,
    busy,
    isMicMuted,
    isDeafened,
    isCameraEnabled,
    isScreenShareEnabled,
    isAudioPlaybackBlocked,
    visualTracks,
    pttActive,
    join,
    leave,
    toggleMic,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    resumeAudioPlayback,
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
