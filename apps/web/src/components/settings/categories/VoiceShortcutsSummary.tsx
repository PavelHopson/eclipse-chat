import { useEffect, useState } from "react";
import {
  formatVoiceShortcut,
  getVoiceShortcuts,
  subscribeVoiceShortcuts,
  VOICE_SHORTCUT_ACTIONS,
} from "../../../lib/voiceShortcuts";

type Props = {
  onOpen: () => void;
};

export function VoiceShortcutsSummary({ onOpen }: Props) {
  const [voiceShortcuts, setVoiceShortcuts] = useState(getVoiceShortcuts);

  useEffect(() => subscribeVoiceShortcuts(setVoiceShortcuts), []);

  return (
    <section className="ec-settings-card ec-settings-card--stack" aria-labelledby="profile-voice-shortcuts-title">
      <div className="ec-settings-profile-card-heading">
        <div>
          <strong id="profile-voice-shortcuts-title">Клавиши голосовой комнаты</strong>
          <span className="ec-settings-muted">Быстрые действия для микрофона и подключения. Настройки сохраняются на этом устройстве.</span>
        </div>
        <span className="ec-settings-profile-card-heading__hint">4 действия</span>
      </div>
      <div className="ec-hotkeys-list">
        {VOICE_SHORTCUT_ACTIONS.map(({ action, label }) => (
          <article className="ec-hotkey-row" key={action}>
            <div className="ec-hotkey-row__keys" aria-label={`Сочетание: ${formatVoiceShortcut(voiceShortcuts[action])}`}>
              {formatVoiceShortcut(voiceShortcuts[action]).split(" + ").map((key) => <kbd key={key}>{key}</kbd>)}
            </div>
            <div className="ec-settings-card__body">
              <strong>{label}</strong>
            </div>
          </article>
        ))}
      </div>
      <div className="ec-settings-profile-footer">
        <span className="ec-settings-muted">Можно изменить любое сочетание или отключить его.</span>
        <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={onOpen}>
          Настроить клавиши
        </button>
      </div>
    </section>
  );
}
