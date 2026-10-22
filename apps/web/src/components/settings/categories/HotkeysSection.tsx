import { useEffect, useState } from "react";
import {
  eventToVoiceShortcut,
  formatVoiceShortcut,
  getVoiceShortcuts,
  resetVoiceShortcuts,
  setVoiceShortcut,
  subscribeVoiceShortcuts,
  VOICE_SHORTCUT_ACTIONS,
  type VoiceShortcutAction,
} from "../../../lib/voiceShortcuts";

type Hotkey = {
  keys: string[];
  label: string;
  scope: string;
};

const HOTKEYS: Hotkey[] = [
  { keys: ["Ctrl", "K"], label: "Открыть поиск", scope: "Глобально, также Cmd+K на macOS" },
  { keys: ["Enter"], label: "Отправить сообщение", scope: "Поле ввода сообщения" },
  { keys: ["Shift", "Enter"], label: "Новая строка", scope: "Поле ввода сообщения" },
  { keys: ["@"], label: "Подсказка упоминаний", scope: "Поле ввода сообщения" },
  { keys: [":emoji:"], label: "Подсказка emoji", scope: "Поле ввода сообщения" },
  { keys: ["/task"], label: "Создать задачу из сообщения", scope: "Канал с operator-командами" },
  { keys: ["Esc"], label: "Закрыть модал или popover", scope: "Модальные окна и меню" },
  { keys: ["Ctrl", "Shift", "`"], label: "Сетевая диагностика voice", scope: "Голосовая комната" },
];

export function HotkeysSection() {
  const [voiceShortcuts, setVoiceShortcuts] = useState(getVoiceShortcuts);
  const [capturing, setCapturing] = useState<VoiceShortcutAction | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => subscribeVoiceShortcuts(setVoiceShortcuts), []);

  useEffect(() => {
    if (!capturing) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        setCapturing(null);
        setStatus(null);
        return;
      }
      const shortcut = eventToVoiceShortcut(event);
      if (!shortcut) return;
      event.preventDefault();
      const result = setVoiceShortcut(capturing, shortcut);
      setStatus(result.ok ? "Сочетание сохранено на этом устройстве." : result.reason);
      if (result.ok) setCapturing(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [capturing]);

  const beginCapture = (action: VoiceShortcutAction) => {
    setStatus(null);
    setCapturing(action);
  };

  const clearShortcut = (action: VoiceShortcutAction) => {
    const result = setVoiceShortcut(action, null);
    setStatus(result.ok ? "Сочетание отключено." : result.reason);
  };

  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Горячие клавиши</span>
        <h2>Клавиши</h2>
        <p>Сочетания действуют в открытой голосовой комнате и сохраняются только на этом устройстве.</p>
      </header>

      <section className="ec-settings-card ec-settings-card--stack">
        <div className="ec-hotkeys-list">
          {HOTKEYS.map((hotkey) => (
            <article className="ec-hotkey-row" key={`${hotkey.keys.join("+")}-${hotkey.label}`}>
              <div className="ec-hotkey-row__keys" aria-label={hotkey.keys.join(" + ")}>
                {hotkey.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </div>
              <div className="ec-settings-card__body">
                <strong>{hotkey.label}</strong>
                <span className="ec-settings-muted">{hotkey.scope}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ec-settings-card ec-settings-card--stack" aria-labelledby="voice-shortcuts-title">
        <div className="ec-settings-card__body">
          <strong id="voice-shortcuts-title">Голосовая комната</strong>
          <span className="ec-settings-muted">Нажмите «Изменить», затем нужное сочетание. Esc отменяет запись.</span>
          {status && <span className="ec-settings-muted" role="status">{status}</span>}
        </div>
        <div className="ec-hotkeys-list">
          {VOICE_SHORTCUT_ACTIONS.map(({ action, label, description }) => (
            <article className="ec-hotkey-row" key={action}>
              <div className="ec-hotkey-row__keys" aria-label={`Сочетание: ${formatVoiceShortcut(voiceShortcuts[action])}`}>
                {formatVoiceShortcut(voiceShortcuts[action]).split(" + ").map((key) => <kbd key={key}>{key}</kbd>)}
              </div>
              <div className="ec-settings-card__body">
                <strong>{label}</strong>
                <span className="ec-settings-muted">{description}</span>
                {capturing === action && <span className="ec-settings-muted" role="status">Нажмите сочетание…</span>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => beginCapture(action)} aria-pressed={capturing === action}>
                  {capturing === action ? "Слушаем…" : "Изменить"}
                </button>
                <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => clearShortcut(action)} disabled={voiceShortcuts[action] === null}>
                  Сбросить
                </button>
              </div>
            </article>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => { resetVoiceShortcuts(); setStatus("Сочетания по умолчанию восстановлены."); }}>
            Восстановить по умолчанию
          </button>
        </div>
      </section>
    </div>
  );
}
