import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import {
  getEcosystemHealth,
  type EcosystemHealthResponse,
  type EcosystemRuntimeStatus,
  type EcosystemServiceHealth,
  type EcosystemServiceId,
} from "../lib/platformAdmin";

const SERVICE_MARKS: Record<EcosystemServiceId, string> = {
  "eclipse-chat": "EC",
  "eclipse-ai-hub": "AI",
  "eclipse-library": "LB",
  "hopson-sentinel": "SN",
  "eclipse-dnd-forge": "D20",
  "eclipse-media": "MD",
};

const SERVICE_NAMES: Record<EcosystemServiceId, string> = {
  "eclipse-chat": "Chat",
  "eclipse-ai-hub": "AI Hub",
  "eclipse-library": "Library",
  "hopson-sentinel": "Sentinel",
  "eclipse-dnd-forge": "DnD Forge",
  "eclipse-media": "Media",
};

const STATUS_LABELS: Record<EcosystemRuntimeStatus, string> = {
  operational: "Работает",
  degraded: "Требует внимания",
  offline: "Недоступен",
  unconfigured: "Локальный узел",
};

const MATURITY_LABELS: Record<EcosystemServiceHealth["maturity"], string> = {
  live: "LIVE",
  beta: "BETA",
  prototype: "PROTOTYPE",
};

function formatCheckedAt(value: string): string {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ServiceCard({ service }: { service: EcosystemServiceHealth }) {
  return (
    <article
      className="ec-ecosystem-card"
      data-status={service.status}
      aria-label={`${service.name}: ${STATUS_LABELS[service.status]}`}
    >
      <div className="ec-ecosystem-card__head">
        <span className="ec-ecosystem-card__mark" aria-hidden="true">
          {SERVICE_MARKS[service.id]}
        </span>
        <div className="ec-ecosystem-card__identity">
          <h3>{service.name}</h3>
          <span className="ec-ecosystem-card__maturity">
            {MATURITY_LABELS[service.maturity]}
          </span>
        </div>
        <span className="ec-ecosystem-status" data-status={service.status}>
          <span className="ec-ecosystem-status__dot" aria-hidden="true" />
          {STATUS_LABELS[service.status]}
        </span>
      </div>

      <p className="ec-ecosystem-card__role">{service.role}</p>
      <p className="ec-ecosystem-card__evidence">{service.evidence}</p>

      <div className="ec-ecosystem-card__foot">
        <span className="ec-ecosystem-card__latency">
          {service.latencyMs === null ? "Без сетевого probe" : `${service.latencyMs} ms`}
        </span>
        {service.openUrl ? (
          <a
            className="ec-btn ec-btn--sm ec-ecosystem-card__action"
            href={service.openUrl}
            target="_blank"
            rel="noreferrer"
          >
            Открыть проект
          </a>
        ) : (
          <span className="ec-ecosystem-card__local-hint">Проверяется на устройстве</span>
        )}
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="ec-ecosystem-grid" aria-label="Проверяем состояние экосистемы">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="ec-ecosystem-card ec-ecosystem-card--loading" key={index}>
          <span className="ec-ecosystem-skeleton ec-ecosystem-skeleton--title" />
          <span className="ec-ecosystem-skeleton" />
          <span className="ec-ecosystem-skeleton ec-ecosystem-skeleton--short" />
        </div>
      ))}
    </div>
  );
}

export function EcosystemCommandCenter() {
  const [snapshot, setSnapshot] = useState<EcosystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setSnapshot(await getEcosystemHealth({ refresh }));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Не удалось проверить экосистему. Повторите запрос.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="ec-ecosystem" aria-labelledby="ecosystem-command-title">
      <header className="ec-ecosystem-hero">
        <div className="ec-ecosystem-hero__copy">
          <span className="ec-ecosystem-hero__eyebrow">OPERATIONAL OVERVIEW</span>
          <h2 id="ecosystem-command-title">Экосистема под контролем</h2>
          <p>
            Сразу видно, что работает, где нужна проверка и какие связи ещё не подключены.
          </p>
        </div>
        <button
          type="button"
          className="ec-btn ec-btn--primary ec-ecosystem-hero__refresh"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
        >
          {refreshing ? "Проверяем…" : "Проверить сейчас"}
        </button>
      </header>

      {error && (
        <div className="ec-cck-banner ec-cck-banner--risk ec-ecosystem-error" role="alert">
          <div>
            <strong>Состояние не обновилось</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="ec-btn ec-btn--sm" onClick={() => void load(true)}>
            Повторить проверку
          </button>
        </div>
      )}

      {loading && !snapshot ? (
        <LoadingState />
      ) : snapshot ? (
        <>
          <div className="ec-ecosystem-summary" aria-label="Сводка состояния">
            <div className="ec-ecosystem-summary__item">
              <span>Работают</span>
              <strong>{snapshot.summary.operational}</strong>
              <small>из {snapshot.summary.total} продуктов</small>
            </div>
            <div className="ec-ecosystem-summary__item" data-tone="attention">
              <span>Нужна проверка</span>
              <strong>{snapshot.summary.attention}</strong>
              <small>degraded или offline</small>
            </div>
            <div className="ec-ecosystem-summary__item" data-tone="local">
              <span>Локальные</span>
              <strong>{snapshot.summary.local}</strong>
              <small>не публикуются наружу</small>
            </div>
            <div className="ec-ecosystem-summary__item">
              <span>Обновлено</span>
              <strong className="ec-ecosystem-summary__time">
                {formatCheckedAt(snapshot.generatedAt)}
              </strong>
              <small>cache {snapshot.cacheTtlSeconds} сек.</small>
            </div>
          </div>

          <div className="ec-ecosystem-section-head">
            <div>
              <span className="ec-platform-admin__label">Продукты</span>
              <p className="ec-platform-admin__sub">Runtime health отдельно от стадии готовности.</p>
            </div>
          </div>
          <div className="ec-ecosystem-grid">
            {snapshot.services.map((service) => (
              <ServiceCard service={service} key={service.id} />
            ))}
          </div>

          <div className="ec-ecosystem-section-head ec-ecosystem-section-head--connections">
            <div>
              <span className="ec-platform-admin__label">Связи</span>
              <p className="ec-platform-admin__sub">Что уже соединено и что идёт следующим.</p>
            </div>
          </div>
          <div className="ec-ecosystem-connections">
            {snapshot.integrations.map((integration) => (
              <div className="ec-ecosystem-connection" key={integration.id}>
                <span className="ec-ecosystem-connection__route">
                  {SERVICE_NAMES[integration.from]}
                  <span aria-hidden="true">→</span>
                  {SERVICE_NAMES[integration.to]}
                </span>
                <strong>{integration.label}</strong>
                <span className="ec-ecosystem-connection__stage" data-stage={integration.stage}>
                  {integration.stage === "active"
                    ? "ACTIVE"
                    : integration.stage === "experimental"
                      ? "EXPERIMENTAL"
                      : "PLANNED"}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="ec-ecosystem-empty">
          <strong>Сводка пока пуста</strong>
          <p>Запустите проверку, чтобы увидеть состояние продуктов.</p>
          <button type="button" className="ec-btn ec-btn--primary" onClick={() => void load(true)}>
            Проверить экосистему
          </button>
        </div>
      )}
    </section>
  );
}
