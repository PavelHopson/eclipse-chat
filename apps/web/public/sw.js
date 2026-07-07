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

// v1.0: bumped per release для гарантированного refresh новых JS chunks.
// v1.5.30: PWA harden — bumped до текущей версии. Cache invalidation работает
// через name-prefix change → activate cleanup удаляет стары caches.
// v1.5.32: GitHub Actions trigger flake — пришлось ретригернуть push.
const SW_VERSION = "eclipse-v1.7.6";
const APP_SHELL_CACHE = `${SW_VERSION}-shell`;
const ASSETS_CACHE = `${SW_VERSION}-assets`;
const UPLOADS_CACHE = `${SW_VERSION}-uploads`;

// Префикс пути из manifest scope. Для path-based deploy
// (https://app.star-crm.ru/eclipse-chat/) registration scope = .registration.scope.
// Используем relative URLs — браузер их резолвит относительно SW location.
const SHELL_URLS = [
  "./",
  "./manifest.webmanifest",
  "./brand-mark.svg",
  "./favicon-32.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
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
  const url = new URL(req.url);

  // v1.5.37 — POST /share-target: Web Share Target Level 2 (files).
  // Browser POST'ит multipart/form-data сюда когда user share'ит фото/видео
  // в installed PWA. SW intercept'ит, сохраняет файлы в IDB, redirect'ит
  // на /?share-id=<uuid> где frontend пикапит из IDB.
  if (req.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(handleShareTargetPost(event.request));
    return;
  }

  if (req.method !== "GET") return;

  // Никогда не cache live API/socket — пропускаем в сеть.
  // /download/ — бинарники приложения (APK): тоже мимо SW (не кэшируем 3 МБ,
  // отдаёт nginx как есть → чистое скачивание).
  if (
    url.pathname.includes("/api/") ||
    url.pathname.includes("/socket.io") ||
    url.pathname.includes("/download/")
  ) {
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

/* ===== v0.84 #27 phase 3: Web Push notifications ===== */

/**
 * push event: показываем notification. Backend шлёт JSON payload
 * `{ title, body, url, tag?, icon? }` через web-push (encrypted).
 *
 * Если payload отсутствует / невалидный JSON — показываем generic
 * fallback. Это происходит когда server использует sendNotification
 * без payload (например, sync ping) — Web Push allows empty body.
 */
self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch (err) {
    data = null;
  }
  const title = (data && data.title) || "Eclipse Chat";
  const body = (data && data.body) || "Новое уведомление";
  const url = (data && data.url) || "/eclipse-chat/";
  const tag = (data && data.tag) || undefined;
  const icon = (data && data.icon) || "./icon-192.png";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "./favicon-32.png",
      tag,
      // renotify=true заставит OS повторить звук/вибрацию если tag тот же
      // (например, цепочка mention'ов в одном канале).
      renotify: Boolean(tag),
      data: { url },
    }),
  );
});

/* ===== v1.5.37: POST share_target — Web Share Target Level 2 (files) ===== */

/**
 * IDB helpers — простая key-value store "shares" для transport между SW
 * (intercepts POST) и main thread (читает на mount через useShareTarget).
 * Hand-rolled чтобы не тащить idb npm pkg в SW.
 */
const IDB_NAME = "eclipse-chat-shares";
const IDB_STORE = "shares";
const IDB_VERSION = 1;
const SHARE_TTL_MS = 10 * 60 * 1000; // 10 минут — share entry self-cleanup

function openShareIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutShare(id, payload) {
  const db = await openShareIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(payload, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Cleanup стары share entries (older than TTL). Вызывается при каждом
 * новом share — keeps IDB lean. Best-effort, errors swallowed.
 */
async function idbCleanupStaleShares() {
  try {
    const db = await openShareIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const now = Date.now();
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      const v = cursor.value;
      if (v && v.timestamp && now - v.timestamp > SHARE_TTL_MS) {
        cursor.delete();
      }
      cursor.continue();
    };
  } catch {
    /* IDB unavailable / quota / etc — non-fatal */
  }
}

async function handleShareTargetPost(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((f) => f instanceof File && f.size > 0);
    const title = formData.get("title") || null;
    const text = formData.get("text") || null;
    const url = formData.get("url") || null;

    const shareId = (self.crypto && self.crypto.randomUUID)
      ? self.crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Store payload в IDB — files как File objects (поддерживается IDB).
    await idbPutShare(shareId, {
      files,
      title: typeof title === "string" ? title : null,
      text: typeof text === "string" ? text : null,
      url: typeof url === "string" ? url : null,
      timestamp: Date.now(),
    });

    // Async cleanup стары shares — не ждём.
    idbCleanupStaleShares();

    // 303 See Other → browser GET на main URL с share-id parameter.
    // scope = /eclipse-chat/ в prod, / в dev — берём из registration.
    const base = self.registration.scope;
    return Response.redirect(`${base}?share-id=${encodeURIComponent(shareId)}`, 303);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[sw] share-target handler failed", err);
    return new Response("Share failed", { status: 500 });
  }
}

/**
 * notificationclick: focus existing tab или открываем новый.
 * `data.url` — relative path внутри /eclipse-chat/.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/eclipse-chat/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Ищем существующий tab с приложением, focus + postMessage с deep link.
      for (const client of allClients) {
        if (client.url.includes("/eclipse-chat/")) {
          if ("focus" in client) {
            await client.focus();
            // postMessage чтобы App.tsx мог обработать deep-link если нужно.
            try {
              client.postMessage({ type: "push:open", url: targetUrl });
            } catch (err) {
              /* ignore — client может не слушать */
            }
            return;
          }
        }
      }
      // Нет открытых клиентов — open new.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
