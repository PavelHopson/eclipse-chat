type InstallState = {
  canInstall: boolean;
  isIOS: boolean;
  prompt: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismiss: () => void;
};

type Props = { install: InstallState };

export function InstallSection({ install }: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Установить</span>
        <h2>Установить приложение</h2>
        <p>Eclipse Chat можно вынести в отдельное окно.</p>
      </header>

      <section className="ec-settings-card ec-settings-card--active">
        <div className="ec-settings-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <div className="ec-settings-card__body">
          <strong>Установить приложение</strong>
          <span className="ec-settings-muted">
            {install.isIOS
              ? "Safari → «Поделиться» → «На экран Домой». Eclipse Chat будет работать как обычное приложение."
              : "Eclipse Chat запустится в отдельном окне вместо вкладки в браузере."}
          </span>
        </div>
        {install.canInstall ? (
          <div className="ec-settings-actions ec-settings-actions--column">
            <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={() => void install.prompt()}>
              Установить
            </button>
            <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => install.dismiss()}>
              Позже
            </button>
          </div>
        ) : (
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => install.dismiss()}>
            Понятно
          </button>
        )}
      </section>
    </div>
  );
}
