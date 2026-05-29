import type { Profile } from "../../../hooks/useProfile";

type Props = {
  profile: Profile;
  emojiPresets: string[];
  activityText: string;
  activityEmoji: string;
  trimmedActivity: string;
  trimmedEmoji: string;
  activityBusy: boolean;
  activityError: string | null;
  canSaveActivity: boolean;
  onChangeText: (value: string) => void;
  onChangeEmoji: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
};

export function ActivitySection({
  profile,
  emojiPresets,
  activityText,
  activityEmoji,
  trimmedActivity,
  trimmedEmoji,
  activityBusy,
  activityError,
  canSaveActivity,
  onChangeText,
  onChangeEmoji,
  onSave,
  onClear,
}: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Активность</span>
        <h2>Кастомный статус</h2>
        <p>Виден в членах сервера и DM.</p>
      </header>

      <section className="ec-settings-card ec-settings-card--stack">
        <div className="ec-settings-card__row">
          <div className="ec-settings-icon" aria-hidden>{trimmedEmoji || "💬"}</div>
          <div className="ec-settings-card__body">
            <strong>Кастомный статус</strong>
            <span className="ec-settings-muted">Короткая строка рядом с вашим именем.</span>
          </div>
        </div>
        <div className="ec-settings-two-col">
          <label>
            <span className="ec-field-label">Эмодзи</span>
            <select
              className="ec-field"
              value={activityEmoji}
              onChange={(e) => onChangeEmoji(e.target.value)}
              disabled={activityBusy}
              aria-label="Эмодзи кастомного статуса"
            >
              <option value="">—</option>
              {emojiPresets.map((emoji) => (
                <option key={emoji} value={emoji}>{emoji}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="ec-field-label">Что вы делаете?</span>
            <input
              className="ec-field"
              type="text"
              value={activityText}
              onChange={(e) => onChangeText(e.target.value)}
              maxLength={128}
              disabled={activityBusy}
              placeholder="Работаю над релизом"
            />
          </label>
        </div>
        <div className="ec-settings-actions">
          <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={onSave} disabled={!canSaveActivity}>
            {activityBusy ? "Сохраняем…" : "Сохранить статус"}
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--ghost ec-btn--sm"
            onClick={onClear}
            disabled={activityBusy || (!profile.activityText && !profile.activityEmoji)}
          >
            Очистить
          </button>
          <span className="ec-field-counter">{trimmedActivity.length}/128</span>
        </div>
        {activityError && <span className="ec-settings-error">{activityError}</span>}
      </section>
    </div>
  );
}
