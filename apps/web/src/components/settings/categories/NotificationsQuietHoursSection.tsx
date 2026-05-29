type Props = {
  quietEnabled: boolean;
  quietFrom: string;
  quietTo: string;
  quietTimezone: string;
  quietBusy: boolean;
  quietError: string | null;
  inQuietWindow: boolean;
  onToggle: (enabled: boolean) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onSave: () => void;
};

export function NotificationsQuietHoursSection({
  quietEnabled,
  quietFrom,
  quietTo,
  quietTimezone,
  quietBusy,
  quietError,
  inQuietWindow,
  onToggle,
  onFrom,
  onTo,
  onSave,
}: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Уведомления</span>
        <h2>Тихие часы</h2>
        <p>В этот период push уведомления не отправляются.</p>
      </header>

      <section className={"ec-settings-card ec-settings-card--stack" + (quietEnabled ? " ec-settings-card--active" : "")}>
        <label className="ec-settings-toggle-row">
          <span>
            <strong>Включить тихие часы</strong>
            <span className="ec-settings-muted">Push-уведомления будут пропускаться внутри выбранного окна.</span>
          </span>
          <input
            type="checkbox"
            checked={quietEnabled}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={quietBusy}
          />
        </label>

        <div className="ec-settings-two-col">
          <label>
            <span className="ec-field-label">С</span>
            <input className="ec-field" type="time" value={quietFrom} onChange={(e) => onFrom(e.target.value)} disabled={!quietEnabled || quietBusy} />
          </label>
          <label>
            <span className="ec-field-label">До</span>
            <input className="ec-field" type="time" value={quietTo} onChange={(e) => onTo(e.target.value)} disabled={!quietEnabled || quietBusy} />
          </label>
        </div>

        <div className="ec-settings-readonly">
          <span className="ec-field-label">Часовой пояс</span>
          <span>{quietTimezone}</span>
        </div>

        {quietEnabled && inQuietWindow && <span className="ec-settings-ok">Сейчас тишина</span>}
        {quietError && <span className="ec-settings-error">{quietError}</span>}

        <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={onSave} disabled={quietBusy}>
          {quietBusy ? "Сохраняем…" : "Сохранить тихие часы"}
        </button>
      </section>
    </div>
  );
}
