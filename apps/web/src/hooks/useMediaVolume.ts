import { useEffect, useState } from "react";

/**
 * useMediaVolume — общая громкость медиа (музыка + аудио-вложения).
 *
 * v1.1.58. Один client-local уровень на всё non-voice-call аудио:
 * shared-плеер музыки и плееры аудио-вложений / голосовых сообщений.
 * Persist в localStorage; live-синхронизация между всеми компонентами-
 * подписчиками в одной вкладке (module-level store) + между вкладками
 * через `storage` event.
 *
 * Громкость voice-звонка регулируется отдельно (useVoiceSettings —
 * per-participant + master output): там своя семантика 0..2 / 0..1.5.
 */

const STORAGE_KEY = "eclipse-chat:media-volume";

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(1, v));
}

function readStored(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw == null) return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? clamp(n) : 1;
}

// Module-level shared state — единый источник правды для всех инстансов.
let current = readStored();
const subscribers = new Set<(v: number) => void>();

function broadcast() {
  for (const fn of subscribers) fn(current);
}

/** Установить общую громкость медиа (0..1). */
export function setMediaVolume(v: number) {
  const next = clamp(v);
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* private mode — просто не persist */
  }
  broadcast();
}

/** Текущее значение без подписки. */
export function getMediaVolume(): number {
  return current;
}

/**
 * React-хук: `[volume, setVolume]` (0..1). Все компоненты, использующие
 * хук, live-синхронизированы — правка громкости в одном плеере мгновенно
 * применяется ко всем.
 */
export function useMediaVolume(): [number, (v: number) => void] {
  const [volume, setLocal] = useState(current);

  useEffect(() => {
    subscribers.add(setLocal);
    // Догоняем значение, если оно изменилось между init и mount.
    setLocal(current);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue != null) {
        const n = Number(e.newValue);
        if (Number.isFinite(n)) {
          current = clamp(n);
          broadcast();
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      subscribers.delete(setLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [volume, setMediaVolume];
}
