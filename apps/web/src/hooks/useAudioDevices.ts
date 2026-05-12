import { useCallback, useEffect, useState } from "react";

/**
 * Перечисление доступных аудио устройств в браузере.
 *
 * Особенности:
 * - Браузер скрывает label'ы устройств пока нет mic-permission. Поэтому
 *   мы повторно перечисляем после первого `getUserMedia` — там label'ы
 *   появляются. UI должен показывать «нажмите Test» если устройства без названия.
 * - `setSinkId()` (output device) — не работает в Firefox по умолчанию.
 *   Мы детектим support через probing на created `<audio>`.
 * - Listener на `devicechange` — обновляемся когда USB-mic подключают/отключают.
 */

export type AudioDevice = {
  deviceId: string;
  label: string;
  /** `default` если deviceId === "default" или kind === "audiooutput" + system. */
  isDefault: boolean;
};

export type AudioDevices = {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  /** Поддерживает ли браузер выбор output device (setSinkId). */
  supportsOutputSelection: boolean;
  /** Удалось ли получить label'ы (требует mic permission). */
  hasPermission: boolean;
  /** Запросить permission на mic (для label'ов) — теперь enumeration вернёт labels. */
  requestPermission: () => Promise<boolean>;
  /** Force refresh — useful после явного permission grant. */
  refresh: () => Promise<void>;
};

function detectSinkIdSupport(): boolean {
  try {
    const probe = document.createElement("audio");
    return typeof (probe as HTMLAudioElement & { setSinkId?: unknown }).setSinkId === "function";
  } catch {
    return false;
  }
}

export function useAudioDevices(): AudioDevices {
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [supportsOutputSelection] = useState<boolean>(() => detectSinkIdSupport());

  const enumerate = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setInputs([]);
      setOutputs([]);
      return;
    }
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const ins: AudioDevice[] = [];
      const outs: AudioDevice[] = [];
      let anyLabel = false;
      for (const d of list) {
        if (d.kind === "audioinput") {
          if (d.label) anyLabel = true;
          ins.push({
            deviceId: d.deviceId,
            label: d.label || "Микрофон без названия",
            isDefault: d.deviceId === "default" || d.deviceId === "",
          });
        } else if (d.kind === "audiooutput") {
          if (d.label) anyLabel = true;
          outs.push({
            deviceId: d.deviceId,
            label: d.label || "Динамики без названия",
            isDefault: d.deviceId === "default" || d.deviceId === "",
          });
        }
      }
      setInputs(ins);
      setOutputs(outs);
      setHasPermission(anyLabel);
    } catch (e) {
      console.warn("enumerateDevices failed", e);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Сразу останавливаем — нам нужен был только permission grant.
      stream.getTracks().forEach((t) => t.stop());
      await enumerate();
      return true;
    } catch {
      return false;
    }
  }, [enumerate]);

  useEffect(() => {
    void enumerate();
    const onChange = () => {
      void enumerate();
    };
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", onChange);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", onChange);
      };
    }
    return undefined;
  }, [enumerate]);

  return {
    inputs,
    outputs,
    supportsOutputSelection,
    hasPermission,
    requestPermission,
    refresh: enumerate,
  };
}

/** Human-readable label для PTT keyboard code. */
export function keyCodeToLabel(code: string): string {
  if (code === "Space") return "Пробел";
  if (code.startsWith("Key")) return code.slice(3); // KeyT → T
  if (code.startsWith("Digit")) return code.slice(5); // Digit5 → 5
  if (code.startsWith("F") && code.length <= 3) return code; // F1, F12
  // ShiftLeft, ControlLeft, AltLeft, etc.
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  if (code === "ControlLeft" || code === "ControlRight") return "Ctrl";
  if (code === "AltLeft" || code === "AltRight") return "Alt";
  if (code === "MetaLeft" || code === "MetaRight") return "Cmd";
  if (code === "Backquote") return "`";
  if (code === "Tab") return "Tab";
  return code;
}
