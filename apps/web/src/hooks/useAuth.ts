import { useCallback, useEffect, useState } from "react";
import { ApiError, api, apiJson, apiPath } from "../lib/api";
import { clearAllTokens, getAccess, getRefresh, migrateLegacyToken, setTokenPair } from "../lib/storage";

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
};

type AuthResponse = {
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  user?: PublicUser;
};

export type AuthView = "loading" | "auth" | "app";

/**
 * Глобальный auth-стейт: текущий user, view (loading/auth/app), действия
 * login/register/logout.
 *
 * Используется в App.tsx один раз через useAuth() и пробрасывается дальше
 * через props (не Context — у нас один потребитель, AppShell).
 */
export function useAuth() {
  const [view, setView] = useState<AuthView>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Пересоздание Socket после смены access-токена. */
  const [socketRev, setSocketRev] = useState(0);
  const bumpSocketRev = useCallback(() => setSocketRev((v) => v + 1), []);

  /** Загрузка текущего user'а — при boot и после login. */
  const loadMe = useCallback(async () => {
    migrateLegacyToken();
    if (!getAccess() && !getRefresh()) {
      setView("auth");
      return;
    }
    try {
      const data = await apiJson<{ user: PublicUser | null }>("/api/auth/me");
      if (data.user) {
        setUser(data.user);
        setView("app");
      } else {
        clearAllTokens();
        setUser(null);
        setView("auth");
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        clearAllTokens();
        setUser(null);
        setView("auth");
      } else {
        /* сетевая ошибка — оставляем loading; UI покажет общую ошибку отдельно */
        setView("auth");
      }
    }
  }, []);

  /** Boot: один раз при mount. */
  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      opts?: { totpCode?: string; recoveryCode?: string },
    ): Promise<{ success: boolean; needs2FA?: boolean }> => {
      setError(null);
      try {
        const body: Record<string, unknown> = { email, password };
        if (opts?.totpCode) body.totpCode = opts.totpCode;
        if (opts?.recoveryCode) body.recoveryCode = opts.recoveryCode;
        const res = await fetch(apiPath("api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as AuthResponse & {
          error?: string;
          twoFactorRequired?: boolean;
        };
        if (!res.ok) {
          setError(data.error ?? "Ошибка входа");
          return {
            success: false,
            needs2FA: Boolean(data.twoFactorRequired),
          };
        }
        const acc = data.accessToken ?? data.token;
        if (acc && data.refreshToken) {
          setTokenPair(acc, data.refreshToken);
        }
        if (data.user) {
          setUser(data.user);
        }
        setView("app");
        bumpSocketRev();
        return { success: true };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Сетевая ошибка");
        return { success: false };
      }
    },
    [bumpSocketRev],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setError(null);
      try {
        const res = await fetch(apiPath("api/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName: displayName || "User" }),
        });
        const data = (await res.json().catch(() => ({}))) as AuthResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Ошибка регистрации");
          return false;
        }
        const acc = data.accessToken ?? data.token;
        if (acc && data.refreshToken) {
          setTokenPair(acc, data.refreshToken);
        }
        if (data.user) {
          setUser(data.user);
        }
        setView("app");
        bumpSocketRev();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Сетевая ошибка");
        return false;
      }
    },
    [bumpSocketRev],
  );

  const logout = useCallback(async () => {
    if (getAccess()) {
      try {
        await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
      } catch {
        /* logout best-effort — даже если backend упал, локально чистим */
      }
    }
    clearAllTokens();
    setUser(null);
    setView("auth");
    bumpSocketRev();
  }, [bumpSocketRev]);

  return { view, user, error, login, register, logout, socketRev, bumpSocketRev };
}
