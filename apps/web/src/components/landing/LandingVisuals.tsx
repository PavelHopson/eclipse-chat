import type { CSSProperties, ReactNode } from "react";
import {
  OrbitalSurface,
  Reveal,
  SignalDot,
  revealDelay,
} from "./CinematicMotion";

type AuthMode = "login" | "register" | null;

type HeroOperationalStageProps = {
  authMode: AuthMode;
  authPanel: ReactNode;
  onOpenAuth: (mode: "login" | "register") => void;
  onCloseAuth: () => void;
};

const CONTOUR_NODES = [
  "Общий контур",
  "Исполнение",
  "Голосовой канал",
  "AI Memory",
  "Клиентский портал",
] as const;

const LIVE_EVENTS = [
  {
    actor: "Система",
    time: "сейчас",
    body: "Операционный свод за сегодня собран и синхронизирован.",
  },
  {
    actor: "Мария",
    time: "10:37",
    body: "Подтвердила обновление по проекту. Файлы в канале.",
  },
  {
    actor: "Иван",
    time: "11:21",
    body: "Подключился к голосовому каналу и закрепил следующий шаг.",
  },
] as const;

const MEMORY_NODES = [
  { label: "Решения", className: "ec-memory-map__node--one" },
  { label: "Документы", className: "ec-memory-map__node--two" },
  { label: "Обсуждения", className: "ec-memory-map__node--three" },
  { label: "Участники", className: "ec-memory-map__node--four" },
  { label: "Файлы", className: "ec-memory-map__node--five" },
  { label: "Задачи", className: "ec-memory-map__node--six" },
] as const;

const SECURITY_LAYERS = [
  { label: "Контур приложений", status: "Изолирован" },
  { label: "Данные и резерв", status: "Под контролем" },
  { label: "Каналы и доступ", status: "Шифруются" },
] as const;

export function HeroOperationalStage({
  authMode,
  authPanel,
  onOpenAuth,
  onCloseAuth,
}: HeroOperationalStageProps) {
  return (
    <div
      className={`ec-hero-console${authMode ? " ec-hero-console--auth-open" : ""}`}
      aria-label="Операционная сцена Eclipse Chat"
    >
      <div className="ec-hero-console__backlight" aria-hidden />
      <div className="ec-hero-console__eclipse-rim" aria-hidden />

      <OrbitalSurface className="ec-hero-console__surface" intensity={3.6}>
        <div className="ec-hero-console__chrome">
          <span className="ec-hero-console__chrome-brand">
            <SignalDot tone="signal" />
            Контур
          </span>
          <div className="ec-hero-console__chrome-actions" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="ec-hero-console__grid">
          <aside className="ec-hero-console__rail" aria-label="Разделы платформы">
            <Reveal as="ul" className="ec-hero-console__rail-list" variant="panel">
              {CONTOUR_NODES.map((item, index) => (
                <li
                  key={item}
                  className={index === 1 ? "is-active" : undefined}
                  style={revealDelay(index)}
                >
                  <button type="button">
                    <SignalDot tone={index === 1 ? "active" : "idle"} />
                    <span>{item}</span>
                  </button>
                </li>
              ))}
            </Reveal>
            <Reveal className="ec-hero-console__rail-meta" delay={260} variant="fade">
              <span>РЕЖИМ КОНТУРА</span>
              <strong>Стабильный канал</strong>
            </Reveal>
          </aside>

          <div className="ec-hero-console__workspace">
            {authMode ? (
              <div className="ec-hero-console__auth-screen">
                <Reveal className="ec-hero-console__auth-head" variant="panel">
                  <div>
                    <span className="ec-hero-console__auth-label">
                      {authMode === "login" ? "Экран доступа" : "Создание контура"}
                    </span>
                    <strong>
                      {authMode === "login"
                        ? "Вход происходит прямо внутри рабочего холста"
                        : "Регистрация встроена в hero-сцену продукта"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="ec-hero-console__auth-close"
                    onClick={onCloseAuth}
                  >
                    Обзор платформы
                  </button>
                </Reveal>
                <div className="ec-hero-console__auth-body">{authPanel}</div>
              </div>
            ) : (
              <>
                <Reveal className="ec-hero-console__workspace-head" variant="panel">
                  <div>
                    <span className="ec-hero-console__workspace-kicker">
                      Общий контур
                    </span>
                    <h3>Команды работают в одном операционном пространстве.</h3>
                  </div>
                  <div className="ec-hero-console__workspace-cta">
                    <button
                      type="button"
                      className="ec-hero-console__cta ec-hero-console__cta--primary"
                      onClick={() => onOpenAuth("register")}
                    >
                      Запустить контур
                    </button>
                    <button
                      type="button"
                      className="ec-hero-console__cta"
                      onClick={() => onOpenAuth("login")}
                    >
                      Открыть вход
                    </button>
                  </div>
                </Reveal>

                <div className="ec-hero-console__workspace-panels">
                  <Reveal
                    className="ec-hero-console__panel ec-hero-console__panel--primary"
                    variant="panel"
                    delay={90}
                  >
                    <div className="ec-hero-console__panel-head">
                      <div>
                        <span>Система</span>
                        <strong>Задачи выполняются</strong>
                      </div>
                      <span className="ec-hero-console__metric">75%</span>
                    </div>
                    <div className="ec-hero-console__progress">
                      <span className="ec-hero-console__progress-bar" />
                    </div>

                    <div className="ec-hero-console__feed">
                      {LIVE_EVENTS.map((event, index) => (
                        <article
                          key={`${event.actor}-${event.time}`}
                          className="ec-hero-console__feed-item"
                          style={revealDelay(index, 86)}
                        >
                          <header>
                            <strong>{event.actor}</strong>
                            <span>{event.time}</span>
                          </header>
                          <p>{event.body}</p>
                        </article>
                      ))}
                    </div>
                  </Reveal>

                  <Reveal
                    className="ec-hero-console__panel ec-hero-console__panel--voice"
                    variant="panel"
                    delay={150}
                  >
                    <div className="ec-hero-console__panel-head">
                      <div>
                        <span>Голосовой канал</span>
                        <strong>Оперативный созвон</strong>
                      </div>
                      <span className="ec-hero-console__metric">07:48</span>
                    </div>
                    <div className="ec-hero-console__wave" aria-hidden>
                      {Array.from({ length: 24 }, (_, index) => (
                        <span
                          key={index}
                          style={
                            {
                              "--ec-wave-index": index,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </div>
                  </Reveal>

                  <Reveal
                    className="ec-hero-console__panel ec-hero-console__panel--memory"
                    variant="panel"
                    delay={220}
                  >
                    <div className="ec-hero-console__panel-head">
                      <div>
                        <span>AI Memory</span>
                        <strong>Контекст сохранён</strong>
                      </div>
                      <span className="ec-hero-console__metric">live</span>
                    </div>
                    <ul className="ec-hero-console__memory-list">
                      <li>
                        <SignalDot tone="active" />
                        Решение по релизу зафиксировано вместе с файлами.
                      </li>
                      <li>
                        <SignalDot tone="signal" />
                        Новый голосовой фрагмент привязан к задаче и сроку.
                      </li>
                      <li>
                        <SignalDot tone="amber" />
                        Клиентский контекст не распадается между каналами.
                      </li>
                    </ul>
                  </Reveal>
                </div>

                <Reveal
                  className="ec-hero-console__composer"
                  variant="panel"
                  delay={280}
                >
                  <span className="ec-hero-console__composer-label">
                    Команда видит сигнал, действие и результат в одном месте
                  </span>
                  <div className="ec-hero-console__composer-actions" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                </Reveal>
              </>
            )}
          </div>

          <aside className="ec-hero-console__metrics">
            <Reveal className="ec-hero-console__meter-card" variant="panel" delay={120}>
              <span>Панель оператора</span>
              <strong>Все системы активны</strong>
              <div className="ec-hero-console__dial" aria-hidden>
                <div className="ec-hero-console__dial-ring" />
                <div className="ec-hero-console__dial-core" />
              </div>
            </Reveal>

            <Reveal className="ec-hero-console__meter-card" variant="panel" delay={200}>
              <span>AI Memory</span>
              <strong>Контекст команды держится в контуре</strong>
              <button
                type="button"
                className="ec-hero-console__meter-link"
                onClick={() => onOpenAuth("login")}
              >
                Открыть доступ
              </button>
            </Reveal>

            <Reveal className="ec-hero-console__status-list" variant="panel" delay={260}>
              <div>
                <span>API Gateway</span>
                <strong>Online</strong>
              </div>
              <div>
                <span>База данных</span>
                <strong>Online</strong>
              </div>
              <div>
                <span>Сигнальные уведомления</span>
                <strong>Online</strong>
              </div>
            </Reveal>
          </aside>
        </div>
      </OrbitalSurface>
    </div>
  );
}

export function MemoryConstellation() {
  return (
    <OrbitalSurface className="ec-memory-map" intensity={2.8}>
      <svg
        className="ec-memory-map__links"
        viewBox="0 0 760 480"
        aria-hidden
        preserveAspectRatio="none"
      >
        <path d="M380 240 L170 128" />
        <path d="M380 240 L522 110" />
        <path d="M380 240 L596 238" />
        <path d="M380 240 L520 376" />
        <path d="M380 240 L250 390" />
        <path d="M380 240 L132 264" />
      </svg>

      <Reveal className="ec-memory-map__core" variant="panel">
        <span className="ec-memory-map__core-shell">
          <svg viewBox="0 0 64 64" fill="none" aria-hidden>
            <path
              d="M24 18c-6 0-10 4.5-10 10 0 4.3 2.5 7.9 6.2 9.4M40 18c6 0 10 4.5 10 10 0 4.3-2.5 7.9-6.2 9.4M24 46c0-5.2 3.6-9 8-9s8 3.8 8 9M20 26c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6-6-2.7-6-6zm12 0c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6-6-2.7-6-6z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <strong>AI Memory</strong>
      </Reveal>

      {MEMORY_NODES.map((node, index) => (
        <Reveal
          key={node.label}
          className={`ec-memory-map__node ${node.className}`}
          variant="panel"
          delay={index * 90}
        >
          <SignalDot tone={index === 2 ? "active" : "signal"} />
          <span>{node.label}</span>
        </Reveal>
      ))}
    </OrbitalSurface>
  );
}

export function SecurityStackArt() {
  return (
    <OrbitalSurface className="ec-security-stack" intensity={2.4}>
      <div className="ec-security-stack__halo" aria-hidden />
      <div className="ec-security-stack__platform" aria-hidden />
      <div className="ec-security-stack__layers" aria-hidden>
        {SECURITY_LAYERS.map((layer, index) => (
          <div key={layer.label} className={`ec-security-stack__layer ec-security-stack__layer--${index + 1}`}>
            <span className="ec-security-stack__layer-edge" />
          </div>
        ))}
      </div>

      <Reveal className="ec-security-stack__core" variant="panel">
        <span className="ec-security-stack__lock-shell">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden>
            <rect x="8" y="14" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 14v-2.5A5 5 0 0 1 16 6a5 5 0 0 1 5 5.5V14" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
      </Reveal>

      <div className="ec-security-stack__labels">
        {SECURITY_LAYERS.map((layer, index) => (
          <Reveal
            key={layer.label}
            className={`ec-security-stack__label ec-security-stack__label--${index + 1}`}
            variant="panel"
            delay={140 + index * 90}
          >
            <span>{layer.label}</span>
            <strong>{layer.status}</strong>
          </Reveal>
        ))}
      </div>
    </OrbitalSurface>
  );
}
