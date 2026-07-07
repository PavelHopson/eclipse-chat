import { ThemeToggle } from "../../ThemeToggle";
import type { Density } from "../../../hooks/useDensity";

type Props = {
  density: Density;
  onDensity: (density: Density) => void;
  focusEnabled: boolean;
  onFocusEnabled: (enabled: boolean) => void;
};

const DENSITY_OPTIONS: Array<{ id: Density; label: string }> = [
  { id: "balanced", label: "Стандарт" },
  { id: "compact", label: "Компактно" },
  { id: "tactical", label: "Тактика" },
];

export function AppearanceSection({ density, onDensity, focusEnabled, onFocusEnabled }: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Внешний вид</span>
        <h2>Тема, плотность, фокус</h2>
        <p>Локальные настройки интерфейса для этого устройства.</p>
      </header>

      <section className="ec-settings-card">
        <div className="ec-settings-card__body">
          <strong>Тема</strong>
          <span className="ec-settings-muted">OBSIDIAN (OLED-чёрная) и SOLAR (светлая) — переключаются сразу.</span>
        </div>
        <ThemeToggle />
      </section>

      <section className="ec-settings-card ec-settings-card--stack">
        <div className="ec-settings-card__row">
          <div className="ec-settings-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </div>
          <div className="ec-settings-card__body">
            <strong>Плотность интерфейса</strong>
            <span className="ec-settings-muted">
              Насколько компактно показывать сообщения, каналы и списки. Применяется сразу.
            </span>
          </div>
        </div>
        <div role="radiogroup" aria-label="Плотность интерфейса" className="ec-density-seg">
          {DENSITY_OPTIONS.map((opt) => {
            const active = density === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onDensity(opt.id)}
                className={"ec-density-seg__btn" + (active ? " ec-density-seg__btn--active" : "")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className={"ec-settings-card" + (focusEnabled ? " ec-settings-card--active" : "")}>
        <div className="ec-settings-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="7" />
            <line x1="12" y1="1.5" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="22.5" y2="12" />
          </svg>
        </div>
        <div className="ec-settings-card__body">
          <strong>Затемнение панелей при наборе</strong>
          <span className="ec-settings-muted">
            Пока пишешь сообщение, боковые панели мягко гаснут — чат-колонка в центре внимания.
          </span>
        </div>
        <label className="ec-settings-switch">
          <input
            type="checkbox"
            checked={focusEnabled}
            onChange={(e) => onFocusEnabled(e.target.checked)}
            aria-label="Затемнение панелей при наборе"
          />
        </label>
      </section>
    </div>
  );
}
