import { useCallback, useRef, useState, type ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { useAudioDevices } from "../hooks/useAudioDevices";
import { AnchoredOverlay } from "./AnchoredOverlay";

/** Enumeration only. Opening this menu never requests microphone permission. */
export function VoiceDeviceControl({ kind, selected, onSelect, onSettings, children }: {
  kind: "input" | "output"; selected: string | null; onSelect: (id: string | null) => void;
  onSettings: () => void; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const label = kind === "input" ? "Выбрать микрофон" : "Выбрать наушники или динамики";
  return <div className="ec-voice-device-control" ref={anchor} data-native-cursor>
    {children}
    <button ref={trigger} type="button" className="ec-voice-device-control__arrow"
      aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <CaretDownIcon size={12} aria-hidden />
    </button>
    {open && <AnchoredOverlay anchor={anchor} focusTarget={trigger} autoFocus label={label} onClose={close}>
      <DeviceOptions kind={kind} selected={selected} onSelect={onSelect} onSettings={() => { close(); onSettings(); }} />
    </AnchoredOverlay>}
  </div>;
}

function DeviceOptions({ kind, selected, onSelect, onSettings }: {
  kind: "input" | "output"; selected: string | null;
  onSelect: (id: string | null) => void; onSettings: () => void;
}) {
  const devices = useAudioDevices();
  const entries = kind === "input" ? devices.inputs : devices.outputs;
  const supported = kind === "input" || devices.supportsOutputSelection;
  const missing = devices.loaded && devices.hasPermission && selected && selected !== "default" && !entries.some(device => device.deviceId === selected);
  return <div className="ec-device-menu">
    <strong>{kind === "input" ? "Микрофон" : "Наушники и динамики"}</strong>
    <label>Устройство
      <select value={selected === "default" ? "" : selected ?? ""} disabled={!supported} onChange={event => onSelect(event.target.value || null)}>
        <option value="">Системное по умолчанию</option>
        {selected && selected !== "default" && !entries.some(device => device.deviceId === selected) && <option value={selected}>Выбранное устройство недоступно</option>}
        {entries.filter(device => device.deviceId !== "" && device.deviceId !== "default").map((device, index) =>
          <option key={device.deviceId} value={device.deviceId}>{device.label}{!devices.hasPermission ? " " + (index + 1) : ""}</option>)}
      </select>
    </label>
    {missing && <p role="status">Устройство отключено. Выбери другое или системное — состояние микрофона сохранится.</p>}
    {!supported && <p>Выбор выхода недоступен в этом браузере. Используй системные настройки звука.</p>}
    {!devices.hasPermission && supported && <p>Названия появятся после разрешения на микрофон. Открытие этого меню не включает запись.</p>}
    {devices.error && <p role="alert">{devices.error}</p>}
    <div className="ec-device-menu__actions">
      <button type="button" onClick={() => void devices.refresh()}>Обновить список</button>
      <button type="button" onClick={onSettings}>Настройки звука</button>
    </div>
  </div>;
}
