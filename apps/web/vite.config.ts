import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// v1.1.2: embedded version из package.json для client-side
// version-mismatch detection (App.tsx → /api/version compare).
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8"),
) as { version: string };

/**
 * Base path для деплоя.
 *
 * - Default (`/`) — local dev, `npm run dev:web` → http://localhost:5173/
 * - Path-based deploy — установить `VITE_BASE_PATH=/eclipse-chat/`
 *   (нужно если фронт лежит под-путём на чужом домене, как у нас на
 *   Star CRM сервере). Тогда все ассеты, API-запросы и Socket.io
 *   автоматически получат правильный prefix.
 *
 * BASE_URL **обязан** заканчиваться слэшем (Vite convention) — иначе
 * `${BASE_URL}api/...` будет давать `api/...` без `/`.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_PATH ?? "/";

  if (!base.endsWith("/")) {
    throw new Error(
      `VITE_BASE_PATH must end with '/' (got '${base}'). Example: VITE_BASE_PATH=/eclipse-chat/`,
    );
  }

  // Proxy в dev: backend всё ещё слушает на /api и /socket.io (он не
  // знает про base path). Если base != "/", нужно проксить
  // /eclipse-chat/api → /api с rewrite, чтобы локальный dev совпадал
  // с продом по поведению.
  const apiPrefix = base === "/" ? "/api" : `${base.slice(0, -1)}/api`;
  const socketPrefix = base === "/" ? "/socket.io" : `${base.slice(0, -1)}/socket.io`;
  const uploadsPrefix = base === "/" ? "/uploads" : `${base.slice(0, -1)}/uploads`;

  const proxy: Record<string, import("vite").ProxyOptions> = {
    [apiPrefix]: {
      target: "http://127.0.0.1:3001",
      changeOrigin: true,
      ws: true,
      rewrite: base === "/" ? undefined : (path) => path.replace(base.slice(0, -1), ""),
    },
    [socketPrefix]: {
      target: "http://127.0.0.1:3001",
      changeOrigin: true,
      ws: true,
      rewrite: base === "/" ? undefined : (path) => path.replace(base.slice(0, -1), ""),
    },
    // Аватарки: в dev отдаёт Fastify (@fastify/static на /uploads/).
    // В prod nginx перехватывает /eclipse-chat/uploads/ через alias.
    [uploadsPrefix]: {
      target: "http://127.0.0.1:3001",
      changeOrigin: true,
      rewrite: base === "/" ? undefined : (path) => path.replace(base.slice(0, -1), ""),
    },
  };

  return {
    base,
    plugins: [react()],
    define: {
      __ECLIPSE_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      port: 5173,
      proxy,
    },
  };
});
