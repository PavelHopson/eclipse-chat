import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { useAudioDevices, keyCodeToLabel } from "../hooks/useAudioDevices";
import {
  useVoiceSettings,
  type MicActivationMode,
  type NoiseSuppressionMode,
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
  color: active ? "#fff" : "var(--ec-text-muted)",
  border: 0,
  cursor: "pointer",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "0.02em",
  transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
  boxShadow: active ? "0 0 0 1px var(--ec-accent), 0 0 12px -2px hsl(195 70% 60% / 0.38)" : "none",
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
    setMicActivationMode,
    setPttKey,
    setVadThreshold,
    setAfkTimeout,
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
    { value: "aggressive", label: "Студийный", sub: "WebRTC + Web Audio" },
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
    </Modal>
  );
}
