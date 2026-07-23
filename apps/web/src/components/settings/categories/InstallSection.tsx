import type { DesktopAutostartState } from "../../../hooks/useDesktopAutostart";

type InstallState = {
  canInstall: boolean;
  isIOS: boolean;
  prompt: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismiss: () => void;
};

type Props = {
  install: InstallState;
  autostart: DesktopAutostartState;
};

export function InstallSection({ install, autostart }: Props) {
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

      {autostart.supported && (
        <>
          <section
            className={
              "ec-settings-card" +
              (autostart.enabled ? " ec-settings-card--active" : "")
            }
          >
            <div className="ec-settings-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v10" />
                <path d="M6.4 5.6a8 8 0 1 0 11.2 0" />
              </svg>
            </div>
            <div className="ec-settings-card__body">
              <strong>Запускать вместе с системой</strong>
              <span className="ec-settings-muted">
                {autostart.loading
                  ? "Проверяем настройку…"
                  : autostart.enabled
                  ? "Включено — Eclipse Chat запустится после входа в Windows, macOS или Linux."
                  : "Включите, чтобы сообщения и звонки не терялись после перезагрузки компьютера."}
              </span>
              {autostart.error && (
                <span className="ec-settings-error">{autostart.error}</span>
              )}
            </div>
            <div className="ec-settings-actions ec-settings-actions--column">
              <button
                type="button"
                className={
                  autostart.enabled
                    ? "ec-btn ec-btn--ghost ec-btn--sm"
                    : "ec-btn ec-btn--primary ec-btn--sm"
                }
                onClick={() => void autostart.toggle()}
                disabled={autostart.loading || autostart.busy}
              >
                {autostart.loading || autostart.busy
                  ? "Подождите…"
                  : autostart.enabled
                  ? "Отключить автозапуск"
                  : "Включить автозапуск"}
              </button>
            </div>
          </section>

          <section className="ec-settings-card ec-settings-card--sunken">
            <div className="ec-settings-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7h-7V2" />
                <path d="M20 7a9 9 0 1 0 1 8" />
              </svg>
            </div>
            <div className="ec-settings-card__body">
              <strong>Обновления устанавливаются автоматически</strong>
              <span className="ec-settings-muted">
                Desktop-приложение проверяет подписанный релиз при запуске и
                перезапускается только после безопасной установки.
              </span>
            </div>
            <span className="ec-settings-status-pill ec-settings-status-pill--ok">
              Включено
            </span>
          </section>
        </>
      )}
    </div>
  );
}
