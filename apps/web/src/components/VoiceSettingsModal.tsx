import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { useAudioDevices, keyCodeToLabel } from "../hooks/useAudioDevices";
import { useVoiceSettings, type NoiseSuppressionMode } from "../hooks/useVoiceSettings";

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
  color: active ? "#fff" : "var(--ec-text-muted)",
  border: 0,
  cursor: "pointer",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "0.02em",
  transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
  boxShadow: active ? "0 0 0 1px var(--ec-accent), 0 0 12px -2px hsl(195 60% 55% / 0.4)" : "none",
});

const fieldHint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  lineHeight: 1.4,
  margin: 0,
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

const switchTrack = (on: boolean): CSSProperties => ({
  position: "relative",
  width: 38,
  height: 22,
  borderRadius: 999,
  background: on ? "var(--ec-accent)" : "var(--ec-surface-3)",
  border: "1px solid var(--ec-border-default)",
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
  flexShrink: 0,
});

const switchKnob = (on: boolean): CSSProperties => ({
  position: "absolute",
  top: 2,
  left: on ? 18 : 2,
  width: 16,
  height: 16,
  borderRadius: "50%",
  background: "#fff",
  transition: "left var(--ec-dur-fast) var(--ec-ease)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
});

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
                ? "#e6c45e"
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
  const devices = useAudioDevices();
  const {
    settings,
    setInputDevice,
    setOutputDevice,
    setNoiseSuppression,
    setPushToTalk,
    setPttKey,
    setMasterOutputVolume,
  } = useVoiceSettings();

  const [testLevel, setTestLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const [recordingPtt, setRecordingPtt] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

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
    { value: "aggressive", label: "Усиленный", sub: "WebRTC + DNN*" },
  ];

  return (
    <Modal title="Настройки голоса" onClose={onClose} width={520}>
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
            Подходит большинству. «Усиленный» применит DNN-фильтр (Krisp/RNNoise)
            когда добавим в v0.6.1. «Без обработки» — для USB-mic с собственным DSP.
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
            <div style={{ flex: 1, opacity: testing ? 1 : 0.35 }}>
              <VuMeter value={testLevel} />
            </div>
          </div>
          {permError && (
            <p style={{ ...fieldHint, color: "var(--ec-danger)" }}>{permError}</p>
          )}
        </div>
      </section>

      {/* ===== Push-to-talk ===== */}
      <section>
        <h3 style={sectionLabel}>Push-to-talk</h3>
        <div style={groupCard}>
          <div style={toggleRow}>
            <div>
              <div style={{ color: "var(--ec-text)", fontWeight: 500, fontSize: "var(--ec-text-sm)" }}>
                Включить режим зажатой клавиши
              </div>
              <p style={fieldHint}>
                Микрофон будет молчать пока вы не зажмёте назначенную клавишу.
                Полезно когда вокруг шум, дети, или клавиатура с громкими клавишами.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.pushToTalk}
              onClick={() => setPushToTalk(!settings.pushToTalk)}
              style={switchTrack(settings.pushToTalk)}
            >
              <span style={switchKnob(settings.pushToTalk)} />
            </button>
          </div>

          {settings.pushToTalk && (
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
        </div>
      </section>
    </Modal>
  );
}
