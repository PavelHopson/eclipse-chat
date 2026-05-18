/* eslint-disable no-undef */
/**
 * Eclipse Chat — service worker (v0.81 #27 phase 2 PWA).
 *
 * Стратегия:
 *   - **install**: pre-cache app shell (HTML + manifest + branding SVGs).
 *   - **fetch**:
 *     - /api/* и /socket.io/* → network-only (live data, никогда не cache).
 *     - /uploads/* → cache-first (immutable файлы — attachment URLs хэшированы
 *       по timestamp + sanitized name, не меняются).
 *     - GET HTML navigation → network-first с fallback на cached shell
 *       (offline page). Это даёт moderate offline UX — пользователь видит
 *       приложение, не «no internet» browser error, при потере сети после
 *       первого захода.
 *     - Прочие GET static → stale-while-revalidate.
 *   - **activate**: чистим старые кэши.
 *
 * Version bump в SW_VERSION гарантирует invalidate стары кэшей при deploy.
 */

const SW_VERSION = "eclipse-v0.81";
const APP_SHELL_CACHE = `${SW_VERSION}-shell`;
const ASSETS_CACHE = `${SW_VERSION}-assets`;
const UPLOADS_CACHE = `${SW_VERSION}-uploads`;

// Префикс пути из manifest scope. Для path-based deploy
// (https://app.star-crm.ru/eclipse-chat/) registration scope = .registration.scope.
// Используем relative URLs — браузер их резолвит относительно SW location.
const SHELL_URLS = [
  "./",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./apple-touch-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      try {
        await cache.addAll(SHELL_URLS);
      } catch (err) {
        // index.html может быть protected (rare), не fatal — main JS подтянет
        // SW lazily; пользователь всё равно сможет загрузить приложение online.
        // Лог в SW console для диагностики.
        // eslint-disable-next-line no-console
        console.warn("[sw] shell precache partial fail", err);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => !n.startsWith(SW_VERSION))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Никогда не cache live API/socket — пропускаем в сеть.
  if (url.pathname.includes("/api/") || url.pathname.includes("/socket.io")) {
    return;
  }

  // Uploads: cache-first. Файлы immutable (hashed names + timestamp).
  if (url.pathname.includes("/uploads/")) {
    event.respondWith(cacheFirst(req, UPLOADS_CACHE));
    return;
  }

  // HTML navigation: network-first, fallback на cached shell.
  const accept = req.headers.get("accept") ?? "";
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(navigationStrategy(req));
    return;
  }

  // Прочие static GET — stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, ASSETS_CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return new Response("", { status: 504, statusText: "offline" });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached ?? (await networkPromise) ?? new Response("", { status: 504 });
}

async function navigationStrategy(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put("./", res.clone()).catch(() => undefined);
    }
    return res;
  } catch (err) {
    const cache = await caches.open(APP_SHELL_CACHE);
    const cached = (await cache.match("./")) ?? (await cache.match(req));
    if (cached) return cached;
    return new Response(
      "<h1>Offline</h1><p>Нет соединения. Откройте приложение когда сеть появится снова.</p>",
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}
