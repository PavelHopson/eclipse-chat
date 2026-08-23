import { LanTransferCard } from "./LanTransferCard";

const DND_CONNECT_URL =
  "https://dnd.eclipse-forge.ru/#/auth/canary?from=eclipse-chat";

export function IntegrationsSection() {
  return (
    <div className="ec-settings-section ec-settings-section--integrations">
      <header className="ec-settings-section__hero ec-settings-integrations__hero">
        <div>
          <span className="ec-settings-section__eyebrow">Eclipse Forge</span>
          <h2>Связи между приложениями</h2>
          <p>Один аккаунт, отдельные разрешения и понятная граница данных.</p>
        </div>
        <div className="ec-settings-integrations__summary" aria-label="Сводка подключений">
          <strong>1</strong>
          <span>подключение<br />доступно сейчас</span>
        </div>
      </header>

      <section className="ec-settings-integrations__connections" aria-labelledby="settings-connections-title">
        <header>
          <div><span>Подключения</span><h3 id="settings-connections-title">Доступные сервисы</h3></div>
          <small>Каждый сервис подключается отдельно</small>
        </header>
        <div className="ec-settings-integrations__rows">
          <section className="ec-settings-card ec-settings-card--active">
            <div className="ec-settings-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.8 15.2 15.2 8.8" />
                <path d="M6.6 17.4 4.8 19.2a3.4 3.4 0 0 1-4.8-4.8l4-4a3.4 3.4 0 0 1 4.8 0" />
                <path d="m17.4 6.6 1.8-1.8A3.4 3.4 0 0 1 24 9.6l-4 4a3.4 3.4 0 0 1-4.8 0" />
              </svg>
            </div>
            <div className="ec-settings-card__body">
              <strong>Eclipse DnD Forge</strong>
              <span className="ec-settings-muted">Кампании и карты под тем же профилем. Подключение откроется в новой вкладке и вернёт вас после подтверждения.</span>
            </div>
            <div className="ec-settings-actions ec-settings-actions--column ec-settings-integrations__action">
              <span className="ec-settings-status-pill ec-settings-status-pill--ok">Доступно</span>
              <a className="ec-btn ec-btn--primary ec-btn--sm" href={DND_CONNECT_URL} target="_blank" rel="noopener noreferrer">Подключить DnD Forge</a>
            </div>
          </section>

          <LanTransferCard />
        </div>
      </section>

      <aside className="ec-settings-integrations__trust">
        <div className="ec-settings-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.8 20 6v5.8c0 4.8-3.2 8.5-8 9.4-4.8-.9-8-4.6-8-9.4V6l8-3.2Z" />
            <path d="m8.8 12 2 2 4.5-4.5" />
          </svg>
        </div>
        <div className="ec-settings-card__body">
          <strong>Пароли и сообщения не передаются</strong>
          <span className="ec-settings-muted">Сервис получает только имя и внутренний ID. Одноразовый код входа защищён PKCE S256.</span>
        </div>
        <span className="ec-settings-status-pill">PKCE S256</span>
      </aside>
    </div>
  );
}
