import { useEffect, useRef, useState } from "react";
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
 * Экран входа. Функциональная форма без декоративного «киберпанк»-слоя:
 *   - Floating labels (label shrinks + slides up при focus/filled)
 *   - Field icons (UserIcon / MailIcon / LockIcon) внутри inputs
 *   - Tab switch slide transition при login↔register
 *   - Submit success state с checkmark
 *
 * v1.7.7 — снят декор входа (правило «не заставляй думать»,
 * [[project_eclipse_chat_denoise_direction]]): убраны electric-border,
 * sigil-бейдж, corner-brackets, topline-статус и password scanner-beam
 * (последний ещё и задерживал показ пароля на 600ms — теперь мгновенно).
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
  const [success, setSuccess] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [localAuthError, setLocalAuthError] = useState<string | null>(null);
  const phantomRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const phantomFrameRef = useRef<number | null>(null);
  const phantomTargetRef = useRef({ x: 0, y: 0 });
  // v1.6.68 — self-serve сброс пароля по коду восстановления.
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recCode, setRecCode] = useState("");
  const [recNewPwd, setRecNewPwd] = useState("");
  const [recBusy, setRecBusy] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recDone, setRecDone] = useState(false);

  const fieldsReady = Boolean(
    email.trim() &&
    password &&
    (mode === "login" || displayName.trim()),
  );

  useEffect(() => () => {
    if (phantomFrameRef.current != null) {
      window.cancelAnimationFrame(phantomFrameRef.current);
    }
  }, []);

  useEffect(() => {
    setLocalAuthError(null);
    submitButtonRef.current?.style.removeProperty("--ec-auth-evade-x");
    submitButtonRef.current?.style.removeProperty("--ec-auth-evade-y");
  }, [mode]);

  if (authMode == null) {
    return <HeroWorkspacePreview />;
  }

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
    setShowPassword((v) => !v);
  };

  const motionAllowed = (pointerType: string) => (
    pointerType === "mouse" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const resetPhantom = () => {
    phantomTargetRef.current = { x: 0, y: 0 };
    const phantom = phantomRef.current;
    if (!phantom) return;
    phantom.style.setProperty("--ec-phantom-x", "0px");
    phantom.style.setProperty("--ec-phantom-y", "0px");
    phantom.style.setProperty("--ec-phantom-tilt", "0deg");
    phantom.style.setProperty("--ec-phantom-eye-x", "0px");
    phantom.style.setProperty("--ec-phantom-eye-y", "0px");
  };

  const trackPhantom = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!motionAllowed(event.pointerType)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    phantomTargetRef.current = {
      x: Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)),
      y: Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)),
    };
    if (phantomFrameRef.current != null) return;
    phantomFrameRef.current = window.requestAnimationFrame(() => {
      phantomFrameRef.current = null;
      const phantom = phantomRef.current;
      if (!phantom) return;
      const { x, y } = phantomTargetRef.current;
      phantom.style.setProperty("--ec-phantom-x", `${(x * 5).toFixed(2)}px`);
      phantom.style.setProperty("--ec-phantom-y", `${(y * 4).toFixed(2)}px`);
      phantom.style.setProperty("--ec-phantom-tilt", `${(x * 2).toFixed(2)}deg`);
      phantom.style.setProperty("--ec-phantom-eye-x", `${(x * 2.6).toFixed(2)}px`);
      phantom.style.setProperty("--ec-phantom-eye-y", `${(y * 2.2).toFixed(2)}px`);
    });
  };

  const resetSubmitEscape = () => {
    submitButtonRef.current?.style.setProperty("--ec-auth-evade-x", "0px");
    submitButtonRef.current?.style.setProperty("--ec-auth-evade-y", "0px");
  };

  const evadeSubmit = (event: React.PointerEvent<HTMLDivElement>) => {
    if (fieldsReady || loading || success || !motionAllowed(event.pointerType)) {
      resetSubmitEscape();
      return;
    }
    const button = submitButtonRef.current;
    if (!button) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const xRatio = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
    const yRatio = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
    const x = Math.max(-24, Math.min(24, (0.5 - xRatio) * 58));
    const y = Math.max(-8, Math.min(8, (0.5 - yRatio) * 22));
    button.style.setProperty("--ec-auth-evade-x", `${x.toFixed(1)}px`);
    button.style.setProperty("--ec-auth-evade-y", `${y.toFixed(1)}px`);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    if (!fieldsReady) {
      setLocalAuthError(
        mode === "register"
          ? "Фантом ждёт: заполните имя, email и пароль."
          : "Фантом ждёт: заполните email и пароль.",
      );
      resetSubmitEscape();
      return;
    }
    setLocalAuthError(null);
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
    <div
      ref={phantomRef}
      className="ec-hero-access"
      aria-label="Доступ к Eclipse Chat"
      onPointerMove={trackPhantom}
      onPointerLeave={resetPhantom}
    >
      <Reveal className="ec-hero-access__frame" variant="panel">
        <div className="ec-hero-access__glow" aria-hidden />
        <div className="ec-hero-access__scan" aria-hidden>
          <span className="ec-hero-access__scan-ring" />
          <i className="ec-hero-access__scan-beam" />
        </div>
        <CursorPhantom hidingEyes={passwordFocused} />

        <header className="ec-hero-access__head">
          <div className="ec-hero-access__kicker-row">
            <span className="ec-hero-access__eyebrow">
              <span className="ec-hero-access__eyebrow-dot" aria-hidden />
              {mode === "register" ? "Регистрация" : "Вход"}
            </span>
            <span className="ec-hero-access__session">
              <span aria-hidden />
              Secure session
            </span>
          </div>
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
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      setLocalAuthError(null);
                    }}
                    autoComplete="name"
                    required
                    aria-invalid={Boolean(localAuthError && !displayName.trim())}
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
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setLocalAuthError(null);
                  }}
                  autoComplete="email"
                  required
                  aria-invalid={Boolean(localAuthError && !email.trim())}
                  disabled={loading}
                />
                <label htmlFor="hero-access-email" className="ec-hero-access__floating-label">
                  Email
                </label>
              </div>
            </div>

            <div className="ec-hero-access__field">
              <div
                className={`ec-hero-access__input-wrap ec-hero-access__input-wrap--icon ec-hero-access__input-wrap--password${password ? " is-filled" : ""}`}
              >
                <span className="ec-hero-access__field-icon" aria-hidden>
                  <LockIcon />
                </span>
                <input
                  id="hero-access-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setLocalAuthError(null);
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  aria-invalid={Boolean(localAuthError && !password)}
                  disabled={loading}
                />
                <label htmlFor="hero-access-password" className="ec-hero-access__floating-label">
                  Пароль
                </label>
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

            {(localAuthError || authError) && (
              <div id="hero-access-error" className="ec-hero-access__error" role="alert">
                {localAuthError || authError}
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

            <div
              className={`ec-hero-access__submit-zone${fieldsReady ? " is-ready" : " is-evasive"}`}
              onPointerMove={evadeSubmit}
              onPointerLeave={resetSubmitEscape}
            >
              <button
                ref={submitButtonRef}
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
            </div>

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
          <span className="ec-hero-access__footer-meta">TLS 1.3 · 2FA ready</span>
        </footer>
      </Reveal>
    </div>
  );
}

function CursorPhantom({ hidingEyes }: { hidingEyes: boolean }) {
  return (
    <div
      className={`ec-auth-phantom${hidingEyes ? " is-hiding-eyes" : ""}`}
      aria-hidden
    >
      <span className="ec-auth-phantom__orbit" />
      <svg viewBox="0 0 68 78" role="presentation">
        <path
          className="ec-auth-phantom__body"
          d="M12 62V32C12 18.2 21.4 9 34 9s22 9.2 22 23v30l-7-5.5-7.2 6-7.8-6-7.8 6-7.2-6L12 62Z"
        />
        <g className="ec-auth-phantom__eyes-open">
          <ellipse cx="27" cy="33" rx="4.7" ry="6.4" />
          <ellipse cx="43" cy="33" rx="4.7" ry="6.4" />
          <circle className="ec-auth-phantom__pupil" cx="27" cy="34" r="2" />
          <circle className="ec-auth-phantom__pupil" cx="43" cy="34" r="2" />
        </g>
        <g className="ec-auth-phantom__eyes-closed">
          <path d="M22 34c2.4 2.1 6.2 2.1 8.6 0" />
          <path d="M38.5 34c2.4 2.1 6.2 2.1 8.6 0" />
        </g>
        <path className="ec-auth-phantom__mouth" d="M31 47c1.8-1.4 4.2-1.4 6 0" />
      </svg>
    </div>
  );
}

function HeroWorkspacePreview() {
  return (
    <div
      className="ec-hero-workspace"
      role="img"
      aria-label="Рабочее пространство Eclipse Chat с каналами, сообщениями, задачей релиза и AI-памятью"
    >
      <div className="ec-hero-workspace__orbit" aria-hidden>
        <span />
      </div>

      <header className="ec-hero-workspace__topbar">
        <div className="ec-hero-workspace__brand">
          <span className="ec-hero-workspace__mark" aria-hidden />
          <strong>ECLIPSE CHAT</strong>
        </div>
        <div className="ec-hero-workspace__state">
          <i aria-hidden />
          WORKSPACE ONLINE
        </div>
      </header>

      <div className="ec-hero-workspace__body">
        <aside className="ec-hero-workspace__nav" aria-hidden>
          <b>E</b>
          <span>#</span>
          <span>@</span>
          <span>✓</span>
        </aside>

        <aside className="ec-hero-workspace__sidebar">
          <small>PRODUCT CORE</small>
          <strong>Команда</strong>
          <div className="ec-hero-workspace__channel"># общий</div>
          <div className="ec-hero-workspace__channel is-active"># release-room <b>3</b></div>
          <div className="ec-hero-workspace__channel"># design-review</div>
          <div className="ec-hero-workspace__voice">
            <span>VOICE ROOM</span>
            <strong>Design sync · 3</strong>
          </div>
        </aside>

        <section className="ec-hero-workspace__chat">
          <header>
            <div><span>#</span><strong>release-room</strong></div>
            <small>Фокус: production readiness</small>
          </header>
          <div className="ec-hero-workspace__feed">
            <article>
              <span className="ec-hero-workspace__avatar">П</span>
              <div>
                <b>Павел <time>10:42</time></b>
                <p>Проверь mobile и подготовь релиз.</p>
              </div>
            </article>
            <article className="is-agent">
              <span className="ec-hero-workspace__avatar">AI</span>
              <div>
                <b>Eclipse Operator <time>10:43</time></b>
                <p>18 проверок пройдены. Нужен финальный approval.</p>
                <div className="ec-hero-workspace__approval">
                  <span>RELEASE GATE</span>
                  <strong>Готово к подтверждению</strong>
                  <div><i /> Build <i /> Mobile <i /> Security</div>
                </div>
              </div>
            </article>
          </div>
          <div className="ec-hero-workspace__composer">Сообщение в #release-room <span>↵</span></div>
        </section>

        <aside className="ec-hero-workspace__context">
          <small>AI MEMORY</small>
          <strong>Контекст команды</strong>
          <div><b>12</b><span>решений</span></div>
          <div><b>7</b><span>задач</span></div>
          <p>Синхронизировано 1 мин назад</p>
        </aside>
      </div>

      <footer className="ec-hero-workspace__footer">
        <span>SELF-HOSTED</span>
        <span>REAL-TIME</span>
        <strong>ALL SYSTEMS NOMINAL</strong>
      </footer>
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
              cx={node.x}
              cy={node.y}
              r="0.7"
              fill="rgba(154, 216, 239, 0.95)"
              filter="url(#ec-memory-pulse-glow)"
              className="ec-memory-map__pulse"
              style={{ animationDelay: `${340 + index * 60}ms` }}
            />
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
