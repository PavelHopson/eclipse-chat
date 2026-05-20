/**
 * v1.1.14 — cinematic multi-step AuthScreen (из eclipse-os-v1 mockup'а).
 *
 * Flow:
 *   credentials → (if 2FA enabled) twofa → success → redirect to app
 *
 * Преобразован из старого single-page AuthPage (board layout с hero +
 * features + login panel) в HUD-style полно-экранный AuthScreen с
 * tactical corners, top/bottom status bars, central clipped terminal
 * box, eclipse logo + ECLIPSE title с shimmer, и кибер-стилизованные
 * step content (lock/shield icons + monospace labels + 6-pin keypad).
 *
 * Реальная auth API (onLogin/onRegister) сохранена без изменений —
 * только UX поверх.
 */

import { useEffect, useState } from "react";

type Props = {
  error: string | null;
  onLogin: (
    email: string,
    password: string,
    opts?: { totpCode?: string; recoveryCode?: string },
  ) => Promise<{ success: boolean; needs2FA?: boolean }>;
  onRegister: (email: string, password: string, displayName: string) => Promise<boolean>;
};

type Step = "credentials" | "twofa" | "success";
type Mode = "login" | "register";

const VERSION = "1.0.0.99";

export function AuthPage({ error, onLogin, onRegister }: Props) {
  const [step, setStep] = useState<Step>("credentials");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState("SYS.INIT");

  // Fake telemetry feed для top HUD — каждую секунду меняется.
  useEffect(() => {
    const tick = () => {
      const pos = `${Math.floor(Math.random() * 90)}.${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
      const sync = Math.floor(Math.random() * 100);
      const tt = Math.floor(Math.random() * 9999);
      setTelemetry(`POS: ${pos} N | СИНХР: ${sync}% | T-${tt}`);
    };
    tick();
    const id = window.setInterval(tick, 1200);
    return () => window.clearInterval(id);
  }, []);

  // Если parent передал error (server-side) — показываем его.
  useEffect(() => {
    if (error) setLocalError(error);
  }, [error]);

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (mode === "login") {
        const res = await onLogin(email, password);
        if (res.success) {
          setStep("success");
        } else if (res.needs2FA) {
          setStep("twofa");
          setPin("");
        }
      } else {
        const ok = await onRegister(email, password, displayName);
        if (ok) setStep("success");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Сбой подключения");
    } finally {
      setBusy(false);
    }
  };

  const submitTotp = async (code: string) => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await onLogin(email, password, { totpCode: code });
      if (res.success) {
        setStep("success");
      } else {
        setLocalError("Неверный код. Попробуйте снова.");
        setPin("");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Сбой проверки 2FA");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !recoveryCode.trim()) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await onLogin(email, password, {
        recoveryCode: recoveryCode.trim(),
      });
      if (res.success) {
        setStep("success");
      } else {
        setLocalError("Неверный recovery-код.");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Сбой проверки");
    } finally {
      setBusy(false);
    }
  };

  const onKeyPress = (digit: string) => {
    if (busy || pin.length >= 6) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 6) {
      void submitTotp(next);
    }
  };

  const onKeyBackspace = () => {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
  };

  const onKeyCancel = () => {
    setStep("credentials");
    setPin("");
    setUseRecovery(false);
    setRecoveryCode("");
    setLocalError(null);
  };

  return (
    <main className="ec-auth-shell" aria-label="Eclipse Chat — вход">
      <div className="ec-auth-radar" aria-hidden>
        <div className="ec-auth-radar__grid" />
        <div className="ec-auth-radar__crosshair-h" />
        <div className="ec-auth-radar__crosshair-v" />
      </div>

      {/* Viewport tactical corners */}
      <span className="ec-auth-corner ec-auth-corner--tl" aria-hidden />
      <span className="ec-auth-corner ec-auth-corner--tr" aria-hidden />
      <span className="ec-auth-corner ec-auth-corner--bl" aria-hidden />
      <span className="ec-auth-corner ec-auth-corner--br" aria-hidden />

      {/* Top status HUD */}
      <div className="ec-auth-top-hud" aria-hidden>
        <div className="ec-auth-top-hud__row">
          <span>СЕТЬ ECLIPSE</span>
          <span>{telemetry}</span>
        </div>
        <div className="ec-auth-top-hud__line" />
      </div>

      {/* Center stack */}
      <div className="ec-auth-stack">
        <div className="ec-auth-logo" aria-hidden />
        <h1 className="ec-auth-title">ECLIPSE</h1>
        <div className="ec-auth-subtitle">ПРОТОКОЛ_ШЛЮЗА_V1.0</div>

        <div className="ec-auth-terminal-frame">
        <section className="ec-auth-terminal" aria-live="polite">
          <span className="ec-auth-terminal__accent-tl" aria-hidden />
          <span className="ec-auth-terminal__accent-br" aria-hidden />

          {step === "credentials" && (
            <>
              <header className="ec-auth-step-head">
                <span className="ec-auth-step-head__icon" aria-hidden>
                  <LockIcon />
                </span>
                <span className="ec-auth-step-head__label">
                  {mode === "login" ? "АУТЕНТИФИКАЦИЯ" : "РЕГИСТРАЦИЯ"}
                </span>
              </header>

              <div className="ec-auth-mode-toggle" role="tablist" aria-label="Режим">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  onClick={() => setMode("login")}
                >
                  Вход
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  onClick={() => setMode("register")}
                >
                  Регистрация
                </button>
              </div>

              <form onSubmit={submitCredentials}>
                {mode === "register" && (
                  <div className="ec-auth-field">
                    <label className="ec-auth-field__label">Имя оператора</label>
                    <input
                      className="ec-auth-field__input"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Как вас называть"
                      maxLength={64}
                      required
                      autoComplete="nickname"
                    />
                  </div>
                )}
                <div className="ec-auth-field">
                  <label className="ec-auth-field__label">Личность оператора</label>
                  <input
                    className="ec-auth-field__input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="ec-auth-field ec-auth-field--violet">
                  <label className="ec-auth-field__label">
                    Секретный код {mode === "register" && "(8+)"}
                  </label>
                  <PasswordReveal
                    value={password}
                    onChange={setPassword}
                    minLength={8}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </div>
                <button
                  type="submit"
                  className="ec-auth-submit-btn"
                  disabled={busy}
                >
                  {busy ? "ПОДКЛЮЧЕНИЕ…" : "ПРОДОЛЖИТЬ"}
                  <ArrowIcon />
                </button>
              </form>

              {localError && <p className="ec-auth-err" role="alert">{localError}</p>}
            </>
          )}

          {step === "twofa" && !useRecovery && (
            <>
              <header className="ec-auth-step-head">
                <span className="ec-auth-step-head__icon ec-auth-step-head__icon--violet" aria-hidden>
                  <ShieldIcon />
                </span>
                <span className="ec-auth-step-head__label">ПРОВЕРКА 2FA</span>
              </header>

              <div className="ec-auth-pins" role="group" aria-label="Код 2FA">
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const filled = pin.length > i;
                  const active = pin.length === i && !busy;
                  return (
                    <div
                      key={i}
                      className={
                        "ec-auth-pin" +
                        (filled ? " ec-auth-pin--filled" : "") +
                        (active ? " ec-auth-pin--active" : "")
                      }
                    >
                      {filled ? "*" : ""}
                    </div>
                  );
                })}
              </div>

              <div className="ec-auth-keypad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="ec-auth-keypad__key"
                    onClick={() => onKeyPress(String(n))}
                    disabled={busy}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className="ec-auth-keypad__key ec-auth-keypad__key--ghost"
                  onClick={onKeyCancel}
                  disabled={busy}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="ec-auth-keypad__key"
                  onClick={() => onKeyPress("0")}
                  disabled={busy}
                >
                  0
                </button>
                <button
                  type="button"
                  className="ec-auth-keypad__key ec-auth-keypad__key--ghost"
                  onClick={onKeyBackspace}
                  disabled={busy || pin.length === 0}
                  aria-label="Удалить последнюю цифру"
                >
                  ⌫
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUseRecovery(true);
                  setLocalError(null);
                }}
                className="ec-auth-submit-btn"
                style={{
                  background: "transparent",
                  border: "1px solid hsl(210 18% 18%)",
                  fontSize: "0.6rem",
                  marginTop: 16,
                }}
                disabled={busy}
              >
                <span>RECOVERY-КОД</span>
              </button>

              {localError && <p className="ec-auth-err" role="alert">{localError}</p>}
            </>
          )}

          {step === "twofa" && useRecovery && (
            <>
              <header className="ec-auth-step-head">
                <span className="ec-auth-step-head__icon ec-auth-step-head__icon--violet" aria-hidden>
                  <ShieldIcon />
                </span>
                <span className="ec-auth-step-head__label">RECOVERY-КОД</span>
              </header>

              <form onSubmit={submitRecovery}>
                <div className="ec-auth-field ec-auth-field--violet">
                  <label className="ec-auth-field__label">Резервный код (XXXXX-XXXXX)</label>
                  <input
                    className="ec-auth-field__input"
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    placeholder="ABCDE-12345"
                    maxLength={11}
                    required
                    autoFocus
                    style={{ textAlign: "center", letterSpacing: "0.3em" }}
                  />
                </div>
                <button
                  type="submit"
                  className="ec-auth-submit-btn"
                  disabled={busy || !recoveryCode.trim()}
                >
                  {busy ? "ПРОВЕРКА…" : "РАЗБЛОКИРОВАТЬ"}
                  <ArrowIcon />
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setUseRecovery(false);
                  setRecoveryCode("");
                  setLocalError(null);
                }}
                className="ec-auth-submit-btn"
                style={{
                  background: "transparent",
                  border: "1px solid hsl(210 18% 18%)",
                  fontSize: "0.6rem",
                  marginTop: 8,
                }}
                disabled={busy}
              >
                <span>← КЛАВИАТУРА 2FA</span>
              </button>

              {localError && <p className="ec-auth-err" role="alert">{localError}</p>}
            </>
          )}

          {step === "success" && (
            <div className="ec-auth-success" aria-live="polite">
              <div className="ec-auth-success__ring" aria-hidden>
                <UnlockIcon />
              </div>
              <div className="ec-auth-success__label">ДОСТУП РАЗРЕШЁН</div>
            </div>
          )}
        </section>
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="ec-auth-bottom-hud" aria-hidden>
        <span className="ec-auth-bottom-hud__status">
          <span className="ec-auth-bottom-hud__dot" />
          ЗАЩИЩЁННАЯ СВЯЗЬ АКТИВНА
        </span>
        <span>ВЕРСИЯ {VERSION}</span>
      </div>
    </main>
  );
}

/**
 * PasswordReveal — поле пароля с eye-toggle (эффект из набора
 * «Animated Password Field», упрощённая адаптация). Вместо хрупкого
 * fakepass-оверлея — показ/скрытие через input.type + cyan scan-sweep
 * по полю при каждом переключении. Респектит prefers-reduced-motion.
 */
function PasswordReveal({
  value,
  onChange,
  minLength,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
  autoComplete: string;
}) {
  const [shown, setShown] = useState(false);
  const [scanId, setScanId] = useState(0);
  const [scanning, setScanning] = useState(false);

  const toggle = () => {
    if (!value) return;
    setShown((s) => !s);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setScanId((n) => n + 1);
    setScanning(true);
    window.setTimeout(() => setScanning(false), 760);
  };

  return (
    <div className="ec-auth-pass">
      <input
        className="ec-auth-field__input ec-auth-pass__input"
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        minLength={minLength}
        required
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className={"ec-auth-pass__reveal" + (shown ? " ec-auth-pass__reveal--on" : "")}
        onClick={toggle}
        disabled={!value}
        aria-pressed={shown}
        aria-label={shown ? "Скрыть код" : "Показать код"}
        title={value ? (shown ? "Скрыть код" : "Показать код") : "Введите код"}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
          <line className="ec-auth-pass__slash" x1="3.4" y1="3.4" x2="20.6" y2="20.6" />
        </svg>
      </button>
      {scanning && <span key={scanId} className="ec-auth-pass__scanline" aria-hidden />}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
