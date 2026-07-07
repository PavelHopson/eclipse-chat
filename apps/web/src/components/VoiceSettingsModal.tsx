import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { useConfirm } from "./ConfirmDialog";
import { useAudioDevices, keyCodeToLabel } from "../hooks/useAudioDevices";
import {
  useVoiceSettings,
  type MicActivationMode,
  type NoiseSuppressionMode,
  type VoicePresetId,
} from "../hooks/useVoiceSettings";

type Props = {
  onClose: () => void;
};

const sectionLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: "var(--ec-text-muted)",
  textTransform: "uppercase",
  margin: "0 0 var(--ec-space-2) 0",
};

const groupCard: CSSProperties = {
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-md)",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

const segmentRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 4,
  padding: 4,
  background: "var(--ec-surface-1)",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-subtle)",
};

const segmentBtn = (active: boolean): CSSProperties => ({
  padding: "0.5rem 0.6rem",
  borderRadius: "var(--ec-radius-sm)",
  background: active ? "var(--ec-accent)" : "transparent",
  color: active ? "var(--ec-accent-text)" : "var(--ec-text-muted)",
  border: 0,
  cursor: "pointer",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "0.02em",
  transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
  boxShadow: active ? "0 0 0 1px var(--ec-accent), 0 0 12px -2px hsl(258 90% 66% / 0.38)" : "none",
});

const fieldHint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  lineHeight: 1.4,
  margin: 0,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0.18rem 0.55rem",
  borderRadius: "var(--ec-radius-full)",
  border: "1px solid var(--ec-border-subtle)",
  background: "color-mix(in srgb, var(--ec-surface-1) 86%, transparent)",
  color: "var(--ec-text-muted)",
};

const selectStyle: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-surface-1)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  fontFamily: "inherit",
};

const toggleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-3)",
};

// Уровневый индикатор громкости — VU meter из 16 баров.
function VuMeter({ value }: { value: number }) {
  // value: 0..1
  const bars = 16;
  const activeBars = Math.round(value * bars);
  return (
    <div
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${bars}, 1fr)`,
        gap: 2,
        height: 10,
        width: "100%",
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const active = i < activeBars;
        const hot = i >= bars * 0.75;
        const warm = i >= bars * 0.5;
        return (
          <span
            key={i}
            style={{
              borderRadius: 1,
              background: !active
                ? "var(--ec-surface-3)"
                : hot
                ? "var(--ec-danger)"
                : warm
                ? "var(--ec-warn)"
                : "var(--ec-accent)",
              transition: "background 60ms linear",
            }}
          />
        );
      })}
    </div>
  );
}

export function VoiceSettingsModal({ onClose }: Props) {
  const confirm = useConfirm();
  const devices = useAudioDevices();
  const {
    settings,
    setInputDevice,
    setOutputDevice,
    setNoiseSuppression,
    setMicActivationMode,
    setPttKey,
    setVadThreshold,
    setAfkTimeout,
    setMasterOutputVolume,
    setMicGain,
    applyVoicePreset,
    resetSettings,
  } = useVoiceSettings();

  const [testLevel, setTestLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const [outputTesting, setOutputTesting] = useState(false);
  const [recordingPtt, setRecordingPtt] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [outputError, setOutputError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Cleanup test stream при unmount или change device
  const stopTest = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setTesting(false);
    setTestLevel(0);
  };

  useEffect(() => {
    return () => {
      stopTest();
    };
  }, []);

  const startTest = async () => {
    stopTest();
    setPermError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermError("Браузер не поддерживает getUserMedia");
      return;
    }
    try {
      const constraints: MediaStreamConstraints = {
        audio:
          settings.inputDeviceId != null
            ? {
                deviceId: { exact: settings.inputDeviceId },
                echoCancellation: settings.noiseSuppression !== "off",
                noiseSuppression: settings.noiseSuppression !== "off",
                autoGainControl: settings.noiseSuppression !== "off",
              }
            : {
                echoCancellation: settings.noiseSuppression !== "off",
                noiseSuppression: settings.noiseSuppression !== "off",
                autoGainControl: settings.noiseSuppression !== "off",
              },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const AudioCtx: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf);
        // Peak amplitude (0..1)
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setTestLevel(peak);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTesting(true);

      // После grant'a label'ы устройств станут доступны — refresh.
      await devices.refresh();
    } catch (e) {
      if (e instanceof Error && e.name === "NotAllowedError") {
        setPermError("Браузер отказал в доступе к микрофону. Проверь разрешения.");
      } else {
        setPermError(e instanceof Error ? e.message : "Не удалось открыть микрофон");
      }
    }
  };

  const playOutputTest = async () => {
    setOutputError(null);
    if (outputTesting) return;
    try {
      setOutputTesting(true);
      const AudioCtx: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      const audio = new Audio();
      audio.srcObject = dest.stream;
      audio.volume = Math.max(0, Math.min(1, settings.masterOutputVolume));

      const audioWithSink = audio as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (settings.outputDeviceId && typeof audioWithSink.setSinkId === "function") {
        await audioWithSink.setSinkId(settings.outputDeviceId);
      }

      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      oscillator.connect(gain).connect(dest);

      await audio.play();
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);

      window.setTimeout(() => {
        audio.pause();
        audio.srcObject = null;
        void ctx.close().catch(() => undefined);
        setOutputTesting(false);
      }, 650);
    } catch (e) {
      setOutputTesting(false);
      setOutputError(e instanceof Error ? e.message : "Не удалось проверить звук");
    }
  };

  // Capture PTT hotkey
  useEffect(() => {
    if (!recordingPtt) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Игнорим стандартные модификаторы в одиночку — они должны быть с другой клавишей.
      if (
        e.code === "ShiftLeft" ||
        e.code === "ShiftRight" ||
        e.code === "ControlLeft" ||
        e.code === "ControlRight" ||
        e.code === "AltLeft" ||
        e.code === "AltRight" ||
        e.code === "MetaLeft" ||
        e.code === "MetaRight"
      ) {
        // Pavel может выбрать любую клавишу. Разрешаем модификаторы как PTT key.
      }
      setPttKey(e.code);
      setRecordingPtt(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recordingPtt, setPttKey]);

  const modes: { value: NoiseSuppressionMode; label: string; sub: string }[] = [
    { value: "off", label: "Без обработки", sub: "Raw signal" },
    { value: "standard", label: "Стандарт", sub: "WebRTC DSP" },
    { value: "aggressive", label: "Студийный", sub: "WebRTC + Web Audio" },
  ];

  const presets: {
    id: VoicePresetId;
    title: string;
    copy: string;
  }[] = [
    {
      id: "office",
      title: "Офис",
      copy: "Стандартный шумодав, открытый микрофон, без усиления.",
    },
    {
      id: "noisy",
      title: "Шумно",
      copy: "Студийная цепочка + автогейт по голосу.",
    },
    {
      id: "studio",
      title: "USB / студия",
      copy: "Raw-сигнал без браузерной обработки.",
    },
  ];

  const levelLabel =
    !testing
      ? "тест не запущен"
      : testLevel < 0.015
      ? "слишком тихо"
      : testLevel > 0.55
      ? "перегруз"
      : testLevel > 0.06
      ? "уровень хороший"
      : "говори чуть громче";

  return (
    <Modal title="Настройки голоса" onClose={onClose} width={520}>
      <section>
        <h3 style={sectionLabel}>Быстрая настройка</h3>
        <div style={{ ...groupCard, gap: "var(--ec-space-3)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 8,
            }}
          >
            {presets.map((preset) => {
              const active =
                (preset.id === "office" &&
                  settings.noiseSuppression === "standard" &&
                  settings.micActivationMode === "open" &&
                  settings.micGain === 1) ||
                (preset.id === "noisy" &&
                  settings.noiseSuppression === "aggressive" &&
                  settings.micActivationMode === "voice_activity") ||
                (preset.id === "studio" &&
                  settings.noiseSuppression === "off" &&
                  settings.micActivationMode === "open");
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyVoicePreset(preset.id)}
                  className="ec-press"
                  style={{
                    textAlign: "left",
                    minHeight: 78,
                    padding: "0.7rem",
                    borderRadius: "var(--ec-radius-md)",
                    border: active
                      ? "1px solid var(--ec-border-accent)"
                      : "1px solid var(--ec-border-default)",
                    background: active
                      ? "color-mix(in srgb, var(--ec-accent) 14%, var(--ec-surface-1))"
                      : "var(--ec-surface-1)",
                    color: "var(--ec-text)",
                    cursor: "pointer",
                    boxShadow: active
                      ? "0 14px 34px -28px var(--ec-accent)"
                      : "none",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 4 }}>
                    {preset.title}
                  </strong>
                  <span style={{ ...fieldHint, display: "block" }}>
                    {preset.copy}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-muted)",
            }}
          >
            <span style={chipStyle}>
              WebRTC DSP: {settings.noiseSuppression === "off" ? "выкл" : "вкл"}
            </span>
            <span style={chipStyle}>
              Web Audio:{" "}
              {settings.noiseSuppression === "aggressive" || settings.micGain !== 1
                ? "активен"
                : "standby"}
            </span>
            <span style={chipStyle}>
              Вывод: {devices.supportsOutputSelection ? "можно выбрать" : "системный"}
            </span>
          </div>
        </div>
      </section>

      {/* ===== Шумодав ===== */}
      <section>
        <h3 style={sectionLabel}>Шумоподавление</h3>
        <div style={groupCard}>
          <div style={segmentRow}>
            {modes.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setNoiseSuppression(m.value)}
                style={segmentBtn(settings.noiseSuppression === m.value)}
                aria-pressed={settings.noiseSuppression === m.value}
              >
                <div>{m.label}</div>
                <div style={{ opacity: 0.7, fontWeight: 400, fontSize: 9, marginTop: 2 }}>{m.sub}</div>
              </button>
            ))}
          </div>
          <p style={fieldHint}>
            «Стандарт» — встроенное в браузер шумоподавление + эхоподавление + AGC.
            Подходит большинству. «Студийный» — поверх WebRTC прогоняет микрофон
            через Web Audio DSP-цепочку: highpass 85&nbsp;Гц (режет гул, вибрацию,
            breath-pops), lowpass 12&nbsp;кГц (шипение), компрессор (выравнивает
            громкость) + mic gain. «Без обработки» — для USB-mic с собственным DSP.
          </p>
        </div>
      </section>

      {/* ===== Master output volume ===== */}
      <section>
        <h3 style={sectionLabel}>Громкость воспроизведения</h3>
        <div style={groupCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-3)" }}>
            <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)", minWidth: 28 }} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(settings.masterOutputVolume * 100)}
              onChange={(e) => setMasterOutputVolume(Number(e.target.value) / 100)}
              aria-label="Громкость воспроизведения"
              style={{ flex: 1, accentColor: "var(--ec-accent)" }}
            />
            <span style={{ color: "var(--ec-text)", fontSize: "var(--ec-text-sm)", fontFamily: "var(--ec-font-mono)", minWidth: 44, textAlign: "right" }}>
              {Math.round(settings.masterOutputVolume * 100)}%
            </span>
          </div>
          <p style={fieldHint}>
            Общий уровень всех голосов в эфире. Для отдельных участников можно
            настроить индивидуально — кликни правой кнопкой по плитке в голосовой комнате.
          </p>
        </div>
      </section>

      {/* ===== Mic gain — усиление своего голоса ===== */}
      <section>
        <h3 style={sectionLabel}>Усиление микрофона</h3>
        <div style={groupCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-3)" }}>
            <span style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)", minWidth: 28 }} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </span>
            <input
              type="range"
              min={0}
              max={200}
              step={5}
              value={Math.round(settings.micGain * 100)}
              onChange={(e) => setMicGain(Number(e.target.value) / 100)}
              aria-label="Усиление микрофона"
              style={{ flex: 1, accentColor: "var(--ec-accent)" }}
            />
            <span style={{ color: "var(--ec-text)", fontSize: "var(--ec-text-sm)", fontFamily: "var(--ec-font-mono)", minWidth: 44, textAlign: "right" }}>
              {Math.round(settings.micGain * 100)}%
            </span>
          </div>
          <p style={fieldHint}>
            Громкость твоего голоса для остальных в эфире. 100&nbsp;% — без
            изменений, выше — усиление (если тебя плохо слышно), ниже —
            приглушение. Применяется на лету. Сильное усиление может
            добавить шум и искажения.
          </p>
        </div>
      </section>

      {/* ===== Mic + speakers ===== */}
      <section>
        <h3 style={sectionLabel}>Устройства</h3>
        <div style={{ ...groupCard, gap: "var(--ec-space-3)" }}>
          <div>
            <label
              htmlFor="vs-input"
              style={{
                display: "block",
                fontSize: "var(--ec-text-2xs)",
                color: "var(--ec-text-muted)",
                marginBottom: 6,
              }}
            >
              Микрофон
            </label>
            <select
              id="vs-input"
              value={settings.inputDeviceId ?? ""}
              onChange={(e) => setInputDevice(e.target.value || null)}
              style={selectStyle}
            >
              <option value="">Системный по умолчанию</option>
              {devices.inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            {!devices.hasPermission && (
              <p style={{ ...fieldHint, marginTop: 6 }}>
                Названия микрофонов скрыты до выдачи разрешения. Нажми «Проверить
                микрофон» ниже — браузер запросит доступ и названия появятся.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="vs-output"
              style={{
                display: "block",
                fontSize: "var(--ec-text-2xs)",
                color: "var(--ec-text-muted)",
                marginBottom: 6,
              }}
            >
              Динамики / наушники
            </label>
            <select
              id="vs-output"
              value={settings.outputDeviceId ?? ""}
              onChange={(e) => setOutputDevice(e.target.value || null)}
              style={selectStyle}
              disabled={!devices.supportsOutputSelection}
            >
              <option value="">Системные по умолчанию</option>
              {devices.outputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            {!devices.supportsOutputSelection && (
              <p style={{ ...fieldHint, marginTop: 6 }}>
                Этот браузер не поддерживает выбор устройства вывода. Используется
                системное по умолчанию. Chrome/Edge/Opera — есть поддержка, Firefox
                требует включить флаг.
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => (testing ? stopTest() : void startTest())}
              className={testing ? "ec-btn ec-btn--danger ec-btn--sm" : "ec-btn ec-btn--primary ec-btn--sm"}
            >
              {testing ? "Остановить тест" : "Проверить микрофон"}
            </button>
            <button
              type="button"
              onClick={() => void playOutputTest()}
              className="ec-btn ec-btn--sm"
              disabled={outputTesting}
            >
              {outputTesting ? "Играет..." : "Проверить звук"}
            </button>
            <div style={{ flex: 1, opacity: testing ? 1 : 0.35 }}>
              <VuMeter value={testLevel} />
            </div>
            <span
              style={{
                color:
                  testLevel > 0.55
                    ? "var(--ec-danger)"
                    : testLevel > 0.06
                    ? "var(--ec-status-exec)"
                    : "var(--ec-text-dim)",
                fontSize: "var(--ec-text-2xs)",
                minWidth: 96,
                textAlign: "right",
              }}
            >
              {levelLabel}
            </span>
          </div>
          {permError && (
            <p style={{ ...fieldHint, color: "var(--ec-danger)" }}>{permError}</p>
          )}
          {outputError && (
            <p style={{ ...fieldHint, color: "var(--ec-danger)" }}>{outputError}</p>
          )}
        </div>
      </section>

      {/* ===== Активация микрофона ===== */}
      <section>
        <h3 style={sectionLabel}>Активация микрофона</h3>
        <div style={groupCard}>
          <div style={segmentRow}>
            {([
              { value: "open", label: "Всегда открыт", sub: "Open mic" },
              { value: "voice_activity", label: "По голосу", sub: "VAD-gate" },
              { value: "push_to_talk", label: "По клавише", sub: "Push-to-talk" },
            ] as { value: MicActivationMode; label: string; sub: string }[]).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMicActivationMode(m.value)}
                style={segmentBtn(settings.micActivationMode === m.value)}
                aria-pressed={settings.micActivationMode === m.value}
              >
                <div>{m.label}</div>
                <div style={{ opacity: 0.7, fontWeight: 400, fontSize: 9, marginTop: 2 }}>{m.sub}</div>
              </button>
            ))}
          </div>

          {settings.micActivationMode === "voice_activity" && (
            <div style={{ marginTop: "var(--ec-space-2)", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>Порог чувствительности</span>
                <span style={{ fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>
                  {(settings.vadThreshold * 100).toFixed(1)}%
                </span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.55rem", color: "var(--ec-text-dim)" }}>тише</span>
                <input
                  type="range"
                  min={1}
                  max={300}
                  step={1}
                  value={Math.round(settings.vadThreshold * 1000)}
                  onChange={(e) => setVadThreshold(Number(e.target.value) / 1000)}
                  style={{ flex: 1, accentColor: "var(--ec-accent)" }}
                  aria-label="Порог VAD"
                />
                <span style={{ fontSize: "0.55rem", color: "var(--ec-text-dim)" }}>громче</span>
              </div>
              {testing && (
                <div style={{ marginTop: 4 }}>
                  <VuMeter value={testLevel} />
                  <p style={{ ...fieldHint, marginTop: 4 }}>
                    Линия в VU-метре выше порога = голос проходит. Тестируй и крути порог.
                  </p>
                </div>
              )}
              <p style={fieldHint}>
                Микрофон откроется только когда твой голос громче порога. Удобно
                для open-mic в шумной комнате — фон отсекается, говоришь — слышат.
              </p>
            </div>
          )}

          {settings.micActivationMode === "push_to_talk" && (
            <div style={{ ...toggleRow, marginTop: 6 }}>
              <div>
                <div style={{ color: "var(--ec-text)", fontWeight: 500, fontSize: "var(--ec-text-sm)" }}>
                  Клавиша активации
                </div>
                <p style={fieldHint}>
                  По умолчанию — Пробел. Нажми «Назначить» и любую клавишу.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <kbd
                  style={{
                    fontFamily: "var(--ec-font-mono)",
                    background: "var(--ec-surface-1)",
                    border: "1px solid var(--ec-border-default)",
                    borderRadius: "var(--ec-radius-sm)",
                    padding: "0.3rem 0.55rem",
                    fontSize: "var(--ec-text-sm)",
                    color: recordingPtt ? "var(--ec-accent)" : "var(--ec-text-strong)",
                    minWidth: 56,
                    textAlign: "center",
                  }}
                >
                  {recordingPtt ? "..." : keyCodeToLabel(settings.pttKey)}
                </kbd>
                <button
                  type="button"
                  onClick={() => setRecordingPtt((v) => !v)}
                  className="ec-btn ec-btn--sm"
                >
                  {recordingPtt ? "Отмена" : "Назначить"}
                </button>
              </div>
            </div>
          )}

          {settings.micActivationMode === "open" && (
            <p style={{ ...fieldHint, marginTop: 6 }}>
              Микрофон всегда живой пока ты в голосовом канале. Лучший вариант для
              тишины + хороших наушников. При шумах попробуй «По голосу».
            </p>
          )}
        </div>
      </section>

      {/* ===== AFK auto-disconnect ===== */}
      <section>
        <h3 style={sectionLabel}>Авто-выход из эфира</h3>
        <div style={groupCard}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)", display: "flex", justifyContent: "space-between" }}>
              <span>Если ты один в эфире</span>
              <span style={{ fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>
                {settings.afkTimeoutMinutes === 0
                  ? "никогда"
                  : `${settings.afkTimeoutMinutes} мин`}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={settings.afkTimeoutMinutes}
              onChange={(e) => setAfkTimeout(Number(e.target.value))}
              style={{ accentColor: "var(--ec-accent)" }}
              aria-label="Авто-выход после"
            />
            <p style={fieldHint}>
              Если в голосовом канале остался один и через указанное время никто
              не зашёл — автоматически выйти. Защита от «забыл что в эфире».
              0 = выключено.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Reset (v0.41 troubleshooting) ===== */}
      <section>
        <h3 style={sectionLabel}>Сброс настроек</h3>
        <div style={groupCard}>
          <p style={fieldHint}>
            Если что-то с голосом «застряло» — отсутствует звук, mic gain
            в нуле, output device на отключённой гарнитуре — нажми, чтобы
            вернуть все настройки к умолчаниям. Wipe'нет localStorage и
            восстановит mode «всегда передавать» + default volumes.
          </p>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "Сбросить голосовые настройки?",
                message:
                  "Выбранные устройства, режим активации (PTT/VAD) и индивидуальные громкости участников вернутся к умолчаниям.",
                confirmLabel: "Сбросить",
                danger: true,
              });
              if (ok) resetSettings();
            }}
            className="ec-btn ec-btn--ghost ec-btn--sm ec-press"
            style={{
              alignSelf: "flex-start",
              borderColor: "var(--ec-border-emphasis)",
            }}
          >
            Сбросить голосовые настройки
          </button>
        </div>
      </section>
    </Modal>
  );
}
