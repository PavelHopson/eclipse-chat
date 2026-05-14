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
   * Audio enhancer handle — Web Audio DSP-цепочка для mic-трека.
   * Активен только в режиме noiseSuppression="aggressive". null иначе.
   */
  const enhancerRef = useRef<AudioEnhancerHandle | null>(null);

  /** Snapshot последних settings — для use в callbacks без зависимостей. */
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Live-обновление mic gain: если enhancer активен (aggressive mode) и
  // пользователь крутит mic gain slider — применяем без пересоздания цепочки.
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
      pushTrack(
        pub as unknown as VideoPublicationLike,
        r.localParticipant.identity,
        r.localParticipant.name || r.localParticipant.identity,
        true,
      );
    }

    for (const participant of r.remoteParticipants.values()) {
      for (const pub of participant.videoTrackPublications.values()) {
        pushTrack(
          pub as unknown as VideoPublicationLike,
          participant.identity,
          participant.name || participant.identity,
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

  useEffect(() => {
    refreshParticipants();
  }, [room, refreshParticipants]);

  useEffect(() => {
    refreshVisualTracks();
  }, [room, refreshVisualTracks]);

  const socketRef = useRef<Socket | null>(socket);
  socketRef.current = socket;

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
        r.on(RoomEvent.ParticipantConnected, refreshVisualTracks);
        r.on(RoomEvent.ParticipantDisconnected, refreshVisualTracks);
        r.on(RoomEvent.TrackMuted, refreshVisualTracks);
        r.on(RoomEvent.TrackUnmuted, refreshVisualTracks);
        r.on(RoomEvent.LocalTrackPublished, refreshVisualTracks);
        r.on(RoomEvent.LocalTrackUnpublished, refreshVisualTracks);

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
          refreshVisualTracks();
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
          refreshVisualTracks();
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
        // Если PTT — mic стартует MUTED. Open/VAD — стартуем enabled
        // (VAD gate потом отключит трансляцию пока голос ниже порога,
        // но publication остаётся live — это важно для LiveKit).
        try {
          const constraints = noiseModeToConstraints(
            settingsRef.current.noiseSuppression,
          );
          const inputId = settingsRef.current.inputDeviceId;
          const isPtt = settingsRef.current.micActivationMode === "push_to_talk";

          await r.localParticipant.setMicrophoneEnabled(
            !isPtt,
            {
              ...constraints,
              ...(inputId ? { deviceId: { exact: inputId } } : {}),
            },
          );
          setIsMicMuted(isPtt);

          // Aggressive mode → вставляем Web Audio DSP-цепочку перед publish.
          // highpass + lowpass + compressor + gain. replaceTrack — clean
          // LiveKit API, LiveKit отправит обработанный сигнал. Если что-то
          // упадёт — fallback на raw track (mic всё равно работает).
          if (settingsRef.current.noiseSuppression === "aggressive") {
            try {
              const lk = await import("livekit-client");
              const micPub = r.localParticipant.getTrackPublication(
                lk.Track.Source.Microphone,
              );
              const localAudioTrack = micPub?.audioTrack;
              const rawMs = localAudioTrack?.mediaStreamTrack;
              if (localAudioTrack && rawMs) {
                const enhancer = createAudioEnhancer(rawMs, {
                  micGain: settingsRef.current.micGain,
                });
                await localAudioTrack.replaceTrack(enhancer.outputTrack);
                enhancerRef.current = enhancer;
              }
            } catch (enhErr) {
              // DSP-цепочка не критична — mic работает на raw track.
              console.warn("Audio enhancer failed, using raw mic:", enhErr);
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

        // Уведомляем backend о join'е — другие участники сервера увидят
        // тебя в эфире через voice:participant:joined event.
        socketRef.current?.emit(
          SocketEvents.VoiceJoin,
          { channelId },
          (err: string | null) => {
            if (err) {
              // Не critical — backend отказался регистрировать (но LiveKit
              // подключение уже идёт). Логируем для диагностики.
              console.warn("voice:join backend rejected:", err);
            }
          },
        );

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
    [activeChannelId, busy, leave, refreshParticipants, refreshVisualTracks, state, applyRemoteAudioState, isDeafened],
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
      await r.localParticipant.setCameraEnabled(next);
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
      await r.localParticipant.setScreenShareEnabled(next);
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
  }, [settings.micActivationMode, settings.pttKey, state, refreshParticipants]);

  // Когда mode меняется на запущенной сессии — синхронизируем mic state.
  // Open / VAD → mic enabled (VAD сам потом отключит через gate).
  // PTT → mic muted, пока не зажмёшь клавишу.
  useEffect(() => {
    const r = roomRef.current;
    if (!r) return;
    if (state !== "connected") return;
    if (settings.micActivationMode === "push_to_talk") {
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
