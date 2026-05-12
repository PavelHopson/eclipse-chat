import { useCallback, useEffect, useState } from "react";

/**
 * Persisted voice settings. Stored in localStorage с graceful fallback.
 * Применяются в useVoice при join'е (audio constraints + output sink)
 * + в VoiceSettingsModal как UI state.
 */

export type NoiseSuppressionMode = "off" | "standard" | "aggressive";

export type VoiceSettings = {
  /** Микрофон, выбранный пользователем. null = system default. */
  inputDeviceId: string | null;
  /** Динамики (browser support: Chrome/Edge/Opera; Firefox требует flag). null = default. */
  outputDeviceId: string | null;
  /**
   * - `off`: никакого DSP, raw signal. Для качественных USB-mic или recording.
   * - `standard`: WebRTC built-in (noiseSuppression+echoCancellation+AGC). Default.
   * - `aggressive`: standard + future DNN noise filter (Krisp/RNNoise) когда добавим.
   */
  noiseSuppression: NoiseSuppressionMode;
  /** Push-to-talk режим (mic muted кроме случаев когда зажата клавиша). */
  pushToTalk: boolean;
  /** Hotkey для PTT (KeyboardEvent.code). Default — Space. */
  pttKey: string;
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
  pushToTalk: false,
  pttKey: "Space",
  participantVolumes: {},
  mutedParticipants: [],
  masterOutputVolume: 1.0,
  micGain: 1.0,
};

const STORAGE_KEY = "eclipse_chat_voice_settings_v1";

function loadSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      participantVolumes: parsed.participantVolumes ?? {},
      mutedParticipants: parsed.mutedParticipants ?? [],
    };
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

  const setPushToTalk = useCallback((enabled: boolean) => {
    setMemoryState((p) => ({ ...p, pushToTalk: enabled }));
  }, []);

  const setPttKey = useCallback((key: string) => {
    setMemoryState((p) => ({ ...p, pttKey: key }));
  }, []);

  const setParticipantVolume = useCallback((identity: string, volume: number) => {
    setMemoryState((p) => ({
      ...p,
      participantVolumes: { ...p.participantVolumes, [identity]: volume },
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

  return {
    settings,
    setInputDevice,
    setOutputDevice,
    setNoiseSuppression,
    setPushToTalk,
    setPttKey,
    setParticipantVolume,
    resetParticipantVolume,
    toggleParticipantMute,
    setMasterOutputVolume,
    setMicGain,
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
  // standard + aggressive: оба включают WebRTC built-ins. aggressive в будущем
  // дополнит DNN-фильтр (Krisp/RNNoise) поверх — но baseline такой же.
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
