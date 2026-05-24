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
 * v1.3.6 — premium custom auth form per Pavel verdict (24.05.2026):
 *   «Надо переделать дизайн, сделай полностью переосмысление, чтобы было
 *   в нашей цветовой палитре и градиенте, нужен максимально современный
 *   дизайн и анимации, премиум уровня».
 *
 *   Previous v1.3.5: использовали AuthPage embedded — он рендерил own
 *   heading «ВХОД В СИСТЕМУ», status chips, internal Вход/Регистрация
 *   tabs, violet/purple gradient button → дубль с outer frame + не cyan.
 *
 *   v1.3.6: AuthPage embedded полностью убран из landing. Custom inline
 *   form в hero stage:
 *     - Cyan gradient palette (наша palette)
 *     - Animated sliding tab indicator (cubic-bezier)
 *     - Premium inputs (48px, dark, cyan focus ring + glow)
 *     - Gradient submit button с loading spinner
 *     - Error fade-in
 *     - Frame mount animation (fade + slide-up + scale)
 *     - Password show/hide toggle
 *     - Register mode: добавляется поле Имя
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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "register") {
        if (onRegister) await onRegister(email, password, displayName.trim() || "User");
      } else {
        if (onLogin) await onLogin(email, password);
      }
    } finally {
      setLoading(false);
    }
  };

  const heading = mode === "register" ? "Активация контура" : "Доступ к контуру";
  const sub =
    mode === "register"
      ? "Создайте рабочую среду для команды."
      : "Войдите в свой рабочий контур.";

  return (
    <div className="ec-hero-access" aria-label="Доступ к Eclipse Chat">
      <Reveal className="ec-hero-access__frame" variant="panel">
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

        <form className="ec-hero-access__form" onSubmit={submit} noValidate>
          {mode === "register" && (
            <div className="ec-hero-access__field">
              <label htmlFor="hero-access-name">Имя</label>
              <div className="ec-hero-access__input-wrap">
                <input
                  id="hero-access-name"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Как вас зовут"
                  autoComplete="name"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="ec-hero-access__field">
            <label htmlFor="hero-access-email">Email</label>
            <div className="ec-hero-access__input-wrap">
              <input
                id="hero-access-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="ec-hero-access__field">
            <label htmlFor="hero-access-password">Пароль</label>
            <div className="ec-hero-access__input-wrap">
              <input
                id="hero-access-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="ec-hero-access__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                tabIndex={-1}
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
            className={`ec-hero-access__submit${loading ? " is-loading" : ""}`}
            disabled={loading}
          >
            <span className="ec-hero-access__submit-shimmer" aria-hidden />
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
