export type NotificationSoundKind =
  | "message"
  | "mention"
  | "dm"
  | "task"
  | "voiceJoin"
  | "voiceLeave";

export type NotificationSoundSettings = {
  enabled: boolean;
  message: boolean;
  dm: boolean;
  voice: boolean;
  tasks: boolean;
  volume: number;
};

export const NOTIFICATION_SOUND_STORAGE_KEY = "ec.notificationSounds.v1";
export const NOTIFICATION_SOUND_CHANGED_EVENT = "ec:notification-sounds-changed";

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  message: true,
  dm: true,
  voice: true,
  tasks: true,
  volume: 0.42,
};

type SoundCategory = "message" | "dm" | "voice" | "tasks";
type AudioContextLike = AudioContext & { resume: () => Promise<void> };
type Tone = {
  at: number;
  hz: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  bend?: number;
};

const MIN_INTERVAL_BY_KIND: Record<NotificationSoundKind, number> = {
  message: 850,
  mention: 700,
  dm: 650,
  task: 1_500,
  voiceJoin: 700,
  voiceLeave: 900,
};

const SOUND_PATTERNS: Record<NotificationSoundKind, Tone[]> = {
  message: [
    { at: 0, hz: 540, duration: 0.13, gain: 0.7, type: "sine", bend: 1.05 },
    { at: 0.07, hz: 720, duration: 0.16, gain: 0.55, type: "triangle", bend: 1.03 },
  ],
  mention: [
    { at: 0, hz: 740, duration: 0.12, gain: 0.7, type: "triangle", bend: 1.08 },
    { at: 0.06, hz: 1_110, duration: 0.18, gain: 0.55, type: "sine", bend: 1.05 },
    { at: 0.14, hz: 370, duration: 0.18, gain: 0.25, type: "sine", bend: 0.98 },
  ],
  dm: [
    { at: 0, hz: 620, duration: 0.11, gain: 0.55, type: "triangle", bend: 1.04 },
    { at: 0.06, hz: 820, duration: 0.12, gain: 0.56, type: "sine", bend: 1.04 },
    { at: 0.13, hz: 1_040, duration: 0.16, gain: 0.45, type: "sine", bend: 1.02 },
  ],
  task: [
    { at: 0, hz: 440, duration: 0.11, gain: 0.55, type: "square", bend: 1.02 },
    { at: 0.09, hz: 660, duration: 0.13, gain: 0.48, type: "triangle", bend: 1.02 },
    { at: 0.19, hz: 880, duration: 0.16, gain: 0.42, type: "sine", bend: 1.01 },
  ],
  voiceJoin: [
    { at: 0, hz: 660, duration: 0.22, gain: 0.64, type: "sine", bend: 1.12 },
    { at: 0.075, hz: 990, duration: 0.22, gain: 0.5, type: "sine", bend: 1.08 },
  ],
  voiceLeave: [
    { at: 0, hz: 520, duration: 0.16, gain: 0.42, type: "triangle", bend: 0.94 },
    { at: 0.075, hz: 390, duration: 0.2, gain: 0.36, type: "sine", bend: 0.92 },
  ],
};

let audioContext: AudioContextLike | null = null;
let unlockInstalled = false;
const lastPlayedAt = new Map<string, number>();

function clampVolume(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.volume;
  return Math.min(1, Math.max(0, numeric));
}

function categoryFor(kind: NotificationSoundKind): SoundCategory {
  if (kind === "dm") return "dm";
  if (kind === "task") return "tasks";
  if (kind === "voiceJoin" || kind === "voiceLeave") return "voice";
  return "message";
}

function settingsFromRaw(raw: unknown): NotificationSoundSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const data = raw as Partial<NotificationSoundSettings>;
  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : DEFAULT_SETTINGS.enabled,
    message: typeof data.message === "boolean" ? data.message : DEFAULT_SETTINGS.message,
    dm: typeof data.dm === "boolean" ? data.dm : DEFAULT_SETTINGS.dm,
    voice: typeof data.voice === "boolean" ? data.voice : DEFAULT_SETTINGS.voice,
    tasks: typeof data.tasks === "boolean" ? data.tasks : DEFAULT_SETTINGS.tasks,
    volume: clampVolume(data.volume),
  };
}

export function getDefaultNotificationSoundSettings(): NotificationSoundSettings {
  return { ...DEFAULT_SETTINGS };
}

export function readNotificationSoundSettings(): NotificationSoundSettings {
  if (typeof localStorage === "undefined") return getDefaultNotificationSoundSettings();
  try {
    const raw = localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY);
    if (!raw) return getDefaultNotificationSoundSettings();
    return settingsFromRaw(JSON.parse(raw));
  } catch {
    return getDefaultNotificationSoundSettings();
  }
}

export function writeNotificationSoundSettings(
  settings: NotificationSoundSettings,
): NotificationSoundSettings {
  const normalized = settingsFromRaw(settings);
  try {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent<NotificationSoundSettings>(NOTIFICATION_SOUND_CHANGED_EVENT, {
        detail: normalized,
      }),
    );
  } catch {
    /* localStorage can be unavailable in hardened browsers. */
  }
  return normalized;
}

export function updateNotificationSoundSettings(
  patch: Partial<NotificationSoundSettings>,
): NotificationSoundSettings {
  return writeNotificationSoundSettings({
    ...readNotificationSoundSettings(),
    ...patch,
  });
}

export function subscribeNotificationSoundSettings(
  listener: (settings: NotificationSoundSettings) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const notify = () => listener(readNotificationSoundSettings());
  const onStorage = (event: StorageEvent) => {
    if (event.key === NOTIFICATION_SOUND_STORAGE_KEY) notify();
  };
  const onLocal = (event: Event) => {
    const custom = event as CustomEvent<NotificationSoundSettings>;
    listener(settingsFromRaw(custom.detail));
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(NOTIFICATION_SOUND_CHANGED_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(NOTIFICATION_SOUND_CHANGED_EVENT, onLocal);
  };
}

function getAudioContext(): AudioContextLike | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) audioContext = new AudioCtx() as AudioContextLike;
  return audioContext;
}

function schedulePattern(
  ctx: AudioContextLike,
  kind: NotificationSoundKind,
  volume: number,
): void {
  const tones = SOUND_PATTERNS[kind];
  const start = ctx.currentTime + 0.012;
  const master = ctx.createGain();
  master.gain.setValueAtTime(Math.max(0.0001, volume * 0.085), start);
  master.connect(ctx.destination);

  let lastStop = 0;
  for (const tone of tones) {
    const toneStart = start + tone.at;
    const toneStop = toneStart + tone.duration;
    lastStop = Math.max(lastStop, tone.at + tone.duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.gain), toneStart + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStop);
    gain.connect(master);

    const oscillator = ctx.createOscillator();
    oscillator.type = tone.type ?? "sine";
    oscillator.frequency.setValueAtTime(tone.hz, toneStart);
    if (tone.bend) {
      oscillator.frequency.exponentialRampToValueAtTime(tone.hz * tone.bend, toneStop);
    }
    oscillator.connect(gain);
    oscillator.start(toneStart);
    oscillator.stop(toneStop + 0.02);
  }

  window.setTimeout(() => {
    try {
      master.disconnect();
    } catch {
      /* already disconnected */
    }
  }, Math.ceil((lastStop + 0.5) * 1_000));
}

function canPlay(kind: NotificationSoundKind, key: string): boolean {
  const now = Date.now();
  const rateKey = `${kind}:${key}`;
  const last = lastPlayedAt.get(rateKey) ?? 0;
  if (now - last < MIN_INTERVAL_BY_KIND[kind]) return false;
  lastPlayedAt.set(rateKey, now);
  return true;
}

export function playNotificationSound(
  kind: NotificationSoundKind,
  options: { key?: string; force?: boolean } = {},
): boolean {
  const settings = readNotificationSoundSettings();
  const category = categoryFor(kind);
  if (!options.force && (!settings.enabled || !settings[category])) return false;
  if (!canPlay(kind, options.key ?? "global")) return false;

  const ctx = getAudioContext();
  if (!ctx) return false;

  const play = () => schedulePattern(ctx, kind, settings.volume);
  if (ctx.state === "suspended") {
    void ctx.resume().then(play).catch(() => undefined);
    return true;
  }
  play();
  return true;
}

export function installNotificationSoundUnlock(): () => void {
  if (typeof window === "undefined" || unlockInstalled) return () => undefined;
  unlockInstalled = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "suspended") return;
    void ctx.resume().catch(() => undefined);
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });

  return () => {
    unlockInstalled = false;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
}
