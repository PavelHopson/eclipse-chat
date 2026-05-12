import type { CSSProperties } from "react";
import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./pages/AppShell";
import { AuthPage } from "./pages/AuthPage";

const loadingStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--ec-bg)",
  color: "var(--ec-text-dim)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--ec-font-sans)",
  fontSize: "var(--ec-text-sm)",
};

export function App() {
  const { view, user, error, login, register, logout, socketRev } = useAuth();

  return (
    <>
      {/* Ambient background layer — visible на всех view'ах через z-index -1 */}
      <div className="ec-ambient" aria-hidden />
      {view === "loading" ? (
        <main style={loadingStyle}>Загрузка…</main>
      ) : view === "auth" || !user ? (
        <AuthPage error={error} onLogin={login} onRegister={register} />
      ) : (
        <AppShell user={user} socketRev={socketRev} onLogout={logout} />
      )}
    </>
  );
}
