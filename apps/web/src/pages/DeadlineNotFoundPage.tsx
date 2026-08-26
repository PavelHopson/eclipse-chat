import { useMemo } from "react";

export function DeadlineNotFoundPage() {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const canGoBack = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.history.length > 1;
  }, []);
  const requestedRoute = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return `${window.location.pathname}${window.location.hash || ""}`;
  }, []);

  return (
    <main className="ec-deadline-404" aria-labelledby="deadline-404-title">
      <header className="ec-deadline-404__header">
        <a className="ec-deadline-404__brand" href={baseUrl} aria-label="Eclipse Chat — на главную">
          <img src={`${baseUrl}brand-mark.svg`} alt="" aria-hidden />
          <span>
            <strong>Eclipse</strong>
            <small>Chat</small>
          </span>
        </a>
        <div className="ec-deadline-404__availability" role="status">
          <span aria-hidden />
          Сервис доступен
        </div>
      </header>

      <section className="ec-deadline-404__stage">
        <div className="ec-deadline-404__copy">
          <div className="ec-deadline-404__eyebrow">
            <span>404</span>
            <span>Orbital navigation</span>
          </div>

          <h1 id="deadline-404-title">
            Маршрут ушёл
            <em>в тень.</em>
          </h1>

          <p>
            Eclipse Chat не нашёл этот экран. Возможно, ссылка устарела или была
            обрезана. Вернитесь на стартовую страницу и продолжите работу.
          </p>

          <div className="ec-deadline-404__actions" aria-label="Действия восстановления">
            <a className="ec-deadline-404__button ec-deadline-404__button--primary" href={baseUrl}>
              Вернуться в Eclipse Chat
              <span aria-hidden>→</span>
            </a>
            <button
              className="ec-deadline-404__button"
              type="button"
              onClick={() => {
                if (canGoBack) window.history.back();
                else window.location.assign(baseUrl);
              }}
            >
              Предыдущий экран
            </button>
          </div>

          <dl className="ec-deadline-404__telemetry">
            <div>
              <dt>Запрошенный маршрут</dt>
              <dd title={requestedRoute}>{requestedRoute}</dd>
            </div>
            <div>
              <dt>Статус</dt>
              <dd>Маршрут не распознан</dd>
            </div>
          </dl>
        </div>

        <figure className="ec-deadline-404__visual">
          <div className="ec-deadline-404__visual-code" aria-hidden>04</div>
          <img
            src={`${baseUrl}eclipse-chat-icon-master.png`}
            alt="Затмение Eclipse Chat"
          />
          <figcaption>
            <span aria-hidden />
            Orbital path lost
          </figcaption>
        </figure>
      </section>

      <footer className="ec-deadline-404__footer">
        <span>Система работает штатно</span>
        <span>Требуется другой маршрут</span>
        <span>v1.7.63</span>
      </footer>
    </main>
  );
}
