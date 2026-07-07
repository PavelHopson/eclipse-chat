import { useState } from "react";
import { Reveal } from "./CinematicMotion";
import { apiPath } from "../../lib/api";

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
  // v1.6.68 — self-serve сброс пароля по коду восстановления.
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recCode, setRecCode] = useState("");
  const [recNewPwd, setRecNewPwd] = useState("");
  const [recBusy, setRecBusy] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recDone, setRecDone] = useState(false);

  const submitRecovery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (recBusy) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !recCode.trim()) {
      setRecError("Введите email и код восстановления.");
      return;
    }
    if (recNewPwd.length < 8 || !(/[A-Za-z]/.test(recNewPwd) && /\d/.test(recNewPwd))) {
      setRecError("Новый пароль: минимум 8 символов, буквы и цифры.");
      return;
    }
    setRecBusy(true);
    setRecError(null);
    try {
      const res = await fetch(apiPath("api/auth/password-recovery/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          code: recCode.trim(),
          newPassword: recNewPwd,
        }),
      });
      if (res.ok) {
        setRecDone(true);
        setRecCode("");
        setRecNewPwd("");
        setPassword("");
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setRecError(d.error ?? "Не удалось сбросить пароль.");
      }
    } catch {
      setRecError("Сбой подключения.");
    } finally {
      setRecBusy(false);
    }
  };

  const exitRecovery = () => {
    setRecoveryMode(false);
    setRecError(null);
    setRecDone(false);
    setRecCode("");
    setRecNewPwd("");
  };

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

  const heading = recoveryMode
    ? "Восстановление пароля"
    : mode === "register"
      ? "Создание аккаунта"
      : "Вход в Eclipse Chat";
  const sub = recoveryMode
    ? "Введите email, код восстановления и новый пароль."
    : mode === "register"
      ? "Создайте аккаунт — займёт минуту."
      : "С возвращением. Войдите в свой аккаунт.";

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

        <div className="ec-hero-access__topline" aria-hidden>
          <span className="ec-hero-access__topline-status">
            <span />
            защищённый вход
          </span>
          <span className="ec-hero-access__topline-code">Eclipse Chat</span>
        </div>

        <div className="ec-hero-access__sigil" aria-hidden>
          <span className="ec-hero-access__sigil-core" />
          <span className="ec-hero-access__sigil-ring ec-hero-access__sigil-ring--one" />
          <span className="ec-hero-access__sigil-ring ec-hero-access__sigil-ring--two" />
        </div>

        <header className="ec-hero-access__head">
          <span className="ec-hero-access__eyebrow">
            <span className="ec-hero-access__eyebrow-dot" aria-hidden />
            {mode === "register" ? "Регистрация" : "Вход"}
          </span>
          <h2 className="ec-hero-access__title">{heading}</h2>
          <p className="ec-hero-access__sub">{sub}</p>
        </header>

        {!recoveryMode && (
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
        )}

        {/* Form (re-keyed на mode change → animation fires) */}
        {recoveryMode ? (
          recDone ? (
            <div className="ec-hero-access__form" data-mode="login">
              <div
                className="ec-hero-access__error"
                role="status"
                style={{ color: "var(--ec-presence-online)" }}
              >
                ✓ Пароль обновлён. Войдите с новым паролем.
              </div>
              <button type="button" className="ec-hero-access__submit" onClick={exitRecovery}>
                <span className="ec-hero-access__submit-label">К входу</span>
                <span className="ec-hero-access__submit-arrow" aria-hidden>
                  <ArrowIcon />
                </span>
              </button>
            </div>
          ) : (
            <form
              className="ec-hero-access__form"
              data-mode="login"
              onSubmit={submitRecovery}
              noValidate
            >
              <div className="ec-hero-access__field">
                <div className={`ec-hero-access__input-wrap ec-hero-access__input-wrap--icon${email ? " is-filled" : ""}`}>
                  <span className="ec-hero-access__field-icon" aria-hidden>
                    <MailIcon />
                  </span>
                  <input
                    id="hero-rec-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    required
                    disabled={recBusy}
                  />
                  <label htmlFor="hero-rec-email" className="ec-hero-access__floating-label">
                    Email
                  </label>
                </div>
              </div>
              <div className="ec-hero-access__field">
                <div className={`ec-hero-access__input-wrap ec-hero-access__input-wrap--icon${recCode ? " is-filled" : ""}`}>
                  <span className="ec-hero-access__field-icon" aria-hidden>
                    <LockIcon />
                  </span>
                  <input
                    id="hero-rec-code"
                    type="text"
                    value={recCode}
                    onChange={(event) => setRecCode(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="characters"
                    placeholder="XXXXX-XXXXX"
                    required
                    disabled={recBusy}
                  />
                  <label htmlFor="hero-rec-code" className="ec-hero-access__floating-label">
                    Код восстановления
                  </label>
                </div>
              </div>
              <div className="ec-hero-access__field">
                <div className={`ec-hero-access__input-wrap ec-hero-access__input-wrap--icon${recNewPwd ? " is-filled" : ""}`}>
                  <span className="ec-hero-access__field-icon" aria-hidden>
                    <LockIcon />
                  </span>
                  <input
                    id="hero-rec-pwd"
                    type="password"
                    value={recNewPwd}
                    onChange={(event) => setRecNewPwd(event.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={recBusy}
                  />
                  <label htmlFor="hero-rec-pwd" className="ec-hero-access__floating-label">
                    Новый пароль
                  </label>
                </div>
              </div>
              {recError && (
                <div className="ec-hero-access__error" role="alert">
                  {recError}
                </div>
              )}
              <button
                type="submit"
                className={`ec-hero-access__submit${recBusy ? " is-loading" : ""}`}
                disabled={recBusy}
              >
                <span className="ec-hero-access__submit-shimmer" aria-hidden />
                <span className="ec-hero-access__submit-label">
                  {recBusy ? "Сбрасываем…" : "Сбросить пароль"}
                </span>
                {!recBusy && (
                  <span className="ec-hero-access__submit-arrow" aria-hidden>
                    <ArrowIcon />
                  </span>
                )}
              </button>
              <p className="ec-hero-access__hint">
                <button type="button" className="ec-hero-access__hint-link" onClick={exitRecovery}>
                  ← Назад к входу
                </button>
              </p>
            </form>
          )
        ) : (
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
                {mode === "login" && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="ec-hero-access__hint-link"
                      onClick={() => {
                        setRecoveryMode(true);
                        setRecError(null);
                        setRecDone(false);
                      }}
                    >
                      Восстановить пароль
                    </button>
                  </>
                )}
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
                  {mode === "register" ? "Аккаунт создан" : "Вы вошли"}
                </span>
              ) : (
                <>
                  <span className="ec-hero-access__submit-label">
                    {loading
                      ? mode === "register"
                        ? "Создаём аккаунт…"
                        : "Входим…"
                      : mode === "register"
                        ? "Создать аккаунт"
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
                  Уже есть аккаунт?{" "}
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
                  Нет аккаунта?{" "}
                  <button
                    type="button"
                    className="ec-hero-access__hint-link"
                    onClick={() => onOpenAuth("register")}
                  >
                    Создать
                  </button>
                  {" · "}
                  <button
                    type="button"
                    className="ec-hero-access__hint-link"
                    onClick={() => {
                      setRecoveryMode(true);
                      setRecError(null);
                      setRecDone(false);
                    }}
                  >
                    Забыли пароль?
                  </button>
                </>
              )}
            </p>
        </form>
        )}

        <footer className="ec-hero-access__footer">
          <span className="ec-hero-access__footer-mark">
            <span className="ec-hero-access__footer-dot" aria-hidden />
            Защищённое соединение
          </span>
        </footer>
      </Reveal>
    </div>
  );
}

/**
 * v1.5.0 — MemoryConstellation animated.
 * - SVG connection lines от центра к каждой node (6 paths)
 * - Animated data pulses вдоль lines (small cyan dots travel)
 * - Continuous orbit rotation
 * - Pulsing core с inner signal dot
 * - Node hover lift (CSS)
 */
const MEMORY_NODE_POSITIONS = [
  { label: "Решения", x: 18, y: 22, className: "ec-memory-map__node--one" },
  { label: "Документы", x: 82, y: 18, className: "ec-memory-map__node--two" },
  { label: "Задачи", x: 12, y: 58, className: "ec-memory-map__node--three" },
  { label: "Обсуждения", x: 86, y: 62, className: "ec-memory-map__node--four" },
  { label: "Файлы", x: 32, y: 86, className: "ec-memory-map__node--five" },
  { label: "Участники", x: 64, y: 88, className: "ec-memory-map__node--six" },
] as const;

export function MemoryConstellation() {
  return (
    <div className="ec-memory-map" aria-label="AI Memory — карта контекста">
      {/* Connection lines SVG (% based coordinates) */}
      <svg
        className="ec-memory-map__links"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="ec-memory-link-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(154, 216, 239, 0.05)" />
            <stop offset="50%" stopColor="rgba(154, 216, 239, 0.45)" />
            <stop offset="100%" stopColor="rgba(154, 216, 239, 0.05)" />
          </linearGradient>
          <filter id="ec-memory-pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {MEMORY_NODE_POSITIONS.map((node, index) => (
          <g key={`link-${node.label}`}>
            <line
              x1="50"
              y1="50"
              x2={node.x}
              y2={node.y}
              stroke="url(#ec-memory-link-grad)"
              strokeWidth="0.18"
              className="ec-memory-map__link"
            />
            <circle
              r="0.7"
              fill="rgba(154, 216, 239, 0.95)"
              filter="url(#ec-memory-pulse-glow)"
              className="ec-memory-map__pulse"
            >
              <animateMotion
                dur={`${3 + index * 0.5}s`}
                repeatCount="indefinite"
                begin={`${index * 0.4}s`}
                keyTimes="0;1"
                keySplines="0.4 0 0.6 1"
                calcMode="spline"
                path={`M ${node.x} ${node.y} L 50 50`}
              />
            </circle>
          </g>
        ))}
      </svg>

      <div className="ec-memory-map__orbit ec-memory-map__orbit--two" aria-hidden />
      <div className="ec-memory-map__orbit ec-memory-map__orbit--one" aria-hidden />

      <Reveal className="ec-memory-map__core" variant="panel">
        <span className="ec-memory-map__core-pulse" aria-hidden />
        <span className="ec-memory-map__core-shell" aria-hidden>AI</span>
        <strong>Memory</strong>
        <span className="ec-memory-map__core-meta">persistent context</span>
      </Reveal>

      {MEMORY_NODE_POSITIONS.map((node, index) => (
        <Reveal
          key={node.label}
          className={`ec-memory-map__node ${node.className}`}
          variant="panel"
          delay={index * 80}
        >
          <span className="ec-memory-map__node-dot" aria-hidden />
          {node.label}
        </Reveal>
      ))}
    </div>
  );
}

/**
 * v1.5.0 — SecurityStackArt enriched.
 * - Cube continuous slow rotation (40s loop, subtle)
 * - Inner cube layers pulse opacity
 * - Cyber grid backdrop pattern
 * - Lock badge с shield rings (radiating)
 */
function ShieldIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden>
      <path
        d="M10 1.5L17 4.5V10.5C17 15.5 13.5 19 10 20.5C6.5 19 3 15.5 3 10.5V4.5L10 1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="rgba(93, 181, 217, 0.12)"
        strokeLinejoin="round"
      />
      <path
        d="M7 11l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SecurityStackArt() {
  return (
    <div className="ec-security-stack" aria-label="Архитектура безопасности">
      <div className="ec-security-stack__grid" aria-hidden />
      <div className="ec-security-stack__cube" aria-hidden>
        <span className="ec-security-stack__cube-face ec-security-stack__cube-face--1" />
        <span className="ec-security-stack__cube-face ec-security-stack__cube-face--2" />
        <span className="ec-security-stack__cube-face ec-security-stack__cube-face--3" />
        <span className="ec-security-stack__cube-shield">
          <ShieldIcon />
        </span>
      </div>
      <div className="ec-security-stack__rings" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
