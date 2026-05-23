import { useEffect, useRef, useState } from "react";
import { EclipseGalaxy } from "../components/EclipseGalaxy";

type Props = {
  error: string | null;
  onLogin: (
    email: string,
    password: string,
    opts?: { totpCode?: string; recoveryCode?: string },
  ) => Promise<{ success: boolean; needs2FA?: boolean; error?: string }>;
  onRegister: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ success: boolean; error?: string }>;
};

type Step = "credentials" | "twofa" | "success";
type Mode = "login" | "register";
type EntryState = "gate" | "opening" | "panel";

const VERSION = "1.2.10";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function validateCredentialsForm(args: {
  mode: Mode;
  email: string;
  password: string;
  displayName: string;
}): string | null {
  const email = normalizeEmail(args.email);
  const displayName = normalizeDisplayName(args.displayName);

  if (!email) return "Введите email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Проверьте email.";
  if (!args.password) return "Введите пароль.";

  if (args.mode === "register") {
    if (!displayName) return "Введите имя.";
    if (args.password.length < 8) return "Пароль должен быть не короче 8 символов.";
    if (!/[A-Za-z]/.test(args.password) || !/\d/.test(args.password)) {
      return "Пароль должен содержать буквы и цифры.";
    }
  }

  return null;
}

export function AuthPage({ error, onLogin, onRegister }: Props) {
  const brandMarkUrl = `${import.meta.env.BASE_URL}brand-mark.png`;
  const [step, setStep] = useState<Step>("credentials");
  const [mode, setMode] = useState<Mode>("login");
  const [entryState, setEntryState] = useState<EntryState>("gate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState("SYS.INIT");
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const entryTimerRef = useRef<number | null>(null);
  const emailFieldRef = useRef<HTMLInputElement | null>(null);
  const displayNameFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const pos = `${Math.floor(Math.random() * 90)}.${String(
        Math.floor(Math.random() * 1000),
      ).padStart(3, "0")}`;
      const sync = Math.floor(Math.random() * 100);
      const tt = Math.floor(Math.random() * 9999);
      setTelemetry(`POS: ${pos} N | СИНХР: ${sync}% | T-${tt}`);
    };

    tick();
    const id = window.setInterval(tick, 1200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (error) setLocalError(error);
  }, [error]);

  useEffect(() => {
    return () => {
      if (entryTimerRef.current !== null) {
        window.clearTimeout(entryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (step !== "credentials" && entryState !== "panel") {
      if (entryTimerRef.current !== null) {
        window.clearTimeout(entryTimerRef.current);
        entryTimerRef.current = null;
      }
      setEntryState("panel");
    }
  }, [entryState, step]);

  const setSceneDepth = (
    tiltX: number,
    tiltY: number,
    glowX: number,
    glowY: number,
    active: boolean,
  ) => {
    const node = sceneRef.current;
    if (!node) return;
    node.style.setProperty("--ec-auth-tilt-x", `${tiltX.toFixed(2)}deg`);
    node.style.setProperty("--ec-auth-tilt-y", `${tiltY.toFixed(2)}deg`);
    node.style.setProperty("--ec-auth-glow-x", `${glowX.toFixed(2)}%`);
    node.style.setProperty("--ec-auth-glow-y", `${glowY.toFixed(2)}%`);
    node.dataset.depth = active ? "active" : "idle";
  };

  const onSceneMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (prefersReducedMotion()) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const px = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const py = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

    setSceneDepth((0.5 - py) * 7, (px - 0.5) * 9, px * 100, py * 100, true);
  };

  const onSceneLeave = () => {
    setSceneDepth(0, 0, 50, 34, false);
  };

  const focusPrimaryField = () => {
    window.setTimeout(() => {
      const target = mode === "register" ? displayNameFieldRef.current : emailFieldRef.current;
      target?.focus();
    }, prefersReducedMotion() ? 0 : 240);
  };

  const openAuthGate = () => {
    if (busy || step !== "credentials" || entryState !== "gate") return;
    setLocalError(null);

    if (prefersReducedMotion()) {
      setEntryState("panel");
      focusPrimaryField();
      return;
    }

    setEntryState("opening");
    if (entryTimerRef.current !== null) {
      window.clearTimeout(entryTimerRef.current);
    }
    entryTimerRef.current = window.setTimeout(() => {
      entryTimerRef.current = null;
      setEntryState("panel");
      focusPrimaryField();
    }, 920);
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setStep("credentials");
    setLocalError(null);
    setPin("");
    setUseRecovery(false);
    setRecoveryCode("");
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const cleanEmail = normalizeEmail(email);
    const cleanDisplayName = normalizeDisplayName(displayName);
    const validationError = validateCredentialsForm({
      mode,
      email: cleanEmail,
      password,
      displayName: cleanDisplayName,
    });

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setBusy(true);
    setLocalError(null);
    setEmail(cleanEmail);
    if (mode === "register") setDisplayName(cleanDisplayName);

    try {
      if (mode === "login") {
        const res = await onLogin(cleanEmail, password);
        if (res.success) {
          setStep("success");
        } else if (res.needs2FA) {
          setStep("twofa");
          setPin("");
        } else {
          setLocalError(res.error ?? "Не удалось войти. Проверьте данные.");
        }
      } else {
        const res = await onRegister(cleanEmail, password, cleanDisplayName);
        if (res.success) {
          setStep("success");
        } else {
          setLocalError(res.error ?? "Не удалось создать аккаунт.");
        }
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
      const res = await onLogin(normalizeEmail(email), password, {
        totpCode: code,
      });
      if (res.success) {
        setStep("success");
      } else {
        setLocalError(res.error ?? "Неверный код. Попробуйте снова.");
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
      const res = await onLogin(normalizeEmail(email), password, {
        recoveryCode: recoveryCode.trim(),
      });
      if (res.success) {
        setStep("success");
      } else {
        setLocalError(res.error ?? "Неверный резервный код.");
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
    if (next.length === 6) void submitTotp(next);
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
      <EclipseGalaxy variant="auth" />

      <span className="ec-auth-corner ec-auth-corner--tl" aria-hidden />
      <span className="ec-auth-corner ec-auth-corner--tr" aria-hidden />
      <span className="ec-auth-corner ec-auth-corner--bl" aria-hidden />
      <span className="ec-auth-corner ec-auth-corner--br" aria-hidden />

      <div className="ec-auth-top-hud" aria-hidden>
        <div className="ec-auth-top-hud__row">
          <span>СЕТЬ ECLIPSE</span>
          <span>{telemetry}</span>
        </div>
        <div className="ec-auth-top-hud__line" />
      </div>

      <div
        ref={sceneRef}
        className="ec-auth-scene"
        data-depth="idle"
        onPointerMove={onSceneMove}
        onPointerLeave={onSceneLeave}
        onPointerCancel={onSceneLeave}
      >
        <div className="ec-auth-orbit" aria-hidden>
          <article className="ec-auth-orbit-card ec-auth-orbit-card--voice">
            <span className="ec-auth-orbit-card__eyebrow">Голос</span>
            <strong className="ec-auth-orbit-card__title">Живые каналы</strong>
            <p className="ec-auth-orbit-card__body">
              Чаты, созвоны и быстрые сигналы собираются в одном рабочем ритме.
            </p>
            <span className="ec-auth-orbit-card__status">
              <span className="ec-auth-orbit-card__dot" />
              синхронно
            </span>
          </article>

          <article className="ec-auth-orbit-card ec-auth-orbit-card--ops">
            <span className="ec-auth-orbit-card__eyebrow">Исполнение</span>
            <strong className="ec-auth-orbit-card__title">Задачи не теряются</strong>
            <p className="ec-auth-orbit-card__body">
              Статусы, дедлайны и ответственные всегда видны прямо в контуре команды.
            </p>
            <span className="ec-auth-orbit-card__status ec-auth-orbit-card__status--warn">
              24/7 под рукой
            </span>
          </article>

          <article className="ec-auth-orbit-card ec-auth-orbit-card--memory">
            <span className="ec-auth-orbit-card__eyebrow">Память</span>
            <strong className="ec-auth-orbit-card__title">Решения остаются в системе</strong>
            <p className="ec-auth-orbit-card__body">
              Ничего не теряется в мессенджерах: история, контекст и действия живут вместе.
            </p>
            <span className="ec-auth-orbit-card__status ec-auth-orbit-card__status--accent">
              контекст сохранён
            </span>
          </article>
        </div>

        <div className="ec-auth-stack" data-entry={entryState}>
          <div className="ec-auth-logo" aria-hidden>
            <img className="ec-auth-logo__mark" src={brandMarkUrl} alt="" />
          </div>
          <h1 className="ec-auth-title">ECLIPSE</h1>
          <div className="ec-auth-subtitle">ПРОТОКОЛ_ШЛЮЗА_V1.0</div>

          <div className="ec-auth-product-strip" aria-hidden>
            <span className="ec-auth-product-chip">Чаты</span>
            <span className="ec-auth-product-chip">Голос</span>
            <span className="ec-auth-product-chip">Задачи</span>
            <span className="ec-auth-product-chip">Память команды</span>
          </div>

          <div className="ec-auth-terminal-frame" data-entry={entryState}>
            <section className="ec-auth-terminal ec-auth-entry-shell" aria-live="polite">
              <span className="ec-auth-terminal__accent-tl" aria-hidden />
              <span className="ec-auth-terminal__accent-br" aria-hidden />
              <div className="ec-auth-gateway" data-entry={entryState}>
                <button
                  type="button"
                  className="ec-auth-bio-gate"
                  onClick={openAuthGate}
                  disabled={entryState === "opening"}
                  aria-label={
                    entryState === "opening"
                      ? "Подготавливаем панель входа"
                      : "Открыть панель входа"
                  }
                >
                  <span className="ec-auth-bio-gate__capsule" aria-hidden>
                    <span className="ec-auth-bio-gate__spinner" />
                    <span className="ec-auth-bio-gate__scanline" />
                    <span className="ec-auth-bio-gate__ring ec-auth-bio-gate__ring--outer" />
                    <span className="ec-auth-bio-gate__ring ec-auth-bio-gate__ring--inner" />
                    <span className="ec-auth-bio-gate__fingerprint">
                      <FingerprintIcon />
                    </span>
                  </span>
                  <span className="ec-auth-bio-gate__eyebrow">Биометрический шлюз</span>
                  <strong className="ec-auth-bio-gate__title">
                    {entryState === "opening"
                      ? "Проверяем контур допуска"
                      : "Тактильный допуск к панели входа"}
                  </strong>
                  <span className="ec-auth-bio-gate__copy">
                    {entryState === "opening"
                      ? "Собираем сигнатуру доступа и раскрываем защищённый терминал."
                      : "Стилизация под биометрический сенсор: сначала жест допуска, затем обычная защищённая авторизация."}
                  </span>
                  <span className="ec-auth-bio-gate__cta">
                    {entryState === "opening" ? "Сканирование..." : "Нажмите, чтобы открыть форму"}
                  </span>
                </button>

                <div className="ec-auth-console" aria-hidden={entryState === "gate"}>
                  {step === "credentials" && (
                    <>
                      <header className="ec-auth-step-head">
                        <span className="ec-auth-step-head__icon" aria-hidden>
                          <LockIcon />
                        </span>
                        <span className="ec-auth-step-head__label">
                          {mode === "login" ? "Вход в систему" : "Создание аккаунта"}
                        </span>
                      </header>

                      <p className="ec-auth-step-copy">
                        {mode === "login"
                          ? "Вернитесь в рабочий контур команды и продолжайте чат, голос и исполнение без лишних экранов."
                          : "Создайте рабочий аккаунт, чтобы подключиться к каналу команды, задачам и общему контексту."}
                      </p>

                      <div className="ec-auth-live-rail" aria-hidden>
                        <div className="ec-auth-live-pill">
                          <span className="ec-auth-live-pill__label">Каналы</span>
                          <strong className="ec-auth-live-pill__value">живые</strong>
                        </div>
                        <div className="ec-auth-live-pill">
                          <span className="ec-auth-live-pill__label">Задачи</span>
                          <strong className="ec-auth-live-pill__value">в фокусе</strong>
                        </div>
                        <div className="ec-auth-live-pill">
                          <span className="ec-auth-live-pill__label">Голос</span>
                          <strong className="ec-auth-live-pill__value">на линии</strong>
                        </div>
                      </div>

                      <div className="ec-auth-mode-toggle" role="tablist" aria-label="Режим">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mode === "login"}
                          onClick={() => switchMode("login")}
                        >
                          Вход
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mode === "register"}
                          onClick={() => switchMode("register")}
                        >
                          Регистрация
                        </button>
                      </div>

                      <form onSubmit={submitCredentials} className="ec-auth-form">
                        {mode === "register" && (
                          <div className="ec-auth-field">
                            <label className="ec-auth-field__label">Имя</label>
                            <input
                              ref={displayNameFieldRef}
                              className="ec-auth-field__input"
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder="Как к вам обращаться"
                              maxLength={64}
                              required
                              autoComplete="nickname"
                              enterKeyHint="next"
                            />
                          </div>
                        )}

                        <div className="ec-auth-field">
                          <label className="ec-auth-field__label">Email</label>
                          <input
                            ref={emailFieldRef}
                            className="ec-auth-field__input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                            inputMode="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            enterKeyHint="next"
                          />
                        </div>

                        <div className="ec-auth-field ec-auth-field--violet">
                          <label className="ec-auth-field__label">Пароль</label>
                          <PasswordReveal
                            value={password}
                            onChange={setPassword}
                            minLength={8}
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                            placeholder={
                              mode === "register"
                                ? "Минимум 8 символов"
                                : "Введите пароль"
                            }
                          />
                          <p className="ec-auth-field__hint">
                            {mode === "register"
                              ? "Минимум 8 символов, обязательно буквы и цифры."
                              : "Если аккаунта ещё нет, создайте его на соседней вкладке."}
                          </p>
                        </div>

                        <button
                          type="submit"
                          className="ec-auth-submit-btn"
                          disabled={busy}
                        >
                          {busy ? "Подключение…" : mode === "login" ? "Войти" : "Создать аккаунт"}
                          <ArrowIcon />
                        </button>
                      </form>

                      {localError && (
                        <p className="ec-auth-err" role="alert">
                          {localError}
                        </p>
                      )}
                    </>
                  )}

                  {step === "twofa" && !useRecovery && (
                    <>
                      <header className="ec-auth-step-head">
                        <span
                          className="ec-auth-step-head__icon ec-auth-step-head__icon--violet"
                          aria-hidden
                        >
                          <ShieldIcon />
                        </span>
                        <span className="ec-auth-step-head__label">Код из приложения</span>
                      </header>

                      <p className="ec-auth-step-copy">
                        Введите шестизначный код из приложения-аутентификатора. После проверки
                        мы сразу вернём вас в рабочее пространство.
                      </p>

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
                        className="ec-auth-submit-btn ec-auth-submit-btn--secondary"
                        disabled={busy}
                      >
                        <span>Резервный код</span>
                      </button>

                      {localError && (
                        <p className="ec-auth-err" role="alert">
                          {localError}
                        </p>
                      )}
                    </>
                  )}

                  {step === "twofa" && useRecovery && (
                    <>
                      <header className="ec-auth-step-head">
                        <span
                          className="ec-auth-step-head__icon ec-auth-step-head__icon--violet"
                          aria-hidden
                        >
                          <ShieldIcon />
                        </span>
                        <span className="ec-auth-step-head__label">Резервный код</span>
                      </header>

                      <p className="ec-auth-step-copy">
                        Если приложение с кодами сейчас недоступно, используйте резервный код
                        восстановления.
                      </p>

                      <form onSubmit={submitRecovery} className="ec-auth-form">
                        <div className="ec-auth-field ec-auth-field--violet">
                          <label className="ec-auth-field__label">Резервный код</label>
                          <input
                            className="ec-auth-field__input ec-auth-field__input--centered"
                            type="text"
                            value={recoveryCode}
                            onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                            placeholder="ABCDE-12345"
                            maxLength={11}
                            required
                            autoFocus
                            autoCapitalize="characters"
                            spellCheck={false}
                          />
                          <p className="ec-auth-field__hint">Формат: `ABCDE-12345`</p>
                        </div>

                        <button
                          type="submit"
                          className="ec-auth-submit-btn"
                          disabled={busy || !recoveryCode.trim()}
                        >
                          {busy ? "Проверка…" : "Подтвердить"}
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
                        className="ec-auth-submit-btn ec-auth-submit-btn--secondary"
                        disabled={busy}
                      >
                        <span>← Код 2FA</span>
                      </button>

                      {localError && (
                        <p className="ec-auth-err" role="alert">
                          {localError}
                        </p>
                      )}
                    </>
                  )}

                  {step === "success" && (
                    <div className="ec-auth-success" aria-live="polite">
                      <div className="ec-auth-success__ring" aria-hidden>
                        <UnlockIcon />
                      </div>
                      <div className="ec-auth-success__label">Вход выполнен</div>
                      <p className="ec-auth-success__copy">
                        Доступ подтверждён. Открываем живое рабочее пространство команды.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="ec-auth-bottom-hud" aria-hidden>
        <span className="ec-auth-bottom-hud__status">
          <span className="ec-auth-bottom-hud__dot" />
          Защищённая связь активна
        </span>
        <span>Версия {VERSION}</span>
      </div>
    </main>
  );
}

function PasswordReveal({
  value,
  onChange,
  minLength,
  autoComplete,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
  autoComplete: string;
  placeholder: string;
}) {
  const [shown, setShown] = useState(false);
  const [scanId, setScanId] = useState(0);
  const [scanning, setScanning] = useState(false);

  const toggle = () => {
    if (!value) return;
    setShown((s) => !s);
    if (prefersReducedMotion()) return;
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
        placeholder={placeholder}
        minLength={minLength}
        required
        autoComplete={autoComplete}
        enterKeyHint="go"
      />
      <button
        type="button"
        className={"ec-auth-pass__reveal" + (shown ? " ec-auth-pass__reveal--on" : "")}
        onClick={toggle}
        disabled={!value}
        aria-pressed={shown}
        aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
        title={value ? (shown ? "Скрыть пароль" : "Показать пароль") : "Введите пароль"}
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

function FingerprintIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8.2 7.5a5.4 5.4 0 0 1 7.6 0" />
      <path d="M6.5 9.5a7.8 7.8 0 0 1 11 0" />
      <path d="M12 8.6c1.7 0 3 1.4 3 3v1.6a8.6 8.6 0 0 1-2.1 5.6" />
      <path d="M12 11v3.8" />
      <path d="M9.8 12.2v1.5a5.9 5.9 0 0 1-1.3 3.7" />
      <path d="M7.2 11.9v1a8.5 8.5 0 0 1-1.1 4.2" />
      <path d="M14.9 10.8v1.7a10.7 10.7 0 0 1-2.7 7.1" />
      <path d="M12 18.9a4.4 4.4 0 0 0 2.1-3.8" />
      <path d="M9.3 16.5a4.1 4.1 0 0 0 1.6 2.2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
