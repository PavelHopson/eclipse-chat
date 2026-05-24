import type { ComponentType, ReactNode } from "react";
import { Reveal } from "./CinematicMotion";

type TrustBandProps = {
  items: ReadonlyArray<{
    label: string;
    glyph: ComponentType;
  }>;
};

type ExecutionFeaturesGridProps = {
  onOpenSecurity: () => void;
};

type MemoryStorySectionProps = {
  visual: ReactNode;
  onOpenDocs: () => void;
};

type SecurityStorySectionProps = {
  visual: ReactNode;
  bullets: ReadonlyArray<string>;
  attestations: ReadonlyArray<{
    title: string;
    value?: string;
  }>;
  onOpenDocs: () => void;
};

type FinalCtaSectionProps = {
  onLaunch: () => void;
  onDemo?: () => void;
};

const FEATURES = [
  {
    title: "Чаты и каналы",
    body: "Структурируйте обсуждения по проектам, отделам и темам.",
  },
  {
    title: "Задачи и проекты",
    body: "Ставьте задачи, назначайте исполнителей и отслеживайте прогресс.",
  },
  {
    title: "Голос и видео",
    body: "Качественные звонки и созвоны без внешних сервисов.",
  },
  {
    title: "Клиентские порталы",
    body: "Дайте клиентам доступ к проектам без хаоса в переписке.",
  },
] as const;

export function TrustBand({ items }: TrustBandProps) {
  return (
    <section className="ec-landing__trust" aria-label="Инфраструктура">
      <div className="ec-landing__trust-label">Доверие инфраструктурам —</div>
      <div className="ec-landing__trust-row">
        {items.map(({ label, glyph: Glyph }, index) => (
          <Reveal
            key={label}
            className="ec-landing__trust-item"
            variant="fade"
            delay={index * 50}
          >
            <span className="ec-landing__trust-glyph" aria-hidden>
              <Glyph />
            </span>
            {label}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function ExecutionFeaturesGrid({
  onOpenSecurity,
}: ExecutionFeaturesGridProps) {
  return (
    <section className="ec-landing__section" id="features">
      <div className="ec-landing__section-grid">
        <div>
          <span className="ec-landing__section-eyebrow">Всё, что нужно команде</span>
          <h2 className="ec-landing__h2">
            Одна система.
            <br />
            <span className="ec-landing__h2-accent">Полный контроль.</span>
          </h2>
          <p className="ec-landing__body">
            Объедините общение, задачи, файлы и клиентов в одном пространстве.
            Без лишних инструментов и переключений.
          </p>
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--ghost ec-landing__section-cta"
            onClick={onOpenSecurity}
          >
            Все возможности
            <span className="ec-landing-btn__arrow" aria-hidden>→</span>
          </button>
        </div>

        <div className="ec-landing__features">
          {FEATURES.map((feature, index) => (
            <Reveal
              key={feature.title}
              className="ec-landing__feature"
              variant="panel"
              delay={index * 80}
            >
              <span className="ec-landing__feature-icon" aria-hidden />
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MemoryStorySection({
  visual,
  onOpenDocs,
}: MemoryStorySectionProps) {
  return (
    <section className="ec-landing__section" id="memory">
      <div className="ec-landing__memory-grid">
        <div>{visual}</div>
        <div>
          <span className="ec-landing__section-eyebrow">AI Memory</span>
          <h2 className="ec-landing__h2">Система помнит важное.</h2>
          <p className="ec-landing__body">
            AI Memory сохраняет контекст команды: решения, документы,
            договорённости и ключевые факты. Ничего не теряется.
          </p>
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--ghost ec-landing__section-cta"
            onClick={onOpenDocs}
          >
            Узнать больше
            <span className="ec-landing-btn__arrow" aria-hidden>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export function SecurityStorySection({
  visual,
  bullets,
  attestations,
  onOpenDocs,
}: SecurityStorySectionProps) {
  return (
    <section className="ec-landing__section" id="security">
      <div className="ec-landing__security-grid">
        <div>
          <span className="ec-landing__section-eyebrow">Безопасность —</span>
          <h2 className="ec-landing__h2">
            Ваши данные —
            <br />
            <span className="ec-landing__h2-accent">ваш контроль.</span>
          </h2>
          <p className="ec-landing__body">
            Self-hosted архитектура. Шифрование на всех уровнях. Никаких облаков
            без вашего разрешения.
          </p>
          <ul className="ec-landing__security-bullets">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--ghost ec-landing__section-cta"
            onClick={onOpenDocs}
          >
            Подробнее о безопасности
            <span className="ec-landing-btn__arrow" aria-hidden>→</span>
          </button>
        </div>

        <div className="ec-landing__security-side">
          {visual}
          <div className="ec-landing__security-cards">
            {attestations.map(({ title, value }, index) => (
              <Reveal
                key={title}
                className="ec-landing__sec-card"
                variant="panel"
                delay={index * 70}
              >
                <b>{title}</b>
                {value}
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection({ onLaunch, onDemo }: FinalCtaSectionProps) {
  return (
    <div className="ec-landing__final" id="pricing">
      <div>
        <h2>
          Готовы запустить
          <br />
          <span className="ec-landing__h2-accent">рабочий контур?</span>
        </h2>
        <p className="ec-landing__body">
          Разверните Eclipse Chat на своём сервере и начните работать уже сегодня.
        </p>
      </div>
      <div className="ec-landing__final-actions">
        <button
          type="button"
          className="ec-landing-btn ec-landing-btn--primary"
          onClick={onLaunch}
        >
          Запустить рабочий контур
          <span className="ec-landing-btn__arrow" aria-hidden>→</span>
        </button>
        <span className="ec-landing__final-or">ИЛИ</span>
        <button
          type="button"
          className="ec-landing-btn ec-landing-btn--ghost"
          onClick={onDemo ?? onLaunch}
        >
          Посмотреть демо
        </button>
      </div>
    </div>
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
