import type { CSSProperties } from "react";
import { useState } from "react";

type Props = {
  error: string | null;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (email: string, password: string, displayName: string) => Promise<boolean>;
};

const wrap: CSSProperties = {
  minHeight: "100vh",
  background: "#0f0f12",
  color: "#e8e8ed",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(420px, 100%)",
  background: "#15151a",
  border: "1px solid #2a2a32",
  borderRadius: 12,
  padding: 24,
};

const tabs: CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 16,
};

const tab = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: "0.6rem",
  background: active ? "#2a2a3a" : "transparent",
  color: active ? "#e8e8ed" : "#c8c8d0",
  border: "1px solid #2a2a32",
  borderRadius: 8,
  cursor: "pointer",
});

const fieldBase: CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #2a2a32",
  background: "#1a1a20",
  color: "#e8e8ed",
  fontSize: "0.95rem",
};

export function AuthPage({ error, onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) {
      return;
    }
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
        <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem" }}>Eclipse Chat</h1>
        <p style={{ margin: "0 0 18px", opacity: 0.6, fontSize: "0.88rem" }}>Self-hosted communication core</p>

        <div style={tabs}>
          <button type="button" onClick={() => setMode("login")} style={tab(mode === "login")}>
            Вход
          </button>
          <button type="button" onClick={() => setMode("register")} style={tab(mode === "register")}>
            Регистрация
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          style={{ display: "grid", gap: 10 }}
        >
          {mode === "register" && (
            <input
              placeholder="Имя"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              style={fieldBase}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={fieldBase}
          />
          <input
            type="password"
            placeholder="Пароль (8+)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            style={fieldBase}
          />
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "0.7rem",
              borderRadius: 8,
              background: "#3b5ccc",
              color: "#fff",
              border: "none",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        {error && (
          <p style={{ margin: "12px 0 0", color: "#f88", fontSize: "0.88rem" }}>
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
