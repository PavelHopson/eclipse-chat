export type VoiceShortcutAction = "toggle-mic" | "toggle-deafen" | "join" | "leave";

export type VoiceShortcutMap = Record<VoiceShortcutAction, string | null>;

export const VOICE_SHORTCUT_ACTIONS: ReadonlyArray<{
  action: VoiceShortcutAction;
  label: string;
  description: string;
}> = [
  { action: "toggle-mic", label: "Микрофон", description: "Включить или выключить свой микрофон" },
  { action: "toggle-deafen", label: "Звук комнаты", description: "Заглушить или вернуть звук собеседников" },
  { action: "join", label: "Войти в комнату", description: "Подключиться к открытой голосовой комнате" },
  { action: "leave", label: "Покинуть комнату", description: "Выйти из текущей голосовой комнаты" },
];

export const DEFAULT_VOICE_SHORTCUTS: VoiceShortcutMap = {
  "toggle-mic": "Ctrl+Shift+KeyM",
  "toggle-deafen": "Ctrl+Shift+KeyD",
  join: "Ctrl+Shift+KeyJ",
  leave: "Ctrl+Shift+KeyL",
};

const STORAGE_KEY = "eclipse_chat_voice_shortcuts_v1";
const ACTIONS = new Set<VoiceShortcutAction>(VOICE_SHORTCUT_ACTIONS.map((item) => item.action));
const MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"] as const;
type ShortcutModifier = (typeof MODIFIERS)[number];
const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
]);

function hasWindowStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function parseShortcut(shortcut: string | null): { modifiers: ShortcutModifier[]; code: string } | null {
  if (!shortcut || typeof shortcut !== "string") return null;
  const parts = shortcut.split("+").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const code = parts.at(-1);
  if (!code || code.length < 2 || MODIFIERS.includes(code as ShortcutModifier)) return null;
  const modifiers = parts.slice(0, -1) as ShortcutModifier[];
  if (modifiers.some((modifier) => !MODIFIERS.includes(modifier))) return null;
  if (new Set(modifiers).size !== modifiers.length) return null;
  return { modifiers, code };
}

export function normalizeShortcut(shortcut: string | null): string | null {
  const parsed = parseShortcut(shortcut);
  if (!parsed) return null;
  const modifiers = MODIFIERS.filter((modifier) => parsed.modifiers.includes(modifier));
  return [...modifiers, parsed.code].join("+");
}

function sanitizeMap(value: unknown): VoiceShortcutMap {
  const next: VoiceShortcutMap = { ...DEFAULT_VOICE_SHORTCUTS };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  for (const action of ACTIONS) {
    const candidate = (value as Record<string, unknown>)[action];
    if (candidate === null) {
      next[action] = null;
      continue;
    }
    const normalized = typeof candidate === "string" ? normalizeShortcut(candidate) : null;
    if (normalized) next[action] = normalized;
  }
  return next;
}

function loadShortcuts(): VoiceShortcutMap {
  if (!hasWindowStorage()) return { ...DEFAULT_VOICE_SHORTCUTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeMap(JSON.parse(raw)) : { ...DEFAULT_VOICE_SHORTCUTS };
  } catch {
    return { ...DEFAULT_VOICE_SHORTCUTS };
  }
}

let shortcutState: VoiceShortcutMap = loadShortcuts();
const listeners = new Set<(shortcuts: VoiceShortcutMap) => void>();

function persistShortcuts() {
  if (!hasWindowStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcutState));
  } catch {
    // Storage may be unavailable in private mode. Memory state still works.
  }
}

function publish(next: VoiceShortcutMap) {
  shortcutState = next;
  persistShortcuts();
  listeners.forEach((listener) => listener({ ...shortcutState }));
}

export function getVoiceShortcuts(): VoiceShortcutMap {
  return { ...shortcutState };
}

export function subscribeVoiceShortcuts(listener: (shortcuts: VoiceShortcutMap) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setVoiceShortcut(
  action: VoiceShortcutAction,
  shortcut: string | null,
): { ok: true } | { ok: false; reason: string } {
  const normalized = shortcut === null ? null : normalizeShortcut(shortcut);
  if (shortcut !== null && !normalized) {
    return { ok: false, reason: "Нужно выбрать клавишу или сочетание с одной основной клавишей." };
  }
  if (normalized) {
    const conflict = VOICE_SHORTCUT_ACTIONS.find(
      (item) => item.action !== action && shortcutState[item.action] === normalized,
    );
    if (conflict) {
      return { ok: false, reason: `Сочетание уже назначено: «${conflict.label}».` };
    }
  }
  publish({ ...shortcutState, [action]: normalized });
  return { ok: true };
}

export function resetVoiceShortcuts(): void {
  publish({ ...DEFAULT_VOICE_SHORTCUTS });
}

function codeLabel(code: string): string {
  if (code === "Space") return "Space";
  if (code === "Escape") return "Esc";
  if (code === "Backquote") return "`";
  if (code === "Comma") return ",";
  if (code === "Period") return ".";
  if (code.startsWith("Key")) return code.slice(3).toUpperCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  if (code.startsWith("Arrow")) return code.slice(5);
  return code;
}

export function formatVoiceShortcut(shortcut: string | null): string {
  const parsed = parseShortcut(shortcut);
  if (!parsed) return "Не назначено";
  return [...parsed.modifiers, codeLabel(parsed.code)].join(" + ");
}

export function eventToVoiceShortcut(event: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(event.code)) return null;
  const code = event.code;
  if (!code || code === "Unidentified") return null;
  const modifiers: ShortcutModifier[] = [];
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (event.metaKey) modifiers.push("Meta");
  return normalizeShortcut([...modifiers, code].join("+"));
}

export function matchesVoiceShortcut(event: KeyboardEvent, shortcut: string | null): boolean {
  const actual = eventToVoiceShortcut(event);
  const expected = normalizeShortcut(shortcut);
  return Boolean(actual && expected && actual === expected);
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}
