import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
const ECLIPSE_LOGO_URL = `${import.meta.env.BASE_URL}eclipse-chat-logo.png`;
import {
  CacheGlyph,
  DatabaseGlyph,
  DockerGlyph,
  EdgeGlyph,
  ExecutionFeaturesGrid,
  FinalCtaSection,
  MemoryStorySection,
  SecurityStorySection,
  StorageGlyph,
  TelemetryGlyph,
  TrustBand,
} from "../components/landing/LandingSections";
import {
  HeroOperationalStage,
  MemoryConstellation,
  SecurityStackArt,
} from "../components/landing/LandingVisuals";
import {
  CursorTrail,
  MagneticButton,
  SplitTextReveal,
} from "../components/landing/LandingEffects";
import "../styles/landing.css";

type Props = {
  authMode: "login" | "register" | null;
  authPanel?: ReactNode;
  onOpenAuth: (mode: "login" | "register") => void;
  onCloseAuth: () => void;
  authError?: string | null;
  onLogin?: (email: string, password: string) => Promise<boolean>;
  onRegister?: (email: string, password: string, displayName: string) => Promise<boolean>;
  renderMemoryDiagram?: () => ReactNode;
  renderSecurityArt?: () => ReactNode;
};

const NAV_LINKS = [
  { label: "Продукт", target: "product" },
  { label: "Возможности", target: "features" },
  { label: "Безопасность", target: "security" },
  { label: "Тарифы", target: "pricing" },
  { label: "Документация", target: "docs" },
] as const;

const TRUST_ITEMS = [
  { label: "Docker", glyph: DockerGlyph },
  { label: "Nginx", glyph: EdgeGlyph },
  { label: "Postgres", glyph: DatabaseGlyph },
  { label: "Minio", glyph: StorageGlyph },
  { label: "Redis", glyph: CacheGlyph },
  { label: "Grafana", glyph: TelemetryGlyph },
] as const;

const HERO_CHIPS = ["Self-hosted", "Encrypted", "AI Memory", "Real-time"] as const;

const SECURITY_BULLETS = [
  "Self-hosted и on-premise сценарии без чужого облака.",
  "Контроль доступа и роли живут в вашем внутреннем регламенте.",
  "Резервное копирование и восстановление остаются внутри вашей среды.",
  "Логи и наблюдаемость встраиваются в вашу инфраструктуру.",
] as const;

const SECURITY_ATTESTATIONS = [
  { title: "Данные защищены", value: "шифрование слоев" },
  { title: "Доступ контролируется", value: "роли и 2FA" },
  { title: "Инфраструктура принадлежит вам" },
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
  onOpenAuth,
  authError,
  onLogin,
  onRegister,
  renderMemoryDiagram,
  renderSecurityArt,
}: Props) {
  const heroStageRef = useRef<HTMLDivElement | null>(null);

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

      <div className="ec-landing__shell">
        <nav className="ec-landing__nav" aria-label="Главное">
          <a className="ec-landing__brand" href="#product" aria-label="Eclipse Chat">
            <img
              className="ec-landing__brand-logo"
              src={ECLIPSE_LOGO_URL}
              alt="Eclipse Chat"
              decoding="async"
              loading="eager"
            />
          </a>

          <div className="ec-landing__nav-links">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                type="button"
                className="ec-landing__nav-link"
                onClick={() => scrollToSection(link.target)}
              >
                {link.label}
              </button>
            ))}
          </div>

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

        <section className="ec-landing__hero" id="product">
          <CursorTrail className="ec-landing__hero-trail" density={1} />
          <div className="ec-landing__hero-copy">
            <span className="ec-landing__eyebrow">Операционная платформа для команд</span>
            <h1 className="ec-landing__hero-title">
              <SplitTextReveal stagger={32}>Работа</SplitTextReveal>
              <br />
              <SplitTextReveal delay={220} stagger={32}>в одном</SplitTextReveal>
              <br />
              <span className="ec-landing__hero-title-accent">
                <SplitTextReveal delay={460} stagger={36}>контуре.</SplitTextReveal>
              </span>
            </h1>
            <p className="ec-landing__hero-subhead">
              Чат, задачи, голос и клиентские порталы в единой системе.
              Никакого хаоса. Только исполнение.
            </p>
            <div className="ec-landing__hero-cta">
              <MagneticButton>
                <button
                  type="button"
                  className="ec-landing-btn ec-landing-btn--primary"
                  onClick={() => onOpenAuth("register")}
                >
                  Запустить рабочий контур
                  <span className="ec-landing-btn__arrow" aria-hidden>→</span>
                </button>
              </MagneticButton>
              <button
                type="button"
                className="ec-landing-btn ec-landing-btn--ghost"
                onClick={() => scrollToSection("features")}
              >
                Посмотреть обзор
              </button>
            </div>
            <div className="ec-landing__hero-chips">
              {HERO_CHIPS.map((chip) => (
                <span key={chip} className="ec-landing__chip">{chip}</span>
              ))}
            </div>
          </div>

          <div ref={heroStageRef} className="ec-landing__hero-stage">
            <HeroOperationalStage
              authMode={authMode}
              onOpenAuth={onOpenAuth}
              authError={authError}
              onLogin={onLogin}
              onRegister={onRegister}
            />
          </div>
        </section>

        <TrustBand items={TRUST_ITEMS} />

        <ExecutionFeaturesGrid onOpenSecurity={() => scrollToSection("security")} />

        <MemoryStorySection
          visual={renderMemoryDiagram ? renderMemoryDiagram() : <MemoryConstellation />}
          onOpenDocs={() => scrollToSection("docs")}
        />

        <SecurityStorySection
          visual={renderSecurityArt ? renderSecurityArt() : <SecurityStackArt />}
          bullets={SECURITY_BULLETS}
          attestations={SECURITY_ATTESTATIONS}
          onOpenDocs={() => scrollToSection("docs")}
        />

        <FinalCtaSection
          onLaunch={() => onOpenAuth("register")}
          onDemo={() => scrollToSection("features")}
        />

        <footer className="ec-landing__footer" id="docs">
          <div className="ec-landing__footer-brand">
            <span className="ec-landing__brand">
              <img
                className="ec-landing__brand-logo"
                src={ECLIPSE_LOGO_URL}
                alt="Eclipse Chat"
                decoding="async"
                loading="lazy"
              />
            </span>
            <p>
              Операционная платформа для команд, которые ценят фокус и результат.
            </p>
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
            <a href="#" aria-label="Чат поддержки">
              <MailIcon />
            </a>
            <a href="#" aria-label="GitHub">
              <GithubIcon />
            </a>
            <a href="#" aria-label="Telegram">
              <SendIcon />
            </a>
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

function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.92.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.9-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.59.69.48A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
