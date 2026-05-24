import { useState } from "react";
import { Reveal } from "./CinematicMotion";

type AuthMode = "login" | "register" | null;

type HeroOperationalStageProps = {
  authMode: AuthMode;
  onOpenAuth: (mode: "login" | "register") => void;
  authError?: string | null;
  onLogin?: (email: string, password: string) => Promise<boolean>;
  onRegister?: (email: string, password: string, displayName: string) => Promise<boolean>;
};

/**
 * v1.4.1 — premium auth form polish (Pavel: «давай ещё с формой
 * авторизации что-то придумаем»):
 *   - Floating labels (label shrinks + slides up при focus/filled)
 *   - Field icons (UserIcon / MailIcon / LockIcon) внутри inputs left
 *     side, cyan glow pulse при focus
 *   - Tab switch slide transition — form content translateX horizontal
 *     при login↔register switch
 *   - Corner bracket markers (4 cyan SVG corners на frame edges)
 *
 * Сохраняет v1.4.0 effects:
 *   - Electric border + holographic shimmer
 *   - Password scanner beam
 *   - Submit success state с checkmark
 */

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-10-7-10-7a17.51 17.51 0 0 1 4.06-5.94" />
      <path d="M9.9 4.24A10.07 10.07 0 0 1 12 4c7 0 10 7 10 7a17.55 17.55 0 0 1-2.16 3.19" />
      <path d="M14.12 9.88a3 3 0 1 0-4.24 4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Corner bracket SVG для frame edges. */
function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  return (
    <span className={`ec-hero-access__corner ec-hero-access__corner--${position}`} aria-hidden>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M2 8V2h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="2" cy="2" r="1.5" fill="currentColor" />
      </svg>
    </span>
  );
}

/**
 * Electric Border SVG filter — turbulence + displacement map.
 */
function ElectricBorderFilter() {
  return (
    <svg className="ec-hero-access__svg-defs" aria-hidden>
      <defs>
        <filter
          id="ec-electric-border"
          colorInterpolationFilters="sRGB"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="1" />
          <feOffset in="noise1" dx="0" dy="0" result="offsetNoise1">
            <animate attributeName="dy" values="700; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="1" />
          <feOffset in="noise2" dx="0" dy="0" result="offsetNoise2">
            <animate attributeName="dy" values="0; -700" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise3" seed="2" />
          <feOffset in="noise3" dx="0" dy="0" result="offsetNoise3">
            <animate attributeName="dx" values="490; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise4" seed="2" />
          <feOffset in="noise4" dx="0" dy="0" result="offsetNoise4">
            <animate attributeName="dx" values="0; -490" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>
          <feComposite in="offsetNoise1" in2="offsetNoise2" result="part1" />
          <feComposite in="offsetNoise3" in2="offsetNoise4" result="part2" />
          <feBlend in="part1" in2="part2" mode="color-dodge" result="combinedNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="combinedNoise"
            scale="22"
            xChannelSelector="R"
            yChannelSelector="B"
          />
        </filter>
      </defs>
    </svg>
  );
}

export function HeroOperationalStage({
  authMode,
  onOpenAuth,
  authError,
  onLogin,
  onRegister,
}: HeroOperationalStageProps) {
  const mode: "login" | "register" = authMode ?? "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRevealToggle = () => {
    if (!password) return;
    setScanning(true);
    setTimeout(() => {
      setShowPassword((v) => !v);
      setScanning(false);
    }, 600);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    let ok = false;
    try {
      if (mode === "register") {
        if (onRegister) ok = await onRegister(email, password, displayName.trim() || "User");
      } else {
        if (onLogin) ok = await onLogin(email, password);
      }
    } finally {
      setLoading(false);
    }
    if (ok) {
      setSuccess(true);
    }
  };

  const heading = mode === "register" ? "Активация контура" : "Доступ к контуру";
  const sub =
    mode === "register"
      ? "Создайте рабочую среду для команды."
      : "Войдите в свой рабочий контур.";

  return (
    <div className="ec-hero-access" aria-label="Доступ к Eclipse Chat">
      <ElectricBorderFilter />

      <Reveal className="ec-hero-access__frame" variant="panel">
        {/* Electric border layers */}
        <div className="ec-hero-access__electric" aria-hidden>
          <div className="ec-hero-access__electric-border" />
          <div className="ec-hero-access__electric-glow ec-hero-access__electric-glow--1" />
          <div className="ec-hero-access__electric-glow ec-hero-access__electric-glow--2" />
          <div className="ec-hero-access__electric-overlay" />
          <div className="ec-hero-access__electric-bg" />
        </div>

        {/* Corner bracket markers */}
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />

        <div className="ec-hero-access__glow" aria-hidden />

        <header className="ec-hero-access__head">
          <span className="ec-hero-access__eyebrow">
            <span className="ec-hero-access__eyebrow-dot" aria-hidden />
            контур / {mode === "register" ? "запуск" : "доступ"}
          </span>
          <h2 className="ec-hero-access__title">{heading}</h2>
          <p className="ec-hero-access__sub">{sub}</p>
        </header>

        <div className="ec-hero-access__tabs" role="tablist" aria-label="Режим доступа">
          <span
            className="ec-hero-access__tab-indicator"
            data-mode={mode}
            aria-hidden
          />
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`ec-hero-access__tab${mode === "login" ? " is-active" : ""}`}
            onClick={() => onOpenAuth("login")}
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={`ec-hero-access__tab${mode === "register" ? " is-active" : ""}`}
            onClick={() => onOpenAuth("register")}
          >
            Создать
          </button>
        </div>

        {/* Form (re-keyed на mode change → animation fires) */}
        <form
          key={mode}
          className="ec-hero-access__form"
          data-mode={mode}
          onSubmit={submit}
          noValidate
        >
            {mode === "register" && (
              <div className="ec-hero-access__field">
                <div className={`ec-hero-access__input-wrap ec-hero-access__input-wrap--icon${displayName ? " is-filled" : ""}`}>
                  <span className="ec-hero-access__field-icon" aria-hidden>
                    <UserIcon />
                  </span>
                  <input
                    id="hero-access-name"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    required
                    disabled={loading}
                  />
                  <label htmlFor="hero-access-name" className="ec-hero-access__floating-label">
                    Имя
                  </label>
                </div>
              </div>
            )}

            <div className="ec-hero-access__field">
              <div className={`ec-hero-access__input-wrap ec-hero-access__input-wrap--icon${email ? " is-filled" : ""}`}>
                <span className="ec-hero-access__field-icon" aria-hidden>
                  <MailIcon />
                </span>
                <input
                  id="hero-access-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
                <label htmlFor="hero-access-email" className="ec-hero-access__floating-label">
                  Email
                </label>
              </div>
            </div>

            <div className="ec-hero-access__field">
              <div
                className={`ec-hero-access__input-wrap ec-hero-access__input-wrap--icon ec-hero-access__input-wrap--password${scanning ? " is-scanning" : ""}${password ? " is-filled" : ""}`}
              >
                <span className="ec-hero-access__field-icon" aria-hidden>
                  <LockIcon />
                </span>
                <input
                  id="hero-access-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  disabled={loading}
                />
                <label htmlFor="hero-access-password" className="ec-hero-access__floating-label">
                  Пароль
                </label>
                <span className="ec-hero-access__scan" aria-hidden>
                  <span className="ec-hero-access__scan-beam" />
                </span>
                <button
                  type="button"
                  className={`ec-hero-access__toggle${showPassword ? " is-open" : ""}`}
                  onClick={handleRevealToggle}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  tabIndex={-1}
                  disabled={!password || loading}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="ec-hero-access__error" role="alert">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className={`ec-hero-access__submit${loading ? " is-loading" : ""}${success ? " is-success" : ""}`}
              disabled={loading || success}
            >
              <span className="ec-hero-access__submit-shimmer" aria-hidden />
              {success ? (
                <span className="ec-hero-access__submit-success">
                  <span className="ec-hero-access__submit-check">
                    <CheckIcon />
                  </span>
                  {mode === "register" ? "Контур активирован" : "Вход разрешён"}
                </span>
              ) : (
                <>
                  <span className="ec-hero-access__submit-label">
                    {loading
                      ? mode === "register"
                        ? "Создаём контур…"
                        : "Открываем…"
                      : mode === "register"
                        ? "Создать контур"
                        : "Войти"}
                  </span>
                  {!loading && (
                    <span className="ec-hero-access__submit-arrow" aria-hidden>
                      <ArrowIcon />
                    </span>
                  )}
                </>
              )}
            </button>

            <p className="ec-hero-access__hint">
              {mode === "register" ? (
                <>
                  Уже есть контур?{" "}
                  <button
                    type="button"
                    className="ec-hero-access__hint-link"
                    onClick={() => onOpenAuth("login")}
                  >
                    Войти
                  </button>
                </>
              ) : (
                <>
                  Нет контура?{" "}
                  <button
                    type="button"
                    className="ec-hero-access__hint-link"
                    onClick={() => onOpenAuth("register")}
                  >
                    Создать
                  </button>
                </>
              )}
            </p>
        </form>

        <footer className="ec-hero-access__footer">
          <span className="ec-hero-access__footer-mark">
            <span className="ec-hero-access__footer-dot" aria-hidden />
            шифрованный канал
          </span>
          <span className="ec-hero-access__footer-meta">self-hosted · TLS · 2FA</span>
        </footer>
      </Reveal>
    </div>
  );
}

/**
 * MemoryConstellation — AI Memory visual diagram per reference brief.
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
 */
export function SecurityStackArt() {
  return (
    <div className="ec-security-stack" aria-label="Архитектура безопасности">
      <div className="ec-security-stack__cube" aria-hidden />
    </div>
  );
}
