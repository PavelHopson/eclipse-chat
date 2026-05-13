import { useState } from "react";
import {
  CameraLensIcon,
  ScreenShareIcon,
  StatsPulseIcon,
  TuningIcon,
  VoiceChannelIcon,
} from "../components/icons/EclipseIcons";

type Props = {
  error: string | null;
  onLogin: (
    email: string,
    password: string,
    opts?: { totpCode?: string; recoveryCode?: string },
  ) => Promise<{ success: boolean; needs2FA?: boolean }>;
  onRegister: (email: string, password: string, displayName: string) => Promise<boolean>;
};

const featureCards = [
  {
    icon: <OrbitIcon />,
    title: "Private",
    text: "Приватный контур для команды, каналов, DM и голосовых сессий.",
  },
  {
    icon: <ActionIcon />,
    title: "Intelligent",
    text: "Сообщения превращаются в задачи, решения и рабочий сигнал.",
  },
  {
    icon: <ShieldIcon />,
    title: "Engineered",
    text: "Система собрана для контроля, исполнения и ясной коммуникации.",
  },
];

const statusRows = ["Private channel open", "Voice core online", "Action queue synced"];

const boardPillars = [
  { icon: <ShieldIcon />, title: "Private", text: "Built for secure teams" },
  { icon: <OrbitIcon />, title: "Intelligent", text: "Designed for operators" },
  { icon: <ActionIcon />, title: "Engineered", text: "Focused on execution" },
];

function baseIconProps() {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg {...baseIconProps()}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg {...baseIconProps()}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...baseIconProps()}>
      <path d="M12 3 5.5 5.7v5.2c0 4.2 2.6 7.9 6.5 9.1 3.9-1.2 6.5-4.9 6.5-9.1V5.7L12 3Z" />
      <path d="m9.6 12 1.7 1.7 3.5-4" />
    </svg>
  );
}

function OrbitIcon() {
  return (
    <svg {...baseIconProps()}>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M4.6 12c0-2.7 3.3-4.9 7.4-4.9s7.4 2.2 7.4 4.9-3.3 4.9-7.4 4.9-7.4-2.2-7.4-4.9Z" />
      <path d="M8.4 5.6c2.3-1.3 5.9.7 8 4.3 2 3.6 1.8 7.7-.5 9-2.3 1.3-5.9-.7-8-4.3-2-3.6-1.8-7.7.5-9Z" />
    </svg>
  );
}

function ActionIcon() {
  return (
    <svg {...baseIconProps()}>
      <path d="M6 6h12" />
      <path d="M6 12h8" />
      <path d="M6 18h5" />
      <path d="m15 17 2 2 4-5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg {...baseIconProps()} width="16" height="16">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ProductPreview() {
  return (
    <div className="ec-auth-preview ec-auth-board-preview" aria-label="Превью интерфейса Eclipse Chat">
      <div className="ec-auth-preview__bar">
        <span className="ec-auth-window-dot" />
        <span className="ec-auth-window-dot" />
        <span className="ec-auth-window-dot" />
        <span className="ec-auth-preview__title">ECLIPSE://CONTROL-ROOM</span>
      </div>

      <div className="ec-auth-preview__body">
        <div className="ec-auth-server-rail">
          <span className="ec-auth-server-tile is-active">E</span>
          <span className="ec-auth-server-tile">+</span>
          <span className="ec-auth-server-tile">
            <VoiceChannelIcon />
          </span>
        </div>

        <div className="ec-auth-channel-panel">
          <div className="ec-auth-channel-head">
            <strong>Execution room</strong>
            <span>OWNER</span>
          </div>
          <div className="ec-auth-channel-group">Текстовые каналы</div>
          <div className="ec-auth-channel is-active"># strategy-core</div>
          <div className="ec-auth-channel"># product-flow</div>
          <div className="ec-auth-channel"># release-control</div>
          <div className="ec-auth-channel-group">Голосовые</div>
          <div className="ec-auth-voice-pill">
            <VoiceChannelIcon />
            system call
          </div>
        </div>

        <div className="ec-auth-chat-panel">
          <div className="ec-auth-chat-top">
            <span># strategy-core</span>
            <div>
              <CameraLensIcon />
              <ScreenShareIcon />
              <TuningIcon />
            </div>
          </div>

          <div className="ec-auth-message">
            <span className="ec-auth-avatar">P</span>
            <div>
              <strong>Павел</strong>
              <p>Нужно превратить хаотичный чат в рабочую систему.</p>
            </div>
          </div>
          <div className="ec-auth-message is-accent">
            <span className="ec-auth-avatar">AI</span>
            <div>
              <strong>Eclipse Operator</strong>
              <p>Создан action item, назначен ответственный, открыт voice-контур.</p>
            </div>
          </div>

          <div className="ec-auth-action-strip">
            <div>
              <ActionIcon />
              <span>3 действия</span>
            </div>
            <span>sync 98%</span>
          </div>
        </div>
      </div>

      <div className="ec-auth-preview__footer">
        <span>
          <StatsPulseIcon />
          Latency 24ms
        </span>
        <span>signal stable</span>
      </div>
    </div>
  );
}

export function AuthPage({ error, onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const opts = needs2FA
          ? useRecovery
            ? { recoveryCode: totpCode }
            : { totpCode }
          : undefined;
        const res = await onLogin(email, password, opts);
        if (!res.success && res.needs2FA) {
          setNeeds2FA(true);
        }
        if (res.success) {
          setNeeds2FA(false);
          setTotpCode("");
        }
      } else {
        await onRegister(email, password, displayName);
      }
    } finally {
      setBusy(false);
      if (!needs2FA) {
        setPassword("");
      }
    }
  };

  return (
    <main className="ec-auth-page ec-auth-page--board">
      <div className="ec-auth-atmosphere" aria-hidden>
        <span className="ec-auth-signal ec-auth-signal--one" />
        <span className="ec-auth-signal ec-auth-signal--two" />
        <span className="ec-auth-signal ec-auth-signal--three" />
      </div>

      <section className="ec-auth-board-shell">
        <header className="ec-auth-board-head">
          <div className="ec-auth-board-identity">
            <span className="ec-brand-mark ec-auth-board-mark" aria-hidden />
            <div>
              <h1>Eclipse Chat</h1>
              <p>Focus. Communicate. Build.</p>
              <span>Private / Intelligent / Engineered</span>
            </div>
          </div>

          <div className="ec-auth-board-statement">
            <span>Brand statement</span>
            <p>
              Eclipse Chat — приватная operator communication system для фокуса,
              ясности и исполнения. Без шума. Только сигнал.
            </p>
          </div>

          <div className="ec-auth-board-principles">
            {boardPillars.map((item) => (
              <div key={item.title}>
                <span aria-hidden>{item.icon}</span>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </div>
            ))}
          </div>
        </header>

        <div className="ec-auth-board-main">
          <div className="ec-auth-board-hero">
            <div className="ec-auth-board-copy">
              <span>Private operator communication</span>
              <h2>Communication without noise.</h2>
              <p>
                Чат, голос, демонстрация экрана и action-items в одном тёмном
                контуре для команд, которым нужен не поток сообщений, а результат.
              </p>
              <div className="ec-auth-quick-actions" aria-label="Главные возможности">
                <a href="#auth-panel" className="ec-btn ec-btn--primary ec-auth-cta">
                  Войти в систему
                  <ArrowIcon />
                </a>
                <span className="ec-auth-signal-badge">
                  <ShieldIcon />
                  Self-hosted core
                </span>
              </div>
            </div>

            <ProductPreview />

            <div className="ec-auth-board-feature-row">
              {featureCards.map((item) => (
                <article className="ec-auth-feature-card" key={item.title}>
                  <span className="ec-auth-feature-icon">{item.icon}</span>
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="ec-auth-panel ec-auth-board-login" id="auth-panel" aria-label="Вход в Eclipse Chat">
            <div className="ec-auth-panel__status">
              <span className="ec-dot ec-dot--online" />
              Request channel open
            </div>

            <div className="ec-auth-panel__head">
              <h2>{mode === "login" ? "Вход в контур" : "Создать контур"}</h2>
              <p>{mode === "login" ? "Продолжайте работу там, где остановились." : "Запустите приватное пространство для команды."}</p>
            </div>

            <div className="ec-auth-tabs" role="tablist" aria-label="Режим авторизации">
              <button
                type="button"
                className={mode === "login" ? "is-active" : ""}
                onClick={() => setMode("login")}
                role="tab"
                aria-selected={mode === "login"}
              >
                Вход
              </button>
              <button
                type="button"
                className={mode === "register" ? "is-active" : ""}
                onClick={() => setMode("register")}
                role="tab"
                aria-selected={mode === "register"}
              >
                Регистрация
              </button>
            </div>

            <form
              className="ec-auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {mode === "register" && (
                <div>
                  <label className="ec-field-label">Имя</label>
                  <input
                    className="ec-field"
                    placeholder="Как вас называть"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="nickname"
                    maxLength={64}
                    required
                  />
                </div>
              )}
              <div>
                <label className="ec-field-label">Email</label>
                <input
                  className="ec-field"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (needs2FA) {
                      setNeeds2FA(false);
                      setTotpCode("");
                    }
                  }}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="ec-field-label">
                  Пароль <span>(8+)</span>
                </label>
                <div className="ec-auth-password">
                  <input
                    className="ec-field"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    tabIndex={-1}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </div>
              {mode === "login" && needs2FA && (
                <div
                  style={{
                    padding: "var(--ec-space-3)",
                    background: "var(--ec-accent-soft)",
                    border: "1px solid var(--ec-accent)",
                    borderRadius: "var(--ec-radius-md)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--ec-space-2)",
                  }}
                >
                  <label className="ec-field-label">
                    {useRecovery ? "Recovery-код" : "Код 2FA"}{" "}
                    <span>
                      {useRecovery ? "(XXXXX-XXXXX)" : "(6 цифр из приложения)"}
                    </span>
                  </label>
                  <input
                    className="ec-field"
                    type="text"
                    inputMode={useRecovery ? "text" : "numeric"}
                    placeholder={useRecovery ? "ABCDE-12345" : "123456"}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={useRecovery ? 11 : 6}
                    required
                    style={{
                      fontFamily: "var(--ec-font-mono)",
                      letterSpacing: "0.15em",
                      textAlign: "center",
                      fontSize: "var(--ec-text-base)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUseRecovery((v) => !v);
                      setTotpCode("");
                    }}
                    className="ec-btn ec-btn--ghost ec-btn--sm"
                    style={{ alignSelf: "flex-start", fontSize: "var(--ec-text-2xs)" }}
                  >
                    {useRecovery
                      ? "← Использовать код из приложения"
                      : "Потерял доступ к телефону? Использовать recovery-код"}
                  </button>
                </div>
              )}
              <button type="submit" disabled={busy} className="ec-btn ec-btn--primary ec-auth-submit">
                {busy
                  ? "Подключаю…"
                  : mode === "login"
                  ? needs2FA
                    ? "Подтвердить и войти"
                    : "Войти"
                  : "Создать аккаунт"}
              </button>
            </form>

            {error && <p className="ec-auth-error">{error}</p>}

            <div className="ec-auth-status-list" aria-label="Статусы системы">
              {statusRows.map((row) => (
                <div key={row}>
                  <span>Status</span>
                  <strong>{row}</strong>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
