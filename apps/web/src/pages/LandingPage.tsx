import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  HeroOperationalStage,
  MemoryConstellation,
  SecurityStackArt,
} from "../components/landing/LandingVisuals";
import "../styles/landing.css";

/**
 * Eclipse Chat — Landing (v1.2.30+).
 *
 * Философия: operational infrastructure, не messenger.
 * Brutal minimalism, cinematic depth, cyan signal, rare amber.
 * Памятка: палитра scoped в landing.css (не влияет на product UI с violet).
 *
 * РАЗДЕЛЕНИЕ ТРУДА:
 *   - Скелет / hero copy / nav / features / infra / footer / CTA — здесь (Claude).
 *   - Render-slots ниже владеет Codex (визуальные композиции):
 *       renderHeroStage      — живая operational сцена в правой части hero
 *       renderMemoryDiagram  — brain-hub SVG с орбитами в AI Memory секции
 *       renderSecurityArt    — 3D-stack lock illustration в Security секции
 *   - До поставки от Codex'а — рендерим placeholder с подписью.
 */

type Props = {
  authMode: "login" | "register" | null;
  authPanel: ReactNode;
  onOpenAuth: (mode: "login" | "register") => void;
  onCloseAuth: () => void;
  /** Codex slot: living operational UI в правой части hero. */
  renderHeroStage?: (args: {
    authMode: "login" | "register" | null;
    authPanel: ReactNode;
    onOpenAuth: (mode: "login" | "register") => void;
    onCloseAuth: () => void;
  }) => ReactNode;
  /** Codex slot: brain-hub SVG для AI Memory section. */
  renderMemoryDiagram?: () => ReactNode;
  /** Codex slot: 3D security illustration. */
  renderSecurityArt?: () => ReactNode;
};

/* v1.3.0a: nav menu links удалены — semantic noise, scrollIntoView в
   overlapping секции отвлекал от brand+CTA пары. Hero chip-tags тоже
   удалены — повторяли features секцию. */

const INFRA = [
  "DOCKER",
  "NGINX",
  "POSTGRES",
  "MINIO",
  "REDIS",
  "GRAFANA",
] as const;

/* v1.3.0a: editorial copy — короче, операционный тон, без feature-dump'а. */
const FEATURES = [
  {
    title: "Каналы",
    body: "Обсуждения, разделённые по проектам. Без шума, без потерь.",
    icon: ChatIcon,
  },
  {
    title: "Исполнение",
    body: "Из сигнала — задача. Ответственный виден сразу.",
    icon: TaskIcon,
  },
  {
    title: "Голос",
    body: "Созвон без внешних сервисов. Запись остаётся в контексте.",
    icon: VoiceIcon,
  },
  {
    title: "Клиенты",
    body: "Внешний доступ к проекту — без хаоса в переписке.",
    icon: PortalIcon,
  },
] as const;

/* v1.3.0a: 4 → 3 bullets. «Резервное копирование» — hygiene, не
   differentiator; убрано чтобы оставить три сильных утверждения. */
const SECURITY_BULLETS = [
  "TLS-транспорт, контролируемые каналы",
  "Ролевой доступ, 2FA, recovery",
  "Контур разворачивается в вашей сети",
] as const;

const SECURITY_CHIPS = [
  { title: "Секреты 2FA", value: "AES-256-GCM", icon: ShieldIcon },
  { title: "Доступ контролируется", value: "ROLE-BASED", icon: KeyIcon },
  { title: "Инфраструктура", value: "SELF-HOSTED", icon: ServerIcon },
] as const;

const FOOTER_COLS: Array<{
  heading: string;
  items: ReadonlyArray<{ label: string; href?: string }>;
}> = [
  {
    heading: "Продукт",
    items: [
      { label: "Возможности" },
      { label: "Тарифы" },
      { label: "Документация" },
      { label: "Roadmap" },
    ],
  },
  {
    heading: "Ресурсы",
    items: [
      { label: "Блог" },
      { label: "Гайды" },
      { label: "API" },
      { label: "Статус" },
    ],
  },
  {
    heading: "Компания",
    items: [
      { label: "О нас" },
      { label: "Безопасность" },
      { label: "Контакты" },
    ],
  },
];

export function LandingPage({
  authMode,
  authPanel,
  onOpenAuth,
  onCloseAuth,
  renderHeroStage,
  renderMemoryDiagram,
  renderSecurityArt,
}: Props) {
  const brandMarkUrl = `${import.meta.env.BASE_URL}brand-mark.svg`;
  const heroStageRef = useRef<HTMLDivElement | null>(null);

  // При открытии auth возвращаем пользователя к hero-сцене, где теперь живет доступ.
  useEffect(() => {
    if (!authMode || !heroStageRef.current) return;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      heroStageRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      });
    });
  }, [authMode]);

  return (
    <main className="ec-landing" aria-label="Eclipse Chat">
      <div className="ec-landing__atmosphere" aria-hidden />

      {/* ───────── NAV ───────── */}
      <div className="ec-landing__shell">
        <nav className="ec-landing__nav" aria-label="Главное">
          <span className="ec-landing__brand">
            <span className="ec-landing__brand-mark" aria-hidden>
              <img src={brandMarkUrl} alt="" decoding="async" />
            </span>
            Eclipse Chat
          </span>
          {/* v1.3.0a: 5-link menu удалено — semantic noise. Brand + CTA. */}
          <div className="ec-landing__nav-actions">
            <button
              type="button"
              className="ec-landing-btn ec-landing-btn--link"
              onClick={() => onOpenAuth("login")}
            >
              Вход
            </button>
            <button
              type="button"
              className="ec-landing-btn ec-landing-btn--primary"
              onClick={() => onOpenAuth("register")}
            >
              Запустить контур
              <span className="ec-landing-btn__arrow" aria-hidden>→</span>
            </button>
          </div>
        </nav>

        {/* ───────── HERO ───────── */}
        <section className="ec-landing__hero" id="product">
          <div className="ec-landing__hero-copy">
            <span className="ec-landing__eyebrow">
              [01] КОНТУР ИСПОЛНЕНИЯ
            </span>
            <h1 className="ec-landing__hero-title">
              Исполнение
              <br />
              <span className="ec-landing__hero-title-accent">без хаоса.</span>
            </h1>
            <p className="ec-landing__hero-subhead">
              Один контур для команд, которые работают,
              а не обсуждают работу.
            </p>
            <div className="ec-landing__hero-cta">
              <button
                type="button"
                className="ec-landing-btn ec-landing-btn--primary"
                onClick={() => onOpenAuth("register")}
              >
                Запустить контур
                <span className="ec-landing-btn__arrow" aria-hidden>→</span>
              </button>
              <button
                type="button"
                className="ec-landing-btn ec-landing-btn--ghost"
                onClick={() => scrollToSection("features")}
              >
                Открыть демо
              </button>
            </div>
            {/* v1.3.0a: 4 chip-tags (SELF-HOSTED · ENCRYPTED · AI MEMORY ·
                REAL-TIME) удалены — дублировали features секцию и заглушали
                brutal type hierarchy. */}
          </div>

          {/* Hero stage — Codex slot. */}
          <div ref={heroStageRef} className="ec-landing__hero-stage">
            {renderHeroStage ? (
              renderHeroStage({
                authMode,
                authPanel,
                onOpenAuth,
                onCloseAuth,
              })
            ) : (
              <HeroOperationalStage
                authMode={authMode}
                authPanel={authPanel}
                onOpenAuth={onOpenAuth}
                onCloseAuth={onCloseAuth}
              />
            )}
          </div>
        </section>

        {/* ───────── INFRA TRUST ───────── */}
        <section className="ec-landing__trust" aria-label="Инфраструктурный стек">
          <div className="ec-landing__trust-eyebrow">Работает на</div>
          <div className="ec-landing__trust-grid">
            {INFRA.map((name) => (
              <div key={name} className="ec-landing__trust-item">
                {name}
              </div>
            ))}
          </div>
        </section>

        {/* ───────── FEATURES ───────── */}
        <section className="ec-landing__section" id="features">
          <div className="ec-landing__section-head">
            <div>
              <span className="ec-landing__eyebrow">[02] Поверхности</span>
              <h2 className="ec-landing__section-title">
                Одна система.
                <br />
                Без пропусков.
              </h2>
            </div>
            <div>
              <p className="ec-landing__section-copy">
                Общение, задачи, голос и клиенты — в одном контуре.
                Без переключений между инструментами.
              </p>
              <div style={{ marginTop: "var(--L-gap-4)" }}>
                <button
                  type="button"
                  className="ec-landing-btn ec-landing-btn--ghost"
                  onClick={() => scrollToSection("security")}
                >
                  Архитектура
                  <span className="ec-landing-btn__arrow" aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>

          <div className="ec-landing__features">
            {FEATURES.map(({ title, body, icon: Icon }) => (
              <article key={title} className="ec-landing__feature">
                <span className="ec-landing__feature-icon" aria-hidden>
                  <Icon />
                </span>
                <h3 className="ec-landing__feature-title">{title}</h3>
                <p className="ec-landing__feature-body">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ───────── AI MEMORY (split) ───────── */}
        <section className="ec-landing__section">
          <div className="ec-landing__split">
            <div className="ec-landing__split-visual">
              {renderMemoryDiagram ? (
                renderMemoryDiagram()
              ) : (
                <MemoryConstellation />
              )}
            </div>
            <div className="ec-landing__split-copy">
              <span className="ec-landing__eyebrow">[03] AI Memory</span>
              <h2 className="ec-landing__section-title">
                Контекст остаётся.
              </h2>
              <p className="ec-landing__section-copy">
                Решения, файлы, обсуждения — связаны контекстом.
                Новый человек в команде включается через минуты,
                не дни.
              </p>
              <div>
                <button
                  type="button"
                  className="ec-landing-btn ec-landing-btn--ghost"
                  onClick={() => scrollToSection("docs")}
                >
                  Открыть AI Memory
                  <span className="ec-landing-btn__arrow" aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── SECURITY (split reverse) ───────── */}
        <section className="ec-landing__section" id="security">
          <div className="ec-landing__split">
            <div className="ec-landing__split-copy">
              <span className="ec-landing__eyebrow">[04] Архитектурное обещание</span>
              <h2 className="ec-landing__section-title">
                Инфраструктура
                <br />
                в ваших руках.
              </h2>
              <p className="ec-landing__section-copy">
                Self-hosted. On-premise. Шифрование на всех уровнях.
                Архитектура не требует доверия третьей стороне.
              </p>
              <ul className="ec-landing__split-bullets">
                {SECURITY_BULLETS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div style={{ marginTop: "var(--L-gap-3)" }}>
                <button
                  type="button"
                  className="ec-landing-btn ec-landing-btn--ghost"
                  onClick={() => scrollToSection("docs")}
                >
                  Архитектура безопасности
                  <span className="ec-landing-btn__arrow" aria-hidden>→</span>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--L-gap-4)" }}>
              <div
                className="ec-landing__split-visual"
                style={{ minHeight: 220 }}
              >
                {renderSecurityArt ? (
                  renderSecurityArt()
                ) : (
                  <SecurityStackArt />
                )}
              </div>
              <div className="ec-landing__security-chips">
                {SECURITY_CHIPS.map(({ title, value, icon: Icon }) => (
                  <div key={title} className="ec-landing__security-chip">
                    <span className="ec-landing__security-chip-icon" aria-hidden>
                      <Icon />
                    </span>
                    <div className="ec-landing__security-chip-text">
                      <strong>{title}</strong>
                      <span>{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ───────── CTA BAND ───────── */}
        <section className="ec-landing__cta" id="pricing">
          <div>
            <h2 className="ec-landing__cta-title">
              Запустите контур.
            </h2>
            <p className="ec-landing__cta-sub">
              Один сервер. Один контур. Полный контроль.
            </p>
          </div>
          <div className="ec-landing__cta-actions">
            {/* v1.3.0a: единственный CTA — без «или» divider и ghost backup.
                Один statement = одна команда. */}
            <button
              type="button"
              className="ec-landing-btn ec-landing-btn--primary"
              onClick={() => onOpenAuth("register")}
            >
              Запустить контур
              <span className="ec-landing-btn__arrow" aria-hidden>→</span>
            </button>
          </div>
        </section>

        {/* ───────── FOOTER ───────── */}
        <footer className="ec-landing__footer" id="docs">
          <div className="ec-landing__footer-brand">
            <span className="ec-landing__brand">
              <span className="ec-landing__brand-mark" aria-hidden>
                <img src={brandMarkUrl} alt="" decoding="async" />
              </span>
              Eclipse Chat
            </span>
            <span className="ec-landing__footer-brand-sub">
              Операционная платформа для команд, которые ценят фокус
              и результат.
            </span>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.heading} className="ec-landing__footer-col">
              <h4>{col.heading}</h4>
              <ul>
                {col.items.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <a href={item.href}>{item.label}</a>
                    ) : (
                      <button type="button">{item.label}</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="ec-landing__footer-social" aria-label="Соцсети">
            <a href="#" aria-label="Чат поддержки"><MailIcon /></a>
            <a href="#" aria-label="GitHub"><GithubIcon /></a>
            <a href="#" aria-label="Telegram"><SendIcon /></a>
          </div>
          <div className="ec-landing__footer-fineprint">
            © 2026 Eclipse Chat. Все права защищены.
          </div>
        </footer>
      </div>
    </main>
  );
}

function scrollToSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

/* ──────── SVG icons ──────── */

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V5z" />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M4 12v0" />
      <path d="M8 8v8" />
      <path d="M12 5v14" />
      <path d="M16 9v6" />
      <path d="M20 11v2" />
    </svg>
  );
}

function PortalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="8" cy="14" r="4" />
      <path d="M12 14h9" />
      <path d="M17 14v3" />
      <path d="M20 14v2" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="4" width="18" height="6" rx="1" />
      <rect x="3" y="14" width="18" height="6" rx="1" />
      <circle cx="7" cy="7" r="0.5" fill="currentColor" />
      <circle cx="7" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.92.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.9-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.59.69.48A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
