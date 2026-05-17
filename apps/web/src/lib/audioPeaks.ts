/**
 * Audio waveform peak extraction (v0.66).
 *
 * Декодирует audio Blob/File через Web Audio API → возвращает N=64
 * normalized peaks (0..100). Используется для Telegram-style визуализации
 * в Attachments.AudioItem и MessageInput voice-recorder preview.
 *
 * Zero npm deps (Pavel anti-pattern). Web Audio API доступен в Chrome /
 * Edge / Safari / FF / iOS 14.5+ / Android 5+ — практически везде где
 * есть LiveKit.
 *
 * Алгоритм:
 *   1. Blob → ArrayBuffer → AudioContext.decodeAudioData() → AudioBuffer
 *   2. Берём первый channel (mono) или mixdown stereo→mono усреднением
 *   3. Bucket-разделение длины signal на N=64 равных bucket'ов
 *   4. Каждый bucket → max(|sample|) внутри (peak amplitude)
 *   5. Нормализация: max-peak ÷ globalMax → 0..1 → ×100 round
 *
 * Failure-safe: при невозможности декодировать (corrupt audio, format
 * не поддерживается браузером) — returns null. Caller fallback'нется
 * на linear progress bar.
 *
 * Performance: 60-секундный voice message декодируется ~50-150ms на
 * современном железе (sample-rate 48kHz × 60 = 2.88M samples). Это
 * blocking main thread — для длинных файлов (>5 min) можно offload в
 * Worker, но v1 keeps it simple.
 */

export const WAVEFORM_PEAKS_COUNT = 64;

/**
 * Lazy-init AudioContext — некоторые браузеры (Safari) требуют user
 * gesture перед созданием. Reusable singleton, чтобы не плодить
 * audio graph при каждом upload.
 */
let cachedCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedCtx) return cachedCtx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    cachedCtx = new Ctor();
  } catch {
    return null;
  }
  return cachedCtx;
}

/**
 * Извлечь N=64 нормализованных peaks из audio blob.
 * Возвращает null при любой ошибке (caller fallback'нется).
 */
export async function computeWaveformPeaks(
  source: Blob,
  peakCount: number = WAVEFORM_PEAKS_COUNT,
): Promise<number[] | null> {
  if (!source.type.startsWith("audio/")) return null;
  const ctx = getAudioContext();
  if (!ctx) return null;

  let buffer: AudioBuffer;
  try {
    const arrayBuf = await source.arrayBuffer();
    buffer = await ctx.decodeAudioData(arrayBuf.slice(0));
  } catch {
    return null;
  }

  if (buffer.length === 0 || buffer.numberOfChannels === 0) return null;

  // Mixdown в mono усреднением каналов (если stereo). Берём data копию,
  // чтобы не держать ref на decoded AudioBuffer после возврата.
  const samples = new Float32Array(buffer.length);
  const channels = Math.min(2, buffer.numberOfChannels); // mono или stereo (skip 5.1)
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      samples[i] += data[i] / channels;
    }
  }

  // Bucket-peak extraction.
  const bucketSize = Math.max(1, Math.floor(samples.length / peakCount));
  const peaks: number[] = new Array(peakCount).fill(0);
  let globalMax = 0;
  for (let b = 0; b < peakCount; b++) {
    const start = b * bucketSize;
    const end = Math.min(samples.length, start + bucketSize);
    let maxAbs = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > maxAbs) maxAbs = v;
    }
    peaks[b] = maxAbs;
    if (maxAbs > globalMax) globalMax = maxAbs;
  }

  // Тихий файл / clipping silence → отдадим baseline waveform (низкие peaks).
  // Без normalize'а UI всё равно покажет «плоскую» линию, что лучше null.
  if (globalMax < 1e-6) {
    return new Array(peakCount).fill(2);
  }

  // Нормализуем 0..100 + минимум 2 чтобы тихие места всё-таки рисовались
  // (полностью плоская часть выглядит как «дыра» в waveform).
  const norm = 100 / globalMax;
  return peaks.map((p) => Math.max(2, Math.round(p * norm)));
}
