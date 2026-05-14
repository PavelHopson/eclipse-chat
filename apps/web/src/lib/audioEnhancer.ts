/**
 * Audio enhancer — Web Audio DSP-цепочка для mic-трека перед publish в LiveKit.
 *
 * Применяется ТОЛЬКО в режиме noiseSuppression="aggressive" (см. useVoice).
 * Режимы "standard"/"off" остаются на чистом WebRTC built-in — это safe
 * fallback если DSP-цепочка где-то поведёт себя плохо.
 *
 * Цепочка (raw mic → ... → processed track):
 *   1. highpass 85Hz   — режет low-frequency rumble: вибрация стола, гул
 *                        кондиционера, breath-pops, сетевой 50Hz hum.
 *                        Ниже 85Hz человеческого голоса нет.
 *   2. lowpass 12kHz   — режет high-frequency hiss выше voice-band.
 *   3. compressor      — выравнивает динамику: тихие говорящие слышнее,
 *                        пики не зашкаливают. threshold -28dB, ratio 4:1.
 *   4. gain            — пользовательский mic boost/attenuate (0..2x).
 *
 * 0 npm-зависимостей — всё native Web Audio API. RNNoise/Krisp DNN —
 * отдельная фича (требует WASM-пакет, отложена из-за ECONNRESET на
 * dev-машине).
 *
 * Использование:
 *   const enh = createAudioEnhancer(rawMicTrack, { micGain: 1.2 });
 *   await liveKitTrack.replaceTrack(enh.outputTrack);
 *   // ... позже:
 *   enh.setGain(1.5);   // live-обновление без пересоздания
 *   enh.destroy();      // на leave / device change
 */

export type AudioEnhancerHandle = {
  /** Processed MediaStreamTrack — передаётся в LiveKit `LocalAudioTrack.replaceTrack`. */
  outputTrack: MediaStreamTrack;
  /** Live-обновление mic gain (0..2). Без пересоздания цепочки. */
  setGain: (value: number) => void;
  /** Cleanup — закрывает AudioContext. Вызывать на leave / смене устройства. */
  destroy: () => void;
};

function resolveAudioContextCtor(): typeof AudioContext {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  );
}

export function createAudioEnhancer(
  inputTrack: MediaStreamTrack,
  opts: { micGain: number },
): AudioEnhancerHandle {
  const Ctx = resolveAudioContextCtor();
  const ctx = new Ctx();

  const srcStream = new MediaStream([inputTrack]);
  const src = ctx.createMediaStreamSource(srcStream);

  // 1. Highpass — rumble cut
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 85;
  highpass.Q.value = 0.7;

  // 2. Lowpass — hiss cut
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 12_000;
  lowpass.Q.value = 0.7;

  // 3. Compressor — dynamics evening-out
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -28;
  compressor.knee.value = 24;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;

  // 4. Gain — user mic boost
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(2, opts.micGain));

  const dest = ctx.createMediaStreamDestination();

  src.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(compressor);
  compressor.connect(gain);
  gain.connect(dest);

  const outputTrack = dest.stream.getAudioTracks()[0];
  if (!outputTrack) {
    // Крайне маловероятно — но если destination не дал track, чистим
    // и кидаем — caller fallback'нётся на raw track.
    void ctx.close().catch(() => undefined);
    throw new Error("AudioEnhancer: destination produced no audio track");
  }

  return {
    outputTrack,
    setGain: (value: number) => {
      gain.gain.value = Math.max(0, Math.min(2, value));
    },
    destroy: () => {
      void ctx.close().catch(() => undefined);
    },
  };
}
