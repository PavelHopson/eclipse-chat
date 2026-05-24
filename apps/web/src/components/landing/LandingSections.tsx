import type { ComponentType, ReactNode } from "react";
import { Reveal, SignalDot, revealDelay } from "./CinematicMotion";

type TrustBandProps = {
  items: ReadonlyArray<{
    label: string;
    role: string;
    glyph: ComponentType;
  }>;
};

type ExecutionLayerSectionProps = {
  onOpenSecurity: () => void;
};

type MemoryContinuumLayerProps = {
  /* Slot оставлен для backward-compat / override. По умолчанию не
     рендерим visual — continuum layer text-only full-bleed. */
  visual?: ReactNode;
  onOpenDocs: () => void;
};

type SecurityAuthorityBlockProps = {
  bullets: ReadonlyArray<string>;
  onOpenDocs: () => void;
};

type FinalCtaSectionProps = {
  onLaunch: () => void;
};

/* v1.3.2 slice C — execution rows density variation: index 0 primary
   (full padding, all parts), index 1 compact (без tail), index 2 primary
   (с tail + state), index 3 compact-offset (text-only, offset right,
   без index column). Editorial imbalance per brief. */
const EXECUTION_LAYERS = [
  {
    index: "[01]",
    state: "сигнал удержан",
    title: "Канал не выпадает из среды",
    body: "Адресат, файл и решение остаются в одном следе.",
    tail: "route / stable",
    variant: "primary" as const,
  },
  {
    index: "[02]",
    state: "исполнение связано",
    title: "Задача продолжает сообщение",
    body: "Передача не требует ручной пересборки.",
    tail: null,
    variant: "compact" as const,
  },
  {
    index: "[03]",
    state: "контекст живет",
    title: "Память не возвращает в ноль",
    body: "После паузы смена входит в то же состояние.",
    tail: "memory / live",
    variant: "primary" as const,
  },
  {
    index: null,
    state: null,
    title: "Внешний контур не ломает внутренний",
    body: "Клиент видит только свой слой.",
    tail: null,
    variant: "offset" as const,
  },
] as const;

/* v1.3.2 slice C — Memory continuum: НЕ explainable feature.
   Это просто sweeping list traces что система держит прямо сейчас.
   Каждый trace = mono timestamp + entity + body. */
const MEMORY_CONTINUUM = [
  {
    when: "+ 14:02",
    entity: "release / контур",
    body: "Решение зафиксировано вместе с владельцами и файлами.",
  },
  {
    when: "+ 13:48",
    entity: "voice / канал-2",
    body: "Голосовой фрагмент закреплён за задачей и контекстом.",
  },
  {
    when: "+ 11:21",
    entity: "client / north",
    body: "Внешний контур помнит границу доступа клиента.",
  },
  {
    when: "+ 09:07",
    entity: "team / shift",
    body: "Новый оператор вошёл в собранную среду без ресинхронизации.",
  },
] as const;

/* v1.3.2 slice C — Deployment authority manifest. НЕ marketing claims.
   3 короткие технические assertions, как infrastructure-ownership statement.
   Заменяет attestations card-grid от Codex. */
const DEPLOYMENT_MANIFEST = [
  { spec: "host", value: "ваш сервер" },
  { spec: "транспорт", value: "TLS · scoped" },
  { spec: "ключи", value: "AES-256-GCM" },
  { spec: "роли", value: "RBAC + 2FA" },
] as const;

export function TrustBand({ items }: TrustBandProps) {
  return (
    <section className="ec-landing__trust" aria-label="Инфраструктурный слой">
      <div className="ec-landing__trust-copy">
        <span className="ec-landing__trust-kicker">[01] Инфраструктурный слой</span>
        <h2 className="ec-landing__trust-title">Контур остаётся внутри.</h2>
        <p className="ec-landing__trust-body">
          Сервис, данные и telemetry живут в вашей сети.
        </p>
      </div>

      <div className="ec-landing__trust-rail">
        {items.map(({ label, role, glyph: Glyph }, index) => (
          <Reveal
            key={label}
            className="ec-landing__trust-node"
            variant="panel"
            delay={index * 60}
          >
            <span className="ec-landing__trust-node-mark" aria-hidden>
              <Glyph />
            </span>
            <strong>{label}</strong>
            <span>{role}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function ExecutionLayerSection({
  onOpenSecurity,
}: ExecutionLayerSectionProps) {
  return (
    <section className="ec-landing__section ec-landing__section--system" id="features">
      <div className="ec-landing__system-grid">
        <div className="ec-landing__system-copy">
          <span className="ec-landing__eyebrow">[02] Слой исполнения</span>
          <h2 className="ec-landing__system-title">
            Работа не
            <br />
            распадается.
          </h2>
          <p className="ec-landing__system-body">
            Сигнал, действие и доступ продолжают друг друга.
          </p>
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--ghost"
            onClick={onOpenSecurity}
          >
            Схема размещения
            <span className="ec-landing-btn__arrow" aria-hidden>
              →
            </span>
          </button>
        </div>

        <div
          className="ec-landing__execution-rail"
          aria-label="Непрерывный операционный поток"
        >
          {EXECUTION_LAYERS.map((layer, index) => (
            <Reveal
              key={layer.title}
              className={`ec-landing__execution-row ec-landing__execution-row--${layer.variant}`}
              variant="panel"
              delay={index * 80}
            >
              {layer.index ? (
                <span className="ec-landing__execution-index">{layer.index}</span>
              ) : (
                <span className="ec-landing__execution-index ec-landing__execution-index--blank" aria-hidden />
              )}
              <div className="ec-landing__execution-content">
                {layer.state && (
                  <span className="ec-landing__execution-state">{layer.state}</span>
                )}
                <h3 className="ec-landing__execution-title">{layer.title}</h3>
                <p className="ec-landing__execution-body">{layer.body}</p>
              </div>
              {layer.tail && (
                <div className="ec-landing__execution-tail">
                  <SignalDot tone={index === 0 ? "active" : "signal"} />
                  <span>{layer.tail}</span>
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * v1.3.2 slice C — Memory continuum layer.
 *
 * Pavel brief: «Must stop feeling like AI feature section. Need full-width
 * continuity layer feeling. It should feel like the system remembers
 * everything. Not like a feature explanation.»
 *
 * Implementation:
 *   - Full-bleed band, выламываемся из shell padding (negative margin
 *     техника + 100vw width).
 *   - НЕТ grid с visual + copy. visual prop игнорируется по умолчанию.
 *   - Monumental statement сверху, asymmetric.
 *   - Continuity stream: 4 memory traces в sweeping column, каждый =
 *     mono timestamp + entity + body. Это not «AI features», это
 *     просто state-of-memory прямо сейчас.
 *   - Bottom: тонкая mono signature.
 */
export function MemoryContinuumLayer({
  onOpenDocs,
}: MemoryContinuumLayerProps) {
  return (
    <section className="ec-landing__memory-band" id="memory" aria-label="Слой памяти">
      <div className="ec-landing__memory-band-inner">
        <header className="ec-landing__memory-band-head">
          <span className="ec-landing__eyebrow">[03] Слой памяти</span>
          <h2 className="ec-landing__memory-band-title">
            Состояние не
            <br />
            исчезает.
          </h2>
          <p className="ec-landing__memory-band-note">
            Среда не возвращается в пустое состояние между сменами, задачами и голосом.
          </p>
        </header>

        <div className="ec-landing__memory-stream" aria-label="Память — текущее состояние">
          {MEMORY_CONTINUUM.map((trace, index) => (
            <Reveal
              key={`${trace.when}-${trace.entity}`}
              className="ec-landing__memory-trace"
              variant="fade"
              style={revealDelay(index, 90)}
            >
              <span className="ec-landing__memory-trace-when">{trace.when}</span>
              <span className="ec-landing__memory-trace-entity">{trace.entity}</span>
              <p className="ec-landing__memory-trace-body">{trace.body}</p>
            </Reveal>
          ))}
        </div>

        <footer className="ec-landing__memory-band-footer">
          <span className="ec-landing__memory-band-sig">memory / persistent · no cold reset</span>
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--link"
            onClick={onOpenDocs}
          >
            Схема памяти →
          </button>
        </footer>
      </div>
    </section>
  );
}

/**
 * v1.3.2 slice C — Security как deployment authority block.
 *
 * Pavel brief: «Must feel deployment authority. Not SaaS security
 * marketing. Think infrastructure ownership, self-hosted sovereignty,
 * operational control.»
 *
 * Implementation:
 *   - НЕТ visual art (lock-in-stack image убран — SaaS-marketing trope).
 *   - Манифест размещения сверху: 4 mono spec/value pairs в horizontal
 *     row, plain text без card chrome.
 *   - Monumental statement.
 *   - Numbered authority ledger: 4 deployment assertions с index mono.
 *   - Bottom: small mono footer signature.
 */
export function SecurityAuthorityBlock({
  bullets,
  onOpenDocs,
}: SecurityAuthorityBlockProps) {
  return (
    <section
      className="ec-landing__section ec-landing__section--authority"
      id="security"
      aria-label="Контроль среды"
    >
      <header className="ec-landing__authority-head">
        <span className="ec-landing__eyebrow">[04] Контроль среды</span>
        <h2 className="ec-landing__authority-title">
          Среда остаётся
          <br />
          у вас.
        </h2>
      </header>

      <div className="ec-landing__authority-manifest" aria-label="Манифест размещения">
        {DEPLOYMENT_MANIFEST.map((pair, index) => (
          <Reveal
            key={pair.spec}
            className="ec-landing__authority-spec"
            variant="fade"
            style={revealDelay(index, 80)}
          >
            <span className="ec-landing__authority-spec-label">{pair.spec}</span>
            <strong className="ec-landing__authority-spec-value">{pair.value}</strong>
          </Reveal>
        ))}
      </div>

      <ol className="ec-landing__authority-ledger">
        {bullets.map((bullet, index) => (
          <li key={bullet} className="ec-landing__authority-ledger-row">
            <span className="ec-landing__authority-ledger-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="ec-landing__authority-ledger-body">{bullet}</p>
          </li>
        ))}
      </ol>

      <footer className="ec-landing__authority-footer">
        <span className="ec-landing__authority-sig">
          ваш host · ваши ключи · ваша сеть
        </span>
        <button
          type="button"
          className="ec-landing-btn ec-landing-btn--link"
          onClick={onOpenDocs}
        >
          Схема размещения →
        </button>
      </footer>
    </section>
  );
}

export function FinalCtaSection({ onLaunch }: FinalCtaSectionProps) {
  return (
    <section className="ec-landing__cta ec-landing__cta--system" id="pricing">
      <div className="ec-landing__cta-copy">
        <span className="ec-landing__eyebrow">[05] Допуск к среде</span>
        <h2 className="ec-landing__cta-title">Войдите в контур.</h2>
        <p className="ec-landing__cta-sub">
          Система уже идёт. Осталось открыть доступ.
        </p>
      </div>

      <div className="ec-landing__cta-actions">
        <button
          type="button"
          className="ec-landing-btn ec-landing-btn--primary"
          onClick={onLaunch}
        >
          Запустить контур
          <span className="ec-landing-btn__arrow" aria-hidden>
            →
          </span>
        </button>
      </div>
    </section>
  );
}

export function DockerGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="4" y="8" width="4" height="4" />
      <rect x="10" y="8" width="4" height="4" />
      <rect x="16" y="8" width="4" height="4" />
      <path d="M4 14h16c-.4 2.5-2 4-4.8 4H9.4C6.8 18 4.8 16.6 4 14z" />
    </svg>
  );
}

export function EdgeGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M5 6h14" />
      <path d="M5 12h14" />
      <path d="M5 18h14" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DatabaseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}

export function StorageGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 8h12l-1.2 10H7.2L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function CacheGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 4l6 3.5v9L12 20l-6-3.5v-9L12 4z" />
      <path d="M12 4v16" />
      <path d="M6 7.5l12 7" />
    </svg>
  );
}

export function TelemetryGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 16h16" />
      <path d="M7 16V9" />
      <path d="M12 16V6" />
      <path d="M17 16v-4" />
    </svg>
  );
}
