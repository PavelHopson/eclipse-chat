import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
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
  CursorLight,
  MagneticButton,
} from "../components/landing/LandingEffects";
import { LandingCinematic } from "../components/landing/LandingCinematic";
import "../styles/landing.css";
import "../styles/landing-cinematic.css";

const ECLIPSE_MARK_URL = `${import.meta.env.BASE_URL}brand-mark.svg`;
const ECLIPSE_HERO_REFERENCE_URL = `${import.meta.env.BASE_URL}auth/eclipse-forge-reference.png`;
const AUTH_BACKGROUND_URL = `${import.meta.env.BASE_URL}auth/eclipse-login-orbit.webp`;

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

const HERO_CHIPS = ["Self-hosted", "TLS / WSS", "RBAC + 2FA", "Real-time"] as const;

/* v1.4.5 audit fix P2 — security copy more precise. Раньше «end-to-end
 * шифрование» / «шифрование на всех уровнях» overstated — messages в
 * Prisma plain `String content`, e2e не реализовано. Реально есть:
 * TLS-транспорт (HTTPS/WSS), AES-256-GCM для секретов/интеграций,
 * RBAC + 2FA для доступа, self-hosted control. */
const SECURITY_BULLETS = [
  "Self-hosted и on-premise сценарии без чужого облака.",
  "TLS-транспорт для HTTP, WebSocket и медиа-каналов.",
  "AES-256-GCM для секретов, токенов и интеграций.",
  "RBAC + 2FA + ваши backup-регламенты для доступа и восстановления.",
] as const;

const SECURITY_ATTESTATIONS = [
  { title: "Транспорт", value: "TLS · WSS" },
  { title: "Секреты", value: "AES-256-GCM" },
  { title: "Доступ", value: "RBAC + 2FA" },
] as const;

const FOOTER_LINKS = [
  { label: "Продукт", target: "product" },
  { label: "Возможности", target: "features" },
  { label: "AI Memory", target: "memory" },
  { label: "Безопасность", target: "security" },
] as const;

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
  const [activeSection, setActiveSection] = useState<string>("product");
  const navRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    opacity: number;
  }>({ left: 0, width: 0, opacity: 0 });

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

  /* v1.5.0 — scroll-driven active nav indicator. IntersectionObserver
   * watches section anchors → updates activeSection → indicator slides
   * под active link через CSS transition. */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sectionIds = NAV_LINKS.map((link) => link.target);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (elements.length === 0) return;

    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        });
        let topId = "";
        let topRatio = 0;
        visible.forEach((ratio, id) => {
          if (ratio > topRatio) {
            topRatio = ratio;
            topId = id;
          }
        });
        if (topId) setActiveSection(topId);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* Move indicator under active link */
  useEffect(() => {
    const linkNode = linkRefs.current.get(activeSection);
    const navNode = navRef.current;
    if (!linkNode || !navNode) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const linkRect = linkNode.getBoundingClientRect();
    const navRect = navNode.getBoundingClientRect();
    setIndicatorStyle({
      left: linkRect.left - navRect.left,
      width: linkRect.width,
      opacity: 1,
    });
  }, [activeSection]);

  return (
    <main
      className="ec-landing"
      aria-label="Eclipse Chat"
      data-active-section={activeSection}
      style={{ "--ec-auth-bg-image": `url("${AUTH_BACKGROUND_URL}")` } as CSSProperties}
    >
      <LandingCinematic activeSection={activeSection} />
      <div className="ec-landing__atmosphere" aria-hidden />

      <div className="ec-landing__shell">
        <nav className="ec-landing__nav" aria-label="Главное">
          <a
            className="ec-landing__brand"
            href="#product"
            aria-label="Eclipse Chat"
            onClick={(event) => {
              event.preventDefault();
              scrollToSection("product");
            }}
          >
            <img
              className="ec-landing__brand-mark"
              src={ECLIPSE_MARK_URL}
              alt=""
              decoding="async"
              loading="eager"
            />
            <span className="ec-landing__brand-name">ECLIPSE CHAT</span>
          </a>

          <div className="ec-landing__nav-links" ref={navRef}>
            {NAV_LINKS.map((link) => (
              <MagneticButton key={link.label} intensity={0.18}>
                <button
                  ref={(node) => {
                    if (node) linkRefs.current.set(link.target, node);
                    else linkRefs.current.delete(link.target);
                  }}
                  type="button"
                  className={`ec-landing__nav-link${activeSection === link.target ? " is-active" : ""}`}
                  aria-current={activeSection === link.target ? "page" : undefined}
                  onClick={() => scrollToSection(link.target)}
                >
                  {link.label}
                </button>
              </MagneticButton>
            ))}
            <span
              className="ec-landing__nav-indicator"
              style={{
                transform: `translateX(${indicatorStyle.left}px)`,
                width: indicatorStyle.width,
                opacity: indicatorStyle.opacity,
              }}
              aria-hidden
            />
          </div>

          <div className="ec-landing__nav-actions">
            <button
              type="button"
              className={`ec-landing-btn ec-landing-btn--link${authMode === "login" ? " is-active" : ""}`}
              aria-controls="auth-panel"
              aria-expanded={authMode === "login"}
              onClick={() => onOpenAuth("login")}
            >
              <span className="ec-landing-btn__login-orbit" aria-hidden />
              Войти
            </button>
            <button
              type="button"
              className="ec-landing-btn ec-landing-btn--primary"
              onClick={() => onOpenAuth("register")}
            >
              Создать пространство
              <span className="ec-landing-btn__arrow" aria-hidden>→</span>
            </button>
          </div>
        </nav>

        <section
          className={`ec-landing__hero ${authMode ? "is-auth-open" : "is-product-preview"}`}
          id="product"
        >
          <CursorLight />
          {authMode && (
            <span className="ec-landing__auth-eclipse" aria-hidden>
              <span className="ec-landing__auth-eclipse-rays" />
              <span className="ec-landing__auth-eclipse-corona" />
              <span className="ec-landing__auth-eclipse-orbit ec-landing__auth-eclipse-orbit--outer" />
              <span className="ec-landing__auth-eclipse-mark">
                <img src={ECLIPSE_HERO_REFERENCE_URL} alt="" decoding="async" />
              </span>
              <span className="ec-landing__auth-eclipse-chromosphere" />
              <span className="ec-landing__auth-eclipse-diamond" />
              <span className="ec-landing__auth-eclipse-lensing" />
              <span className="ec-landing__auth-eclipse-reflection" />
            </span>
          )}
          <div className="ec-landing__hero-copy">
            <span className="ec-landing__eyebrow">Self-hosted communication core</span>
            <h1 className="ec-landing__hero-title">
              <span className="ec-landing__hero-title-line">Команда.</span>
              <span className="ec-landing__hero-title-line">Контекст.</span>
              <span className="ec-landing__hero-title-line ec-landing__hero-title-accent">
                Действие.
              </span>
            </h1>
            <p className="ec-landing__hero-subhead">
              Каналы, задачи, голос и AI-память в одном пространстве.
              Решения не теряются — следующий шаг всегда виден.
            </p>
            <div className="ec-landing__hero-cta">
              <MagneticButton>
                <button
                  type="button"
                  className="ec-landing-btn ec-landing-btn--primary"
                  onClick={() => onOpenAuth("register")}
                >
                  Создать пространство
                  <span className="ec-landing-btn__arrow" aria-hidden>→</span>
                </button>
              </MagneticButton>
              <button
                type="button"
                className="ec-landing-btn ec-landing-btn--ghost"
                onClick={() => scrollToSection("features")}
              >
                Посмотреть рабочий интерфейс
                <span className="ec-landing-btn__arrow" aria-hidden>↓</span>
              </button>
            </div>
            <div className="ec-landing__hero-chips">
              {HERO_CHIPS.map((chip) => (
                <span key={chip} className="ec-landing__chip">{chip}</span>
              ))}
            </div>
          </div>

          <div id="auth-panel" ref={heroStageRef} className="ec-landing__hero-stage">
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
                className="ec-landing__brand-mark"
                src={ECLIPSE_MARK_URL}
                alt=""
                decoding="async"
                loading="lazy"
              />
              <span className="ec-landing__brand-name">ECLIPSE CHAT</span>
            </span>
            <p>
              Операционная платформа для команд, которые ценят фокус и результат.
            </p>
          </div>

          <nav className="ec-landing__footer-nav" aria-label="Навигация в подвале">
            {FOOTER_LINKS.map((item) => (
              <button
                key={item.target}
                type="button"
                onClick={() => scrollToSection(item.target)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ec-landing__footer-actions">
            <button type="button" onClick={() => onOpenAuth("login")}>Войти</button>
            <a
              href="https://github.com/PavelHopson/eclipse-chat"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
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
