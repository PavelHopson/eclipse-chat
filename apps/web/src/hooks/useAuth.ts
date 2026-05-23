import { useCallback, useEffect, useState } from "react";
import { ApiError, api, apiJson, apiPath } from "../lib/api";
import {
  clearAllTokens,
  getAccess,
  getRefresh,
  migrateLegacyToken,
  setTokenPair,
} from "../lib/storage";

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
  /** v1.2.6 Platform Admin (trek P1) — флаг владельца платформы.
   *  По нему фронт показывает иконку Platform Admin в топбаре.
   *  По умолчанию false. */
  isPlatformOwner?: boolean;
};

type AuthResponse = {
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  user?: PublicUser;
};

type LoginResult = { success: boolean; needs2FA?: boolean; error?: string };
type RegisterResult = { success: boolean; error?: string };

export type AuthView = "loading" | "auth" | "app";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function authErrorMessage(
  kind: "login" | "register",
  status: number,
  fallback?: string,
): string {
  if (fallback) return fallback;
  if (status === 409) return "Этот email уже зарегистрирован.";
  if (status === 429) {
    return "Слишком много попыток. Подождите и попробуйте снова.";
  }
  if (status >= 500) {
    return kind === "register"
      ? "Регистрация временно недоступна. Попробуйте позже."
      : "Сервис входа временно недоступен. Попробуйте позже.";
  }
  return kind === "register"
    ? "Не удалось создать аккаунт. Проверьте данные и попробуйте снова."
    : "Не удалось войти. Проверьте email и пароль.";
}

function transportErrorMessage(kind: "login" | "register", error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return kind === "register"
        ? "Не удалось связаться с сервером регистрации. Проверьте соединение и попробуйте снова."
        : "Не удалось связаться с сервером входа. Проверьте соединение и попробуйте снова.";
    }
    return error.message;
  }
  return "Сетевая ошибка";
}

export function useAuth() {
  const [view, setView] = useState<AuthView>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socketRev, setSocketRev] = useState(0);
  const bumpSocketRev = useCallback(() => setSocketRev((v) => v + 1), []);

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
        setView("auth");
      }
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      opts?: { totpCode?: string; recoveryCode?: string },
    ): Promise<LoginResult> => {
      setError(null);

      try {
        const body: Record<string, unknown> = {
          email: normalizeEmail(email),
          password,
        };
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
          const message = authErrorMessage("login", res.status, data.error);
          setError(message);
          return {
            success: false,
            needs2FA: Boolean(data.twoFactorRequired),
            error: message,
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
        const message = transportErrorMessage("login", e);
        setError(message);
        return { success: false, error: message };
      }
    },
    [bumpSocketRev],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
    ): Promise<RegisterResult> => {
      setError(null);

      try {
        const res = await fetch(apiPath("api/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizeEmail(email),
            password,
            displayName: displayName.trim() || "User",
          }),
        });

        const data = (await res.json().catch(() => ({}))) as AuthResponse & {
          error?: string;
        };

        if (!res.ok) {
          const message = authErrorMessage("register", res.status, data.error);
          setError(message);
          return { success: false, error: message };
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
        const message = transportErrorMessage("register", e);
        setError(message);
        return { success: false, error: message };
      }
    },
    [bumpSocketRev],
  );

  const logout = useCallback(async () => {
    if (getAccess()) {
      try {
        await api("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({}),
        });
      } catch {
        // Logout best-effort: локально токены всё равно очищаем.
      }
    }

    clearAllTokens();
    setUser(null);
    setView("auth");
    bumpSocketRev();
  }, [bumpSocketRev]);

  return { view, user, error, login, register, logout, socketRev, bumpSocketRev };
}
