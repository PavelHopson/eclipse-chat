import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useAudioDevices } from "../hooks/useAudioDevices";
import { MicStateIcon } from "./icons/EclipseIcons";

export type VoiceMicCheckHandle = { stop: () => void };
type Props = { deviceId: string | null; onDevice: (id: string | null) => void; muted: boolean; onMuted: (value: boolean) => void };
type Phase = "idle" | "requesting" | "testing" | "done" | "error";

export const VoiceMicCheck = forwardRef<VoiceMicCheckHandle, Props>(function VoiceMicCheck({ deviceId, onDevice, muted, onMuted }, ref) {
  const devices = useAudioDevices();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [heard, setHeard] = useState(false);
  const generation = useRef(0);
  const resources = useRef<{ stream: MediaStream; context: AudioContext; frame: number; timeout: number } | null>(null);
  const meter = useRef<HTMLDivElement>(null);
  const heardRef = useRef(false);
  const stopResources = useCallback(() => {
    generation.current++;
    const active = resources.current;
    resources.current = null;
    if (active) {
      cancelAnimationFrame(active.frame); clearTimeout(active.timeout);
      active.stream.getTracks().forEach(track => track.stop());
      void active.context.close().catch(() => undefined);
    }
    meter.current?.style.setProperty("--mic-level", "0");
    meter.current?.setAttribute("aria-valuenow", "0");
  }, []);
  const stop = useCallback(() => { stopResources(); setPhase("idle"); }, [stopResources]);
  useImperativeHandle(ref, () => ({ stop }), [stop]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { stopResources(); document.removeEventListener("visibilitychange", hidden); };
  }, [stopResources, stop]);

  const start = async () => {
    stopResources();
    const request = generation.current;
    setError(""); setPhase("requesting"); setHeard(false); heardRef.current = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      // Only this explicit button requests capture. No recorder, network or speaker output.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) }, video: false,
      });
      if (request !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const active = { stream, context, frame: 0, timeout: 0 };
      resources.current = active;
      await context.resume();
      if (request !== generation.current) return;
      setPhase("testing");
      void devices.refresh();
      let last = 0;
      const tick = (now: number) => {
        if (resources.current !== active) return;
        if (now - last >= 80) {
          last = now; analyser.getByteTimeDomainData(data);
          const rms = Math.sqrt(data.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / data.length);
          const level = Math.min(1, rms * 5);
          meter.current?.style.setProperty("--mic-level", String(level));
          meter.current?.setAttribute("aria-valuenow", String(Math.round(level * 100)));
          if (rms > .008 && !heardRef.current) { heardRef.current = true; setHeard(true); }
        }
        active.frame = requestAnimationFrame(tick);
      };
      active.frame = requestAnimationFrame(tick);
      active.timeout = window.setTimeout(() => { stopResources(); setPhase("done"); }, 10000);
    } catch (failure) {
      stream?.getTracks().forEach(track => track.stop());
      if (context && context.state !== "closed") void context.close().catch(() => undefined);
      if (request !== generation.current) return;
      stopResources();
      const name = failure instanceof Error ? failure.name : "";
      setError(name === "NotAllowedError" ? "Доступ к микрофону закрыт. Разреши его в настройках сайта или войди без микрофона."
        : name === "NotFoundError" || name === "OverconstrainedError" ? "Этот микрофон недоступен. Выбери другое устройство."
        : "Не удалось проверить микрофон. Закрой приложения, которые его используют, и попробуй снова.");
      setPhase("error");
    }
  };
  return <div className="ec-voice-mic-check">
    <div className="ec-voice-mic-check__device">
      <MicStateIcon off={muted} size={18} />
      <label>Микрофон<select aria-label="Микрофон перед входом" value={deviceId ?? ""}
        onChange={event => { stop(); onDevice(event.target.value || null); }}>
        <option value="">Системный микрофон</option>
        {deviceId && !devices.inputs.some(device => device.deviceId === deviceId) && <option value={deviceId}>Выбранное устройство недоступно</option>}
        {devices.inputs.filter(device => device.deviceId && device.deviceId !== "default").map(device =>
          <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
      </select></label>
      <button type="button" onClick={phase === "testing" || phase === "requesting" ? stop : () => void start()}>
        {phase === "testing" ? "Остановить проверку" : phase === "requesting" ? "Отменить запрос" : "Проверить микрофон"}
      </button>
    </div>
    <label className="ec-voice-mic-check__muted"><input type="checkbox" checked={muted} onChange={event => onMuted(event.target.checked)} />Войти с выключенным микрофоном</label>
    {(phase === "testing" || phase === "done") && <div className="ec-voice-mic-check__feedback">
      <div ref={meter} className="ec-voice-mic-check__meter" role="progressbar" aria-label="Уровень микрофона" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span /></div>
      <span role="status">{phase === "done" ? heard ? "Голос слышно · проверка завершена" : "Сигнал не обнаружен · проверь устройство" : heard ? "Голос слышно" : "Скажи пару слов"}</span>
      <small>Только индикатор уровня, без записи и передачи.</small>
    </div>}
    {phase === "requesting" && <span role="status">Ожидаем разрешение браузера…</span>}
    {phase === "error" && <div className="ec-voice-mic-check__error" role="alert">{error}</div>}
  </div>;
});
