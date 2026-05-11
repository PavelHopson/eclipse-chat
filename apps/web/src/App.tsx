import type { CSSProperties } from "react";
import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./pages/AppShell";
import { AuthPage } from "./pages/AuthPage";

const loadingStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#0f0f12",
  color: "#888",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

export function App() {
  const { view, user, error, login, register, logout, socketRev } = useAuth();

  if (view === "loading") {
    return <main style={loadingStyle}>Загрузка…</main>;
  }

  if (view === "auth" || !user) {
    return <AuthPage error={error} onLogin={login} onRegister={register} />;
  }

  return <AppShell user={user} socketRev={socketRev} onLogout={logout} />;
}
