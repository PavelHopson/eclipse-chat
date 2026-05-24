import type { ReactNode } from "react";
import { Reveal } from "./CinematicMotion";

type AuthMode = "login" | "register" | null;

type HeroOperationalStageProps = {
  authMode: AuthMode;
  authPanel: ReactNode;
  onOpenAuth: (mode: "login" | "register") => void;
  onCloseAuth: () => void;
};

/**
 * v1.3.5 — premium auth panel in hero per Pavel verdict (24.05.2026):
 *   «надо вот это полностью убрать [console mockup] и сделать форму
 *   входа максимально профессионально и уникально».
 *
 *   Console mockup (rail / main feed / side ops panel) удалён полностью.
 *   Hero stage теперь = premium access panel (login/register form).
 *
 *   Auth panel = AuthPage embedded mode injected as `authPanel` prop.
 *   App.tsx гарантирует что panel рендерится всегда (default login mode
 *   когда authSurface null), не только в auth surface mode.
 *
 *   Premium frame:
 *     - Eclipse halo (от hero ::before) видна за frame'ом
 *     - Cyan glow border
 *     - Monumental heading «Доступ к контуру» / «Активация контура»
 *     - Tabs Вход/Создать переключают mode
 *     - Form rendered внутри
 *     - Footer mono signature
 */

export function HeroOperationalStage({
  authMode,
  authPanel,
  onOpenAuth,
  onCloseAuth: _onCloseAuth,
}: HeroOperationalStageProps) {
  const activeMode: "login" | "register" = authMode ?? "login";
  const heading =
    activeMode === "register" ? "Активация контура" : "Доступ к контуру";
  const sub =
    activeMode === "register"
      ? "Создайте новый рабочий контур за минуту."
      : "Войдите в свою рабочую среду.";

  return (
    <div className="ec-hero-access" aria-label="Доступ к Eclipse Chat">
      <Reveal className="ec-hero-access__frame" variant="panel">
        <header className="ec-hero-access__head">
          <div className="ec-hero-access__head-titles">
            <span className="ec-hero-access__head-label">
              {activeMode === "register" ? "контур / запуск" : "контур / доступ"}
            </span>
            <h2 className="ec-hero-access__head-title">{heading}</h2>
            <p className="ec-hero-access__head-sub">{sub}</p>
          </div>

          <div
            className="ec-hero-access__tabs"
            role="tablist"
            aria-label="Режим доступа"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "login"}
              className={`ec-hero-access__tab${activeMode === "login" ? " is-active" : ""}`}
              onClick={() => onOpenAuth("login")}
            >
              Вход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "register"}
              className={`ec-hero-access__tab${activeMode === "register" ? " is-active" : ""}`}
              onClick={() => onOpenAuth("register")}
            >
              Создать
            </button>
          </div>
        </header>

        <div className="ec-hero-access__body">{authPanel}</div>

        <footer className="ec-hero-access__footer">
          <span className="ec-hero-access__footer-mark">
            <span className="ec-hero-access__footer-dot" aria-hidden />
            контур / шифрованный канал
          </span>
          <span className="ec-hero-access__footer-meta">
            self-hosted · TLS · 2FA
          </span>
        </footer>
      </Reveal>
    </div>
  );
}

/**
 * MemoryConstellation — AI Memory visual diagram per reference brief.
 * Central core 108px с «AI» mono + 2 elliptical orbits + 6 floating nodes.
 */
export function MemoryConstellation() {
  const MEMORY_NODES = [
    { label: "Решения", className: "ec-memory-map__node--one" },
    { label: "Документы", className: "ec-memory-map__node--two" },
    { label: "Задачи", className: "ec-memory-map__node--three" },
    { label: "Обсуждения", className: "ec-memory-map__node--four" },
    { label: "Файлы", className: "ec-memory-map__node--five" },
    { label: "Участники", className: "ec-memory-map__node--six" },
  ] as const;
  return (
    <div className="ec-memory-map" aria-label="AI Memory — карта контекста">
      <div className="ec-memory-map__orbit ec-memory-map__orbit--two" aria-hidden />
      <div className="ec-memory-map__orbit ec-memory-map__orbit--one" aria-hidden />

      <Reveal className="ec-memory-map__core" variant="panel">
        <span className="ec-memory-map__core-shell" aria-hidden>AI</span>
        <strong>Memory</strong>
        <span className="ec-memory-map__core-meta">persistent context</span>
      </Reveal>

      {MEMORY_NODES.map((node, index) => (
        <Reveal
          key={node.label}
          className={`ec-memory-map__node ${node.className}`}
          variant="panel"
          delay={index * 80}
        >
          {node.label}
        </Reveal>
      ))}
    </div>
  );
}

/**
 * SecurityStackArt — security visual anchor per reference brief.
 * 3D rotated cube (rotateX 55deg / rotateZ 45deg) с nested rings.
 */
export function SecurityStackArt() {
  return (
    <div className="ec-security-stack" aria-label="Архитектура безопасности">
      <div className="ec-security-stack__cube" aria-hidden />
    </div>
  );
}
