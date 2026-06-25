import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// v1.6.97 — прячем нативный сплеш (Android-оболочка, @capacitor/splash-screen)
// как только веб смонтирован → сплеш не висит лишнее. В браузере — no-op
// (мост window.Capacitor не инжектится). Конфиг launchAutoHide=true страхует.
(() => {
  const cap = (
    window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: { SplashScreen?: { hide?: () => void } };
      };
    }
  ).Capacitor;
  if (cap?.isNativePlatform?.() && cap.Plugins?.SplashScreen?.hide) {
    requestAnimationFrame(() => cap.Plugins?.SplashScreen?.hide?.());
  }
})();

// v0.81 #27 phase 2 PWA: register service worker (offline app shell +
// uploads cache). Регистрируем после window load, чтобы не блокировать
// initial render. Scope ограничен BASE_URL (path-based deploy в проде —
// `/eclipse-chat/`).
//
// v1.1.15: добавлен периодический `registration.update()` каждые 60s.
// Без него mobile Chrome мог НЕ перепроверять sw.js неделями (особенно
// если вкладка живёт долго без navigation) — новый SW-код не доезжал,
// пользователь застревал на старом bundle. update() форсит re-fetch
// sw.js; если байты изменились — новый SW устанавливается в фоне
// (skipWaiting + clients.claim уже в sw.js). App.tsx version-banner
// ловит mismatch и предлагает hard reload.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        // Сразу + периодически перепроверяем sw.js на новую версию.
        registration.update().catch(() => undefined);
        window.setInterval(() => {
          registration.update().catch(() => undefined);
        }, 60_000);
      })
      .catch((err) => {
        // SW регистрация optional — приложение работает без неё.
        // Логируем только в dev / debug.
        console.warn("[pwa] sw registration failed", err);
      });
  });
}
