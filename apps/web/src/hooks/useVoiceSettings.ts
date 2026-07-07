import { useCallback, useEffect, useState } from "react";

/**
 * Persisted voice settings. Stored in localStorage с graceful fallback.
 * Применяются в useVoice при join'е (audio constraints + output sink)
 * + в VoiceSettingsModal как UI state.
 */

export type NoiseSuppressionMode = "off" | "standard" | "aggressive";
export type VoicePresetId = "office" | "noisy" | "studio";

/**
 * Режим активации микрофона:
 * - `open` — микрофон всегда живой пока ты в voice (default, Discord called «open mic»)
 * - `voice_activity` — VAD-гейт: транслируем только когда твой голос громче порога
 * - `push_to_talk` — mic muted пока не зажата клавиша
 */
export type MicActivationMode = "open" | "voice_activity" | "push_to_talk";

export type VoiceSettings = {
  /** Микрофон, выбранный пользователем. null = system default. */
  inputDeviceId: string | null;
  /** Динамики (browser support: Chrome/Edge/Opera; Firefox требует flag). null = default. */
  outputDeviceId: string | null;
  /**
   * - `off`: никакого DSP, raw signal. Для качественных USB-mic или recording.
   * - `standard`: WebRTC built-in (noiseSuppression+echoCancellation+AGC). Default.
   * - `aggressive`: standard WebRTC + Web Audio DSP-цепочка (highpass 85Hz
   *   rumble cut + lowpass 12kHz hiss cut + compressor + mic gain). См.
   *   `lib/audioEnhancer.ts`. DNN noise filter (Krisp/RNNoise WASM) — отдельная
   *   фича в будущем.
   */
  noiseSuppression: NoiseSuppressionMode;
  /** Activation mode: open / voice_activity / push_to_talk. Заменяет старый bool. */
  micActivationMode: MicActivationMode;
  /** Hotkey для PTT (KeyboardEvent.code). Default — Space. */
  pttKey: string;
  /** VAD threshold (0..1) — минимальная амплитуда чтобы микрофон «открывался». */
  vadThreshold: number;
  /** Auto-disconnect timeout (минуты) если ты один в voice. 0 = выключено. */
  afkTimeoutMinutes: number;
  /** Legacy: оставляем pushToTalk для backward-compat миграции из старого storage. */
  pushToTalk?: boolean;
  /** Per-participant volume overrides (0..200%). identity → volume in 0..2 range. */
  participantVolumes: Record<string, number>;
  /** Локально замьюченные участники (identity[]). */
  mutedParticipants: string[];
  /** Мастер-громкость воспроизведения (0..1.5). Множитель ко всем remote-tracks. */
  masterOutputVolume: number;
  /** Локальный mic gain (0..2). Через Web Audio GainNode перед publish. */
  micGain: number;
};

const DEFAULT_SETTINGS: VoiceSettings = {
  inputDeviceId: null,
  outputDeviceId: null,
  noiseSuppression: "standard",
  micActivationMode: "open",
  pttKey: "Space",
  vadThreshold: 0.05,
  afkTimeoutMinutes: 5,
  participantVolumes: {},
  mutedParticipants: [],
  masterOutputVolume: 1.0,
  micGain: 1.0,
};

const STORAGE_KEY = "eclipse_chat_voice_settings_v1";

const NOISE_MODES = new Set<NoiseSuppressionMode>([
  "off",
  "standard",
  "aggressive",
]);
const MIC_MODES = new Set<MicActivationMode>([
  "open",
  "voice_activity",
  "push_to_talk",
]);

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function sanitizeParticipantVolumes(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [identity, volume] of Object.entries(value)) {
    if (typeof identity !== "string" || identity.length === 0) continue;
    out[identity] = clampNumber(volume, 0, 2, 1);
  }
  return out;
}

function sanitizeSettings(parsed: Partial<VoiceSettings>): VoiceSettings {
  let mode: MicActivationMode | undefined = parsed.micActivationMode;
  if (!mode) {
    mode = parsed.pushToTalk ? "push_to_talk" : DEFAULT_SETTINGS.micActivationMode;
  }
  const noise = parsed.noiseSuppression;

  return {
    ...DEFAULT_SETTINGS,
    inputDeviceId:
      typeof parsed.inputDeviceId === "string" && parsed.inputDeviceId.length > 0
        ? parsed.inputDeviceId
        : null,
    outputDeviceId:
      typeof parsed.outputDeviceId === "string" && parsed.outputDeviceId.length > 0
        ? parsed.outputDeviceId
        : null,
    noiseSuppression:
      noise && NOISE_MODES.has(noise) ? noise : DEFAULT_SETTINGS.noiseSuppression,
    micActivationMode: MIC_MODES.has(mode)
      ? mode
      : DEFAULT_SETTINGS.micActivationMode,
    pttKey:
      typeof parsed.pttKey === "string" && parsed.pttKey.length > 0
        ? parsed.pttKey
        : DEFAULT_SETTINGS.pttKey,
    vadThreshold: clampNumber(parsed.vadThreshold, 0, 0.5, DEFAULT_SETTINGS.vadThreshold),
    afkTimeoutMinutes: Math.round(
      clampNumber(parsed.afkTimeoutMinutes, 0, 120, DEFAULT_SETTINGS.afkTimeoutMinutes),
    ),
    participantVolumes: sanitizeParticipantVolumes(parsed.participantVolumes),
    mutedParticipants: Array.isArray(parsed.mutedParticipants)
      ? parsed.mutedParticipants.filter((id): id is string => typeof id === "string")
      : [],
    masterOutputVolume: clampNumber(
      parsed.masterOutputVolume,
      0,
      1.5,
      DEFAULT_SETTINGS.masterOutputVolume,
    ),
    micGain: clampNumber(parsed.micGain, 0, 2, DEFAULT_SETTINGS.micGain),
    pushToTalk: undefined,
  };
}

function loadSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;

    return sanitizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: VoiceSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* QuotaExceeded etc. — ignore */
  }
}

// Module-level state — shared между всеми экземплярами хука.
let memoryState: VoiceSettings = loadSettings();
const listeners = new Set<(s: VoiceSettings) => void>();

function setMemoryState(updater: (prev: VoiceSettings) => VoiceSettings) {
  memoryState = updater(memoryState);
  saveSettings(memoryState);
  listeners.forEach((cb) => cb(memoryState));
}

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(memoryState);

  useEffect(() => {
    const cb = (s: VoiceSettings) => setSettings(s);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  const setInputDevice = useCallback((id: string | null) => {
    setMemoryState((p) => ({ ...p, inputDeviceId: id }));
  }, []);

  const setOutputDevice = useCallback((id: string | null) => {
    setMemoryState((p) => ({ ...p, outputDeviceId: id }));
  }, []);

  const setNoiseSuppression = useCallback((mode: NoiseSuppressionMode) => {
    setMemoryState((p) => ({ ...p, noiseSuppression: mode }));
  }, []);

  const setMicActivationMode = useCallback((mode: MicActivationMode) => {
    setMemoryState((p) => ({ ...p, micActivationMode: mode }));
  }, []);

  const setPttKey = useCallback((key: string) => {
    setMemoryState((p) => ({ ...p, pttKey: key }));
  }, []);

  const setVadThreshold = useCallback((threshold: number) => {
    const clamped = Math.max(0, Math.min(0.5, threshold));
    setMemoryState((p) => ({ ...p, vadThreshold: clamped }));
  }, []);

  const setAfkTimeout = useCallback((minutes: number) => {
    const clamped = Math.max(0, Math.min(120, Math.round(minutes)));
    setMemoryState((p) => ({ ...p, afkTimeoutMinutes: clamped }));
  }, []);

  const setParticipantVolume = useCallback((identity: string, volume: number) => {
    const clamped = Math.max(0, Math.min(2, volume));
    setMemoryState((p) => ({
      ...p,
      participantVolumes: { ...p.participantVolumes, [identity]: clamped },
    }));
  }, []);

  const resetParticipantVolume = useCallback((identity: string) => {
    setMemoryState((p) => {
      const next = { ...p.participantVolumes };
      delete next[identity];
      return { ...p, participantVolumes: next };
    });
  }, []);

  const setMasterOutputVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1.5, volume));
    setMemoryState((p) => ({ ...p, masterOutputVolume: clamped }));
  }, []);

  const setMicGain = useCallback((gain: number) => {
    const clamped = Math.max(0, Math.min(2, gain));
    setMemoryState((p) => ({ ...p, micGain: clamped }));
  }, []);

  const toggleParticipantMute = useCallback((identity: string) => {
    setMemoryState((p) => {
      const muted = p.mutedParticipants.includes(identity);
      return {
        ...p,
        mutedParticipants: muted
          ? p.mutedParticipants.filter((id) => id !== identity)
          : [...p.mutedParticipants, identity],
      };
    });
  }, []);

  /**
   * Reset все voice settings к defaults. Полезно когда settings застряли
   * (mic gain в 0, masterOutputVolume в 0, output device указывает на
   * отсоединённый bluetooth, etc) — пользователь не может разобраться,
   * хочет «начать заново». v0.41.
   */
  const resetSettings = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* */
    }
    setMemoryState(() => DEFAULT_SETTINGS);
  }, []);

  const applyVoicePreset = useCallback((preset: VoicePresetId) => {
    setMemoryState((p) => {
      if (preset === "noisy") {
        return {
          ...p,
          noiseSuppression: "aggressive",
          micActivationMode: "voice_activity",
          vadThreshold: 0.08,
          micGain: 1.05,
          masterOutputVolume: Math.max(p.masterOutputVolume, 1),
        };
      }
      if (preset === "studio") {
        return {
          ...p,
          noiseSuppression: "off",
          micActivationMode: "open",
          vadThreshold: 0.05,
          micGain: 1,
          masterOutputVolume: Math.max(p.masterOutputVolume, 1),
        };
      }
      return {
        ...p,
        noiseSuppression: "standard",
        micActivationMode: "open",
        vadThreshold: 0.05,
        micGain: 1,
        masterOutputVolume: Math.max(p.masterOutputVolume, 1),
      };
    });
  }, []);

  return {
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
    applyVoicePreset,
    resetSettings,
  };
}

/**
 * Pure helper — переводит mode в WebRTC AudioCaptureOptions для passing в
 * LiveKit `setMicrophoneEnabled(true, options)`. Используется в useVoice.
 */
export function noiseModeToConstraints(mode: NoiseSuppressionMode): {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
} {
  if (mode === "off") {
    return {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
  }
  // standard + aggressive: оба включают WebRTC built-ins как baseline.
  // aggressive дополнительно прогоняет mic через Web Audio DSP-цепочку
  // (см. useVoice → createAudioEnhancer) — но WebRTC constraints одинаковы.
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

/** Снимает текущее состояние без подписки — для use-cases где listener не нужен. */
export function getVoiceSettings(): VoiceSettings {
  return memoryState;
}
