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

// v0.81 #27 phase 2 PWA: register service worker (offline app shell +
// uploads cache). Регистрируем после window load, чтобы не блокировать
// initial render. Scope ограничен BASE_URL (path-based deploy в проде —
// `/eclipse-chat/`).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .catch((err) => {
        // SW регистрация optional — приложение работает без неё.
        // Логируем только в dev / debug.
        console.warn("[pwa] sw registration failed", err);
      });
  });
}
