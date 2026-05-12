import type { CSSProperties } from "react";
import { useState } from "react";

type Props = {
  error: string | null;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (email: string, password: string, displayName: string) => Promise<boolean>;
};

const wrap: CSSProperties = {
  minHeight: "100vh",
  background: "var(--ec-bg)",
  color: "var(--ec-text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--ec-space-4)",
  backgroundImage:
    "radial-gradient(ellipse at top, hsl(195 40% 14% / 0.5) 0%, transparent 50%), radial-gradient(ellipse at bottom right, hsl(160 30% 12% / 0.35) 0%, transparent 55%)",
};

const card: CSSProperties = {
  width: "min(420px, 100%)",
  background: "var(--ec-surface-1)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  padding: "var(--ec-space-6)",
  boxShadow: "var(--ec-shadow-lg)",
};

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  marginBottom: "var(--ec-space-1)",
};

const brandMark: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "var(--ec-radius-sm)",
  background: "linear-gradient(135deg, hsl(195 60% 55%) 0%, hsl(160 45% 55%) 100%)",
  boxShadow: "0 0 12px hsl(195 60% 55% / 0.4)",
};

const tabsRow: CSSProperties = {
  display: "flex",
  gap: 2,
  marginBottom: "var(--ec-space-4)",
  padding: 3,
  background: "var(--ec-surface-2)",
  borderRadius: "var(--ec-radius-md)",
};

function tabStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "0.5rem 0.75rem",
    background: active ? "var(--ec-surface-3)" : "transparent",
    color: active ? "var(--ec-text-strong)" : "var(--ec-text-muted)",
    border: 0,
    borderRadius: "var(--ec-radius-sm)",
    cursor: "pointer",
    fontSize: "var(--ec-text-sm)",
    fontWeight: 600,
    transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
  };
}

const passwordWrap: CSSProperties = { position: "relative" };

const eyeButton: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  width: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: 0,
  color: "var(--ec-text-dim)",
  cursor: "pointer",
  padding: 0,
  transition: "color var(--ec-dur-fast) var(--ec-ease)",
};

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function AuthPage({ error, onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "login") {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, displayName);
      }
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <main style={wrap}>
      <section style={card}>
        <div style={brandRow}>
          <span style={brandMark} aria-hidden />
          <h1 style={{ margin: 0, fontSize: "var(--ec-text-lg)", fontWeight: 600, letterSpacing: "var(--ec-tracking-tight)" }}>
            Eclipse Chat
          </h1>
        </div>
        <p style={{ margin: "0 0 var(--ec-space-5)", color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
          Self-hosted communication core
        </p>

        <div style={tabsRow} role="tablist">
          <button type="button" onClick={() => setMode("login")} style={tabStyle(mode === "login")} role="tab" aria-selected={mode === "login"}>
            Вход
          </button>
          <button type="button" onClick={() => setMode("register")} style={tabStyle(mode === "register")} role="tab" aria-selected={mode === "register"}>
            Регистрация
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          style={{ display: "grid", gap: "var(--ec-space-3)" }}
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
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="ec-field-label">Пароль <span style={{ color: "var(--ec-text-dim)", fontWeight: 400 }}>(8+)</span></label>
            <div style={passwordWrap}>
              <input
                className="ec-field"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={8}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                tabIndex={-1}
                style={eyeButton}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ec-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ec-text-dim)")}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="ec-btn ec-btn--primary"
            style={{ padding: "0.7rem", fontSize: "var(--ec-text-base)", marginTop: "var(--ec-space-2)" }}
          >
            {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        {error && (
          <p style={{ margin: "var(--ec-space-3) 0 0", color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
