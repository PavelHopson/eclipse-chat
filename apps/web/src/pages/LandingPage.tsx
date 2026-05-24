import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  CacheGlyph,
  DatabaseGlyph,
  DockerGlyph,
  EdgeGlyph,
  ExecutionLayerSection,
  FinalCtaSection,
  MemoryContinuumLayer,
  SecurityAuthorityBlock,
  StorageGlyph,
  TelemetryGlyph,
  TrustBand,
} from "../components/landing/LandingSections";
import { HeroOperationalStage } from "../components/landing/LandingVisuals";
import "../styles/landing.css";

type Props = {
  authMode: "login" | "register" | null;
  authPanel: ReactNode;
  onOpenAuth: (mode: "login" | "register") => void;
  onCloseAuth: () => void;
  renderHeroStage?: (args: {
    authMode: "login" | "register" | null;
    authPanel: ReactNode;
    onOpenAuth: (mode: "login" | "register") => void;
    onCloseAuth: () => void;
  }) => ReactNode;
};

const TRUST_ITEMS = [
  { label: "Docker", role: "контур сервиса", glyph: DockerGlyph },
  { label: "NGINX", role: "edge и ingress", glyph: EdgeGlyph },
  { label: "Postgres", role: "операционные данные", glyph: DatabaseGlyph },
  { label: "MinIO", role: "файловый слой", glyph: StorageGlyph },
  { label: "Redis", role: "буфер continuity", glyph: CacheGlyph },
  { label: "Grafana", role: "telemetry", glyph: TelemetryGlyph },
] as const;

/* v1.3.2 slice C — authority statements. Каждый = одно техническое
   утверждение про то, что среда принадлежит вам. НЕ marketing claims. */
const SECURITY_BULLETS = [
  "Контур разворачивается внутри вашей сети. Внешний облачный слой не нужен.",
  "Транспорт, ключи и роли остаются у владельца — не у вендора.",
  "Резерв, восстановление и журналирование живут в вашем регламенте.",
  "Telemetry входит в ваш observability-стек, а не в чужую витрину.",
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
}: Props) {
  const brandMarkUrl = `${import.meta.env.BASE_URL}brand-mark.svg`;
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
          <span className="ec-landing__brand">
            <span className="ec-landing__brand-mark" aria-hidden>
              <img src={brandMarkUrl} alt="" decoding="async" />
            </span>
            Eclipse Chat
          </span>

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
              <span className="ec-landing-btn__arrow" aria-hidden>
                →
              </span>
            </button>
          </div>
        </nav>

        <section className="ec-landing__hero" id="product">
          <div className="ec-landing__hero-copy">
            <span className="ec-landing__eyebrow">[01] Среда исполнения</span>
            <h1 className="ec-landing__hero-title">
              Контур
              <br />
              <span className="ec-landing__hero-title-accent">уже идет.</span>
            </h1>
            <p className="ec-landing__hero-subhead">
              Сигнал, задача, голос и доступ держатся в одном состоянии.
            </p>
            <div className="ec-landing__hero-cta">
              <button
                type="button"
                className="ec-landing-btn ec-landing-btn--primary"
                onClick={() => onOpenAuth("register")}
              >
                Запустить контур
                <span className="ec-landing-btn__arrow" aria-hidden>
                  →
                </span>
              </button>
              <button
                type="button"
                className="ec-landing-btn ec-landing-btn--ghost"
                onClick={() => scrollToSection("features")}
              >
                Смотреть слой
              </button>
            </div>
          </div>

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

        <TrustBand items={TRUST_ITEMS} />

        <ExecutionLayerSection onOpenSecurity={() => scrollToSection("security")} />

        <MemoryContinuumLayer onOpenDocs={() => scrollToSection("docs")} />

        <SecurityAuthorityBlock
          bullets={SECURITY_BULLETS}
          onOpenDocs={() => scrollToSection("docs")}
        />

        <FinalCtaSection onLaunch={() => onOpenAuth("register")} />

        <footer className="ec-landing__footer" id="docs">
          <div className="ec-landing__footer-brand">
            <span className="ec-landing__brand">
              <span className="ec-landing__brand-mark" aria-hidden>
                <img src={brandMarkUrl} alt="" decoding="async" />
              </span>
              Eclipse Chat
            </span>
            <span className="ec-landing__footer-brand-sub">
              Операционная среда для команд, которым нужен собственный устойчивый контур.
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

function MailIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
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
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
