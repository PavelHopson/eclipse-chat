import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./pages/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { ClientPortalContainer } from "./pages/ClientPortalContainer";

/**
 * v0.83 #24 phase 1: hash-route detection для Client Portal.
 *
 * Используем hash route (#/portal/<serverId>) вместо path route чтобы не
 * трогать nginx SPA fallback config. Тот же подход что в EclipseForgeLanding.
 * Phase 2 можно мигрировать на path route + nginx try_files.
 */
const PORTAL_HASH_RE = /^#\/portal\/([\w-]+)\/?$/;

function parsePortalHash(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(PORTAL_HASH_RE);
  return match ? match[1] : null;
}

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
  const [portalServerId, setPortalServerId] = useState<string | null>(() =>
    parsePortalHash(),
  );

  useEffect(() => {
    const onHashChange = () => setPortalServerId(parsePortalHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isAuthenticated = view !== "loading" && view !== "auth" && user;

  return (
    <>
      {/* Ambient background layer — visible на всех view'ах через z-index -1 */}
      <div className="ec-ambient" aria-hidden />
      {view === "loading" ? (
        <main style={loadingStyle}>Загрузка…</main>
      ) : !isAuthenticated ? (
        <AuthPage error={error} onLogin={login} onRegister={register} />
      ) : portalServerId ? (
        <ClientPortalContainer serverId={portalServerId} />
      ) : (
        <AppShell user={user} socketRev={socketRev} onLogout={logout} />
      )}
    </>
  );
}
