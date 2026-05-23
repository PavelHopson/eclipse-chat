import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./pages/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { ClientPortalContainer } from "./pages/ClientPortalContainer";
import { LandingPage } from "./pages/LandingPage";

/**
 * v1.1.2: client-side version embedded at build-time через Vite define.
 * Сравниваем с /api/version при mount + каждую минуту — если server
 * выкатил newer version, показываем banner «Обновите страницу».
 *
 * Решает проблему когда SW invalidate не работает быстро (browser HTTP
 * cache на index.html, nginx caching, etc) — у user'а старый bundle,
 * новые feature'ы недоступны.
 */
declare const __ECLIPSE_VERSION__: string;
const CLIENT_VERSION =
  typeof __ECLIPSE_VERSION__ !== "undefined" ? __ECLIPSE_VERSION__ : "0.0.0";

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
  const { view, user, error, login, register, logout, socketRev, clearError } = useAuth();
  const [portalServerId, setPortalServerId] = useState<string | null>(() =>
    parsePortalHash(),
  );
  const [authSurface, setAuthSurface] = useState<null | "login" | "register">(null);
  const [updateAvailable, setUpdateAvailable] = useState<{
    serverVersion: string;
  } | null>(null);

  useEffect(() => {
    const onHashChange = () => setPortalServerId(parsePortalHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // v1.1.2: poll server version + compare с client build version.
  // Если mismatch — показываем banner. Polling каждую минуту чтобы
  // catch deploy без full page reload.
  useEffect(() => {
    if (CLIENT_VERSION === "0.0.0") return; // dev mode — skip
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(
          (import.meta.env.BASE_URL || "/") + "api/version",
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (cancelled || !data.version) return;
        if (data.version !== CLIENT_VERSION) {
          setUpdateAvailable({ serverVersion: data.version });
        }
      } catch {
        /* network blip, retry next interval */
      }
    };
    void check();
    const id = window.setInterval(check, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (view !== "auth" && authSurface !== null) {
      setAuthSurface(null);
    }
  }, [authSurface, view]);

  /**
   * v1.1.15: bulletproof hard reload. Старая banner-кнопка делала просто
   * `window.location.reload()` — но reload ПЕРЕХВАТЫВАЕТСЯ Service
   * Worker'ом (navigationStrategy fetch handler). Если на устройстве
   * застрял старый SW со старой стратегией (или browser-кэш sw.js) —
   * reload вечно отдаёт старый bundle. Особенно зло на mobile Chrome.
   *
   * Fix: перед reload — unregister ВСЕ SW + clear ВСЕ caches. После
   * этого reload идёт без SW-перехвата, чистый fetch с сервера. SW
   * заново зарегистрируется уже из свежего bundle.
   */
  const hardReload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      /* ignore — продолжаем к clearing caches + reload */
    }
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    // reload(true) deprecated; после unregister+clear обычный reload идёт
    // чистым fetch'ем. HTML отдаётся nginx'ом с no-cache, assets хэшированы.
    window.location.reload();
  };

  const isAuthenticated = view !== "loading" && view !== "auth" && user;

  const openAuthSurface = (mode: "login" | "register") => {
    clearError();
    setAuthSurface(mode);
  };

  const closeAuthSurface = () => {
    clearError();
    setAuthSurface(null);
  };

  return (
    <>
      {/* Ambient background layer — visible на всех view'ах через z-index -1 */}
      <div className="ec-ambient" aria-hidden />
      {updateAvailable && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            background: "hsl(200 8% 9% / 0.95)",
            border: "1px solid var(--ec-accent)",
            borderRadius: "var(--ec-radius-md)",
            boxShadow:
              "0 0 0 1px var(--ec-accent), 0 0 24px -4px hsl(258 90% 66% / 0.5), 0 8px 32px hsl(210 40% 2% / 0.6)",
            fontSize: "var(--ec-text-sm)",
            color: "var(--ec-text)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            maxWidth: "min(560px, calc(100vw - 32px))",
            fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
            letterSpacing: "0.04em",
          }}
          role="alert"
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--ec-accent)",
              boxShadow: "0 0 8px var(--ec-accent)",
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            ДОСТУПНО ОБНОВЛЕНИЕ · v{updateAvailable.serverVersion}
            <span style={{ color: "var(--ec-text-dim)", marginLeft: 6 }}>
              (текущая v{CLIENT_VERSION})
            </span>
          </span>
          <button
            type="button"
            onClick={() => void hardReload()}
            disabled={reloading}
            className="ec-btn ec-btn--primary ec-btn--sm"
            style={{ flexShrink: 0 }}
          >
            {reloading ? "ОБНОВЛЯЮ…" : "ПЕРЕЗАГРУЗИТЬ"}
          </button>
          <button
            type="button"
            onClick={() => setUpdateAvailable(null)}
            aria-label="Скрыть"
            title="Скрыть"
            style={{
              flexShrink: 0,
              width: 24,
              height: 24,
              padding: 0,
              display: "grid",
              placeItems: "center",
              background: "transparent",
              border: 0,
              borderRadius: "var(--ec-radius-sm)",
              color: "var(--ec-text-dim)",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
      {view === "loading" ? (
        <main style={loadingStyle}>Загрузка…</main>
      ) : !isAuthenticated ? (
        <>
          <LandingPage onOpenAuth={openAuthSurface} />
          {authSurface && (
            <AuthPage
              key={authSurface}
              error={error}
              onLogin={login}
              onRegister={register}
              initialMode={authSurface}
              initialEntryState="panel"
              onExit={closeAuthSurface}
            />
          )}
        </>
      ) : portalServerId ? (
        <ClientPortalContainer serverId={portalServerId} />
      ) : (
        <AppShell user={user} socketRev={socketRev} onLogout={logout} />
      )}
    </>
  );
}
