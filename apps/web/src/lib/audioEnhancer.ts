/**
 * Audio enhancer — Web Audio DSP-цепочка для mic-трека перед publish в LiveKit.
 *
 * v1.1.59: применяется во ВСЕХ режимах. "aggressive" — полная DSP-цепочка;
 * "standard"/"off" — только gain-стадия (`gainOnly`), чтобы регулятор
 * усиления своего голоса (mic gain) работал в любом режиме.
 *
 * Цепочка (raw mic → ... → processed track):
 *   1. highpass 85Hz   — режет low-frequency rumble: вибрация стола, гул
 *                        кондиционера, breath-pops, сетевой 50Hz hum.
 *                        Часть низкого голоса также может ослабляться.
 *   2. lowpass 12kHz   — режет high-frequency hiss выше voice-band.
 *   3. RNNoise WASM    — локальное нейросетевое подавление фонового шума.
 *   4. gain            — пользовательский mic boost/attenuate (0..2x).
 *
 * RNNoise pinned/vendor bundle загружается только для усиленного режима.
 * Worklet не отправляет PCM через сообщения; при недоступности есть явный
 * browser fallback. При runtime-ошибке поток закрывается, без raw bypass.
 *
 * Использование:
 *   const enh = await createAudioEnhancer(rawMicTrack, { micGain: 1.2 });
 *   await liveKitTrack.replaceTrack(enh.outputTrack);
 *   // ... позже:
 *   enh.setGain(1.5);   // live-обновление без пересоздания
 *   enh.destroy();      // на leave / device change
 */

import { createMicrophoneDenoise } from "./microphoneDenoise";

export type AudioEnhancerHandle = {
  processing: "rnnoise" | "browser" | "off";
  /** Raw getUserMedia track. It is never published and feeds the analyser/DSP. */
  inputTrack: MediaStreamTrack;
  /** Processed MediaStreamTrack — оборачивается в публикуемый LiveKit LocalAudioTrack. */
  outputTrack: MediaStreamTrack;
  /** Gate local capture separately from the published output. */
  setInputEnabled: (enabled: boolean) => void;
  /** Gate the only track that is published to LiveKit. */
  setOutputEnabled: (enabled: boolean) => void;
  /** Live-обновление mic gain (0..2). Без пересоздания цепочки. */
  setGain: (value: number) => void;
  /** Cleanup — останавливает оба tracks и закрывает AudioContext. */
  destroy: () => void;
};

function resolveAudioContextCtor(): typeof AudioContext {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  );
}

export async function createAudioEnhancer(
  inputTrack: MediaStreamTrack,
  opts: { micGain: number; gainOnly?: boolean; onFailure?: () => void },
): Promise<AudioEnhancerHandle> {
  const Ctx = resolveAudioContextCtor();
  const ctx = new Ctx(opts.gainOnly ? {} : { sampleRate: 48_000 });

  const srcStream = new MediaStream([inputTrack]);
  const src = ctx.createMediaStreamSource(srcStream);

  // Gain — пользовательский mic boost/attenuate (0..2x). Всегда в цепочке.
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(2, opts.micGain));

  const dest = ctx.createMediaStreamDestination();
  const outputTrack = dest.stream.getAudioTracks()[0];
  if (!outputTrack) {
    inputTrack.stop();
    void ctx.close().catch(() => undefined);
    throw new Error("AudioEnhancer: destination produced no audio track");
  }
  outputTrack.enabled = false;
  let denoise: AudioWorkletNode | null = null;
  let processing: AudioEnhancerHandle["processing"] = opts.gainOnly ? "off" : "browser";
  let destroyed = false;
  let failed = false;
  let transmitting = false;
  const fail = () => {
    if (destroyed || failed) return;
    failed = true;
    inputTrack.enabled = false;
    outputTrack.enabled = false;
    opts.onFailure?.();
  };

  if (opts.gainOnly) {
    // Режимы standard / off — только усиление, без DSP-фильтров:
    //   src → gain → dest
    src.connect(gain);
  } else {
    // Режим aggressive — полная DSP-цепочка:
    //   src → highpass → lowpass → RNNoise → gain → dest
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 85;
    highpass.Q.value = 0.7;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 12_000;
    lowpass.Q.value = 0.7;

    src.connect(highpass);
    highpass.connect(lowpass);
    try {
      denoise = await createMicrophoneDenoise(ctx);
      denoise.onprocessorerror = fail;
      denoise.port.onmessage = ({ data }) => { if (data === "failed") fail(); };
      lowpass.connect(denoise);
      denoise.connect(gain);
      processing = "rnnoise";
    } catch {
      // Browser capture still applies its noise/echo processing. Report this
      // fallback to the caller instead of claiming neural suppression.
      lowpass.connect(gain);
    }
  }
  gain.connect(dest);
  try {
    await ctx.resume();
    if (ctx.state !== "running") throw new Error("suspended");
  } catch {
    denoise?.port.postMessage("destroy");
    denoise?.disconnect();
    denoise?.port.close();
    inputTrack.stop();
    outputTrack.stop();
    void ctx.close().catch(() => undefined);
    throw new Error("Не удалось запустить обработку микрофона. Нажми «Включить микрофон».");
  }

  return {
    processing,
    inputTrack,
    outputTrack,
    setInputEnabled: (enabled: boolean) => {
      const wasEnabled = inputTrack.enabled;
      inputTrack.enabled = enabled && !failed && !destroyed;
      if (wasEnabled && !inputTrack.enabled && !destroyed) denoise?.port.postMessage({ enabled: false });
    },
    setOutputEnabled: (enabled: boolean) => {
      outputTrack.enabled = enabled && !failed && !destroyed;
      if (transmitting !== outputTrack.enabled && !destroyed) {
        transmitting = outputTrack.enabled;
        denoise?.port.postMessage({ enabled: transmitting });
      }
    },
    setGain: (value: number) => {
      gain.gain.value = Math.max(0, Math.min(2, value));
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      denoise?.port.postMessage("destroy");
      denoise?.disconnect();
      denoise?.port.close();
      src.disconnect();
      gain.disconnect();
      inputTrack.enabled = false;
      outputTrack.enabled = false;
      inputTrack.stop();
      outputTrack.stop();
      void ctx.close().catch(() => undefined);
    },
  };
}
