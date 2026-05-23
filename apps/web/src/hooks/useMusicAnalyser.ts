/**
 * v1.2.13 — Web Audio API singleton для audio-reactive визуализации
 * music-плеера (R-трек продолжение).
 *
 * Архитектура.
 * Один общий AudioContext + по одной паре MediaElementAudioSourceNode +
 * AnalyserNode на каждый `<audio>` элемент, который мы хотим визуализировать.
 *
 * `createMediaElementSource(audio)` можно вызвать ТОЛЬКО ОДИН РАЗ на
 * (context, audio) — повторный вызов кидает InvalidStateError. Поэтому
 * храним attached-source в WeakMap.
 *
 * AudioContext в большинстве браузеров стартует suspended; разрешается
 * resume только в user-gesture. `attachAnalyser` зовётся из обработчика
 * play (нажатие пользователя), вызываем `context.resume()` — после этого
 * audio течёт через граф.
 *
 * Подключение: source → analyser → destination (destination обязателен,
 * иначе звук пропадёт).
 *
 * Fallback. Если браузер не поддерживает AudioContext — возвращаем null,
 * визуализация падает на статичные peaks.
 *
 * Не reset'ит между треками: смена `audio.src` сохраняет MediaElementSource,
 * пересоздавать не нужно — analyser продолжит работать с новым потоком.
 */

const attachedAnalysers = new WeakMap<HTMLAudioElement, AnalyserNode>();
let sharedContext: AudioContext | null = null;
let currentMusicAudio: HTMLAudioElement | null = null;

function getContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  type AudioCtxCtor = new () => AudioContext;
  const Ctor =
    (window as unknown as { AudioContext?: AudioCtxCtor }).AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtxCtor })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedContext = new Ctor();
    return sharedContext;
  } catch {
    return null;
  }
}

/**
 * Прицепляет AnalyserNode к `<audio>`. Идемпотентно — вызов на уже
 * привязанном элементе возвращает существующий analyser. Возвращает null
 * если браузер не поддерживает Web Audio API или подключение не удалось.
 *
 * Должен вызываться из user-gesture (play button onClick), иначе
 * AudioContext остаётся suspended и аудио будет молчать.
 */
export function attachAnalyser(audio: HTMLAudioElement): AnalyserNode | null {
  const existing = attachedAnalysers.get(audio);
  if (existing) {
    // Resume context на каждом обращении — браузер может suspend по политике.
    void sharedContext?.resume().catch(() => undefined);
    return existing;
  }
  const ctx = getContext();
  if (!ctx) return null;
  let source: MediaElementAudioSourceNode;
  try {
    source = ctx.createMediaElementSource(audio);
  } catch {
    // InvalidStateError — этот audio уже привязан к другому контексту
    // (например, dev hot-reload). Не пересоздаём — fallback на статичные peaks.
    return null;
  }
  const analyser = ctx.createAnalyser();
  // fftSize=128 → 64 frequency-bin'а, что совпадает с количеством баров
  // в expand-плеере. smoothingTimeConstant=0.7 даёт мягкую инерцию между
  // кадрами (RAF без сглаживания дёргается слишком резко).
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.7;
  source.connect(analyser);
  analyser.connect(ctx.destination);
  attachedAnalysers.set(audio, analyser);
  // resume() — на случай если context создан suspended.
  void ctx.resume().catch(() => undefined);
  return analyser;
}

/**
 * Возвращает привязанный analyser для audio-элемента, либо null если не
 * прицеплен.
 */
export function getAttachedAnalyser(
  audio: HTMLAudioElement | null,
): AnalyserNode | null {
  if (!audio) return null;
  return attachedAnalysers.get(audio) ?? null;
}

/**
 * MusicMiniPlayer регистрирует свой `<audio>` как «current» — Expand-modal
 * по нему находит analyser. Singleton-ссылка обновляется на mount/unmount
 * mini-player'а.
 */
export function setCurrentMusicAudio(audio: HTMLAudioElement | null): void {
  currentMusicAudio = audio;
}

export function getCurrentMusicAudio(): HTMLAudioElement | null {
  return currentMusicAudio;
}
