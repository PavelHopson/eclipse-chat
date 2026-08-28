export type VoiceActionSoundKind = "micOn" | "micOff" | "audioOn" | "audioOff"
  | "cameraOn" | "cameraOff" | "screenOn" | "screenOff" | "callReady" | "callEnd" | "callRecover" | "actionError";
export type NotificationSoundKind = VoiceActionSoundKind
  | "message"
  | "mention"
  | "dm"
  | "task"
  | "voiceJoin"
  | "voiceLeave";

export type NotificationSoundTheme = "eclipse" | "signal";

export type NotificationSoundSettings = {
  enabled: boolean;
  message: boolean;
  dm: boolean;
  voice: boolean;
  tasks: boolean;
  actions: boolean;
  actionsVolume: number;
  volume: number;
  theme: NotificationSoundTheme;
};

export const NOTIFICATION_SOUND_STORAGE_KEY = "ec.notificationSounds.v1";
export const NOTIFICATION_SOUND_CHANGED_EVENT = "ec:notification-sounds-changed";
export const NOTIFICATION_SOUND_THEMES: Record<
  NotificationSoundTheme,
  { label: string; description: string }
> = {
  eclipse: {
    label: "Eclipse Signal",
    description: "Брендированный sci-fi пакет: глубже voice-входы, мягче сообщения, заметнее задачи.",
  },
  signal: {
    label: "Soft Signal",
    description: "Сдержанный рабочий пакет без лишней драматичности для долгих сессий.",
  },
};

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  message: true,
  dm: true,
  voice: true,
  tasks: true,
  actions: true,
  actionsVolume: 0.25,
  volume: 0.42,
  theme: "eclipse",
};

type SoundCategory = "message" | "dm" | "voice" | "tasks" | "actions";
type AudioContextLike = AudioContext & { resume: () => Promise<void> };
type Tone = {
  at: number;
  hz: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  bend?: number;
};

const ACTION_PATTERNS: Record<VoiceActionSoundKind, Tone[]> = {
  micOn: [{ at: 0, hz: 520, duration: .10, gain: .45 }, { at: .055, hz: 780, duration: .13, gain: .32 }],
  micOff: [{ at: 0, hz: 620, duration: .09, gain: .40 }, { at: .055, hz: 390, duration: .13, gain: .30 }],
  audioOn: [{ at: 0, hz: 350, duration: .14, gain: .42, bend: 1.35 }],
  audioOff: [{ at: 0, hz: 470, duration: .16, gain: .36, bend: .7 }],
  cameraOn: [{ at: 0, hz: 660, duration: .10, gain: .35 }, { at: .065, hz: 880, duration: .11, gain: .25 }],
  cameraOff: [{ at: 0, hz: 560, duration: .13, gain: .32, bend: .8 }],
  screenOn: [{ at: 0, hz: 440, duration: .13, gain: .4 }, { at: .09, hz: 880, duration: .16, gain: .28 }],
  screenOff: [{ at: 0, hz: 660, duration: .12, gain: .35 }, { at: .08, hz: 330, duration: .14, gain: .26 }],
  callReady: [{ at: 0, hz: 330, duration: .13, gain: .4 }, { at: .10, hz: 660, duration: .18, gain: .3 }],
  callEnd: [{ at: 0, hz: 440, duration: .14, gain: .35, bend: .65 }],
  callRecover: [{ at: 0, hz: 300, duration: .12, gain: .3 }, { at: .18, hz: 300, duration: .12, gain: .24 }],
  actionError: [{ at: 0, hz: 240, duration: .14, gain: .4 }, { at: .12, hz: 200, duration: .16, gain: .28 }],
};
const MIN_INTERVAL_BY_KIND: Record<NotificationSoundKind, number> = {
  micOn: 180, micOff: 180, audioOn: 180, audioOff: 180,
  cameraOn: 250, cameraOff: 250, screenOn: 250, screenOff: 250,
  callReady: 1200, callEnd: 1200, callRecover: 5000, actionError: 1500,
  message: 850,
  mention: 700,
  dm: 650,
  task: 1_500,
  voiceJoin: 700,
  voiceLeave: 900,
};

const SOUND_PATTERNS_BY_THEME: Record<
  NotificationSoundTheme,
  Record<NotificationSoundKind, Tone[]>
> = {
  eclipse: {
    ...ACTION_PATTERNS,
    message: [
      { at: 0, hz: 392, duration: 0.14, gain: 0.5, type: "sine", bend: 1.06 },
      { at: 0.06, hz: 587, duration: 0.16, gain: 0.45, type: "triangle", bend: 1.05 },
      { at: 0.13, hz: 784, duration: 0.18, gain: 0.28, type: "sine", bend: 0.99 },
    ],
    mention: [
      { at: 0, hz: 523, duration: 0.12, gain: 0.55, type: "triangle", bend: 1.08 },
      { at: 0.055, hz: 784, duration: 0.14, gain: 0.48, type: "sine", bend: 1.06 },
      { at: 0.13, hz: 1_175, duration: 0.2, gain: 0.36, type: "sine", bend: 1.03 },
    ],
    dm: [
      { at: 0, hz: 440, duration: 0.12, gain: 0.5, type: "triangle", bend: 1.05 },
      { at: 0.065, hz: 660, duration: 0.14, gain: 0.47, type: "sine", bend: 1.05 },
      { at: 0.145, hz: 880, duration: 0.16, gain: 0.32, type: "sine", bend: 1.02 },
    ],
    task: [
      { at: 0, hz: 196, duration: 0.11, gain: 0.42, type: "square", bend: 1.01 },
      { at: 0.08, hz: 392, duration: 0.13, gain: 0.5, type: "triangle", bend: 1.04 },
      { at: 0.18, hz: 740, duration: 0.18, gain: 0.34, type: "sine", bend: 1.02 },
    ],
    voiceJoin: [
      { at: 0, hz: 330, duration: 0.22, gain: 0.46, type: "sine", bend: 1.16 },
      { at: 0.08, hz: 660, duration: 0.24, gain: 0.48, type: "sine", bend: 1.12 },
      { at: 0.17, hz: 990, duration: 0.22, gain: 0.26, type: "triangle", bend: 1.04 },
    ],
    voiceLeave: [
      { at: 0, hz: 660, duration: 0.14, gain: 0.34, type: "triangle", bend: 0.94 },
      { at: 0.075, hz: 440, duration: 0.18, gain: 0.36, type: "sine", bend: 0.92 },
      { at: 0.16, hz: 330, duration: 0.2, gain: 0.2, type: "sine", bend: 0.9 },
    ],
  },
  signal: {
    ...ACTION_PATTERNS,
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
  },
};

let audioContext: AudioContextLike | null = null;
let unlockInstalled = false;
const lastPlayedAt = new Map<string, number>();

function clampVolume(value: unknown, fallback = DEFAULT_SETTINGS.volume): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

function normalizeTheme(value: unknown): NotificationSoundTheme {
  return value === "eclipse" || value === "signal" ? value : DEFAULT_SETTINGS.theme;
}

function categoryFor(kind: NotificationSoundKind): SoundCategory {
  if (kind in ACTION_PATTERNS) return "actions";
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
    actions: typeof data.actions === "boolean" ? data.actions : DEFAULT_SETTINGS.actions,
    actionsVolume: data.actionsVolume === undefined ? DEFAULT_SETTINGS.actionsVolume : clampVolume(data.actionsVolume, DEFAULT_SETTINGS.actionsVolume),
    volume: clampVolume(data.volume),
    theme: normalizeTheme(data.theme),
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
  theme: NotificationSoundTheme,
): void {
  const tones = SOUND_PATTERNS_BY_THEME[theme]?.[kind] ?? SOUND_PATTERNS_BY_THEME.eclipse[kind];
  const start = ctx.currentTime + 0.012;
  const master = ctx.createGain();
  master.gain.setValueAtTime(Math.max(0.0001, volume * 0.08), start);
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

  const requestedAt = performance.now();
  const play = () => {
    // Never replay old confirmations after a permission dialog / suspended context.
    if (category === "actions" && performance.now() - requestedAt > 800) return;
    const latest = readNotificationSoundSettings();
    if (!options.force && (!latest.enabled || !latest[category])) return;
    const volume = category === "actions" ? latest.actionsVolume : latest.volume;
    if (volume > 0) schedulePattern(ctx, kind, volume, latest.theme);
  };
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
