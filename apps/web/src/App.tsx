import type { CSSProperties } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { DeadlineNotFoundPage } from "./pages/DeadlineNotFoundPage";
import { LandingPage } from "./pages/LandingPage";

/**
 * v1.5.17 — Bundle split: AppShell и ClientPortalContainer теперь lazy.
 * LandingPage остаётся eager (visitors видят его instantly без waterfall'а).
 * Authenticated/portal views — separate chunks, грузятся after login или
 * при попадании на `#/portal/...` hash.
 *
 * Эффект на landing cold-load: ~600KB JS уезжает из main bundle'а в
 * AppShell chunk (вместе с livekit-client, useVoice, useMusic и пр.),
 * который грузится только когда нужен.
 *
 * Named export → default через мини-shim (React.lazy умеет только default).
 */
const AppShell = lazy(() =>
  import("./pages/AppShell").then((m) => ({ default: m.AppShell })),
);

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
const AUTH_PANEL_HASH = "#auth-panel";
const AUTH_PANEL_HASH_RE = /^#auth-panel\/?$/i;
const KNOWN_HASH_RE = /^(|#|#auth-panel\/?)$/i;

function normalizeBasePath() {
  const base = import.meta.env.BASE_URL || "/";
  const path = new URL(base, window.location.origin).pathname;
  return path.endsWith("/") ? path : `${path}/`;
}

function isUnknownClientRoute() {
  if (typeof window === "undefined") return false;
  const basePath = normalizeBasePath();
  const { pathname, hash } = window.location;

  if (!KNOWN_HASH_RE.test(hash || "")) return true;
  if (pathname === basePath || pathname === basePath.slice(0, -1)) return false;

  return pathname.startsWith(basePath);
}

function parseLandingHash(hash?: string): { wantsAuthPanel: boolean } {
  if (typeof window === "undefined" && hash == null) {
    return { wantsAuthPanel: false };
  }

  const nextHash = hash ?? window.location.hash;
  return { wantsAuthPanel: AUTH_PANEL_HASH_RE.test(nextHash) };
}

function replaceLandingHash(nextHash: string | null) {
  if (typeof window === "undefined") return;
  const normalizedHash = nextHash ?? "";
  if ((window.location.hash || "") === normalizedHash) return;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${normalizedHash}`,
  );
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
  const [authSurface, setAuthSurface] = useState<null | "login" | "register">(() =>
    parseLandingHash().wantsAuthPanel ? "login" : null,
  );
  const [unknownRoute, setUnknownRoute] = useState(isUnknownClientRoute);
  const [updateAvailable, setUpdateAvailable] = useState<{
    serverVersion: string;
  } | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      setUnknownRoute(isUnknownClientRoute());
      setAuthSurface((current) =>
        parseLandingHash().wantsAuthPanel ? current ?? "login" : null,
      );
    };

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
    };
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
    // v1.5.69: poll 60s→20s + немедленная проверка при возврате на вкладку
    // (visibilitychange). Раньше после deploy баннер мог появиться только
    // через минуту — ревьюер видел устаревший bundle и думал «не пофикшено».
    const id = window.setInterval(check, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (view === "loading") return;

    if (view === "auth") {
      if (authSurface === null && parseLandingHash().wantsAuthPanel) {
        setAuthSurface("login");
      }
      return;
    }

    if (authSurface !== null) {
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

  // v1.6.83 — авто-обновление без прерывания: когда доступна новая версия,
  // тихо перезагружаемся в момент, когда пользователь уходит из приложения
  // (вкладка/окно скрыты) — активную работу не прерываем. Кнопка в баннере
  // остаётся для немедленного апдейта. Так Android-приложение само подтягивает
  // свежую версию без переустановки/очистки кэша.
  useEffect(() => {
    if (!updateAvailable) return;
    const onHidden = () => {
      if (document.visibilityState === "hidden") void hardReload();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
    // hardReload зависит только от наличия апдейта (внутри свой guard reloading).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateAvailable]);

  const isAuthenticated = view !== "loading" && view !== "auth" && user;

  const openAuthSurface = (mode: "login" | "register") => {
      clearError();
      setUnknownRoute(false);
      setAuthSurface(mode);
      replaceLandingHash(AUTH_PANEL_HASH);
    };

  const closeAuthSurface = () => {
    clearError();
    setAuthSurface(null);
    replaceLandingHash(null);
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
      {/* Version label — всегда показывает реально запущенную build-версию
          (CLIENT_VERSION via Vite define). Диагностика кэша + просто инфо.
          Если тут не последняя версия — браузер на устаревшем bundle. */}
      <div
        style={{
          position: "fixed",
          bottom: 5,
          right: 9,
          zIndex: 9998,
          fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
          fontSize: "0.62rem",
          letterSpacing: "0.04em",
          color: "var(--ec-text-dim)",
          opacity: 0.55,
          pointerEvents: "none",
          userSelect: "none",
        }}
        aria-hidden
      >
        v{CLIENT_VERSION}
      </div>
      {unknownRoute ? (
        <DeadlineNotFoundPage />
      ) : view === "loading" ? (
        <main style={loadingStyle}>Загрузка…</main>
      ) : !isAuthenticated ? (
        <LandingPage
          authMode={authSurface}
          onOpenAuth={openAuthSurface}
          onCloseAuth={closeAuthSurface}
          authError={error}
          onLogin={async (email, password) => {
            const r = await login(email, password);
            return r.success;
          }}
          onRegister={async (email, password, displayName) => {
            const r = await register(email, password, displayName);
            return r.success;
          }}
          authPanel={null}
        />
      ) : (
        /* v1.6.50 — Client Portal удалён; authenticated всегда = AppShell. */
        <Suspense fallback={<main style={loadingStyle}>Загрузка…</main>}>
          <AppShell user={user} socketRev={socketRev} onLogout={logout} />
        </Suspense>
      )}
    </>
  );
}
