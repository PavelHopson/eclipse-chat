import { useEffect, useState } from "react";

/**
 * NativeApkBanner (v1.6.85) — баннер «доступна новая версия приложения» для
 * Android-оболочки (Capacitor remote-load). Сравнивает версию установленного
 * APK (`App.getInfo().version`) с последним android-релизом на GitHub; если на
 * GitHub новее — показывает баннер со ссылкой на свежий `.apk`.
 *
 * Доступ к Capacitor — через инжектируемый нативной оболочкой `window.Capacitor`
 * (веб НЕ бандлит `@capacitor/*`, т.к. remote-load). В браузере/без плагина —
 * рендерит null. Веб-контент и так авто-обновляется (см. App.tsx); этот баннер —
 * только про обновление самой ОБОЛОЧКИ (нативные плагины, иконка и т.п.).
 */

type AppInfo = { version: string; build: string };
type Bridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { App?: { getInfo?: () => Promise<AppInfo> } };
};
function bridge(): Bridge | undefined {
  return (window as unknown as { Capacitor?: Bridge }).Capacitor;
}

const REPO = "PavelHopson/eclipse-chat";

/** semver-ish сравнение "1.0.2" vs "1.0.10" → положит. если a>b. */
function cmp(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function NativeApkBanner() {
  const [upd, setUpd] = useState<{ version: string; url: string } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const b = bridge();
    const app = b?.Plugins?.App;
    if (!b?.isNativePlatform?.() || b.getPlatform?.() !== "android" || !app?.getInfo) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const info = await app.getInfo!();
        const installed = info.version;
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/releases?per_page=30`,
          { headers: { Accept: "application/vnd.github+json" } },
        );
        if (!res.ok || cancelled) return;
        const rels = (await res.json()) as Array<{
          tag_name: string;
          assets: Array<{ name: string; browser_download_url: string }>;
        }>;
        const androids = rels
          .filter((r) => r.tag_name.startsWith("android-v"))
          .map((r) => ({ ver: r.tag_name.slice("android-v".length), assets: r.assets }))
          .sort((x, y) => cmp(y.ver, x.ver));
        const latest = androids[0];
        if (!latest || cancelled) return;
        if (cmp(latest.ver, installed) > 0) {
          const apk = latest.assets.find((a) => a.name.toLowerCase().endsWith(".apk"));
          if (apk) setUpd({ version: latest.ver, url: apk.browser_download_url });
        }
      } catch {
        /* offline / rate-limit — тихо */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!upd || hidden) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(var(--ec-bottomnav-height, 56px) + 12px)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "var(--ec-surface-2)",
        border: "1px solid var(--ec-accent)",
        borderRadius: "var(--ec-radius-lg, 12px)",
        boxShadow: "0 8px 32px hsl(210 40% 2% / 0.5)",
        maxWidth: 560,
        margin: "0 auto",
        fontSize: 14,
        color: "var(--ec-text)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        Доступна новая версия приложения · v{upd.version}
      </span>
      <button
        type="button"
        className="ec-btn ec-btn--primary ec-btn--sm"
        onClick={() => window.open(upd.url, "_blank", "noopener,noreferrer")}
      >
        Обновить
      </button>
      <button
        type="button"
        aria-label="Скрыть"
        className="ec-icon-btn"
        onClick={() => setHidden(true)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
