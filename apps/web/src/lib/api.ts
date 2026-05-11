/**
 * Fetch wrapper с auto-refresh при 401.
 *
 * Если access истёк — пытается обновить refresh (single-flight: одновременные
 * запросы делят одну refresh-операцию через `inFlightRefresh`), сохраняет
 * новую пару токенов, повторяет оригинальный запрос.
 *
 * Возвращает Response. Парсинг JSON — на стороне caller'а.
 *
 * **Base path:** все пути префиксятся `import.meta.env.BASE_URL` (всегда
 * заканчивается `/`). По умолчанию это `/`, при `VITE_BASE_PATH=/eclipse-chat/`
 * — `/eclipse-chat/`. Caller передаёт path **без** ведущего слэша:
 * `apiPath("api/auth/login")` → `/eclipse-chat/api/auth/login`.
 */

import { clearAllTokens, getAccess, getRefresh, setTokenPair } from "./storage";

/** Префиксует path значением BASE_URL. Caller передаёт `api/auth/login` без leading `/`. */
export function apiPath(path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${cleanPath}`;
}

let inFlightRefresh: Promise<string | null> | null = null;

/** На какие revisions реагировать (для пересоздания Socket после refresh). */
type RefreshListener = () => void;
const refreshListeners = new Set<RefreshListener>();

export function onTokenRefresh(listener: RefreshListener): () => void {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}

function notifyRefresh(): void {
  for (const fn of refreshListeners) {
    try {
      fn();
    } catch {
      /* listener bug — не должен ломать refresh */
    }
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  const refreshTok = getRefresh();
  if (!refreshTok) {
    return null;
  }
  inFlightRefresh = (async () => {
    try {
      const res = await fetch(apiPath("api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refreshTok }),
      });
      if (!res.ok) {
        clearAllTokens();
        return null;
      }
      const data = (await res.json()) as {
        accessToken?: string;
        token?: string;
        refreshToken: string;
      };
      const access = data.accessToken ?? data.token;
      if (!access) {
        clearAllTokens();
        return null;
      }
      setTokenPair(access, data.refreshToken);
      notifyRefresh();
      return access;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

/**
 * Авторизованный fetch:
 *  - добавляет `Authorization: Bearer <access>` если есть access
 *  - на 401 пытается refresh + повтор один раз
 *  - возвращает Response; вызывающий парсит body сам
 */
export async function api(path: string, init?: RequestInit): Promise<Response> {
  const build = (access: string | null) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }
    if (access) {
      headers.set("Authorization", `Bearer ${access}`);
    }
    return fetch(apiPath(path), { ...init, headers });
  };

  const access0 = getAccess();
  let res = await build(access0);
  if (res.status !== 401) {
    return res;
  }
  const refreshTok = getRefresh();
  if (!refreshTok) {
    return res;
  }
  const next = await refreshAccessToken();
  if (!next) {
    return res;
  }
  return build(next);
}

/** JSON-вариант api(): кидает Error если не ok, возвращает разобранный body. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      /* non-json body */
    }
    const message =
      (detail && typeof detail === "object" && "error" in detail && typeof (detail as { error: unknown }).error === "string"
        ? (detail as { error: string }).error
        : null) ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status, detail);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
