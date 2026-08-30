import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson, apiPath, refreshAccessToken } from "../lib/api";
import { clearAllTokens, getAccess, getRefresh, migrateLegacyToken, setTokenPair } from "../lib/storage";
import {
  ACCOUNT_VAULT_EVENT,
  activateStoredAccount,
  getActiveAccountId,
  listStoredAccounts,
  persistCurrentSessionFor,
  removeStoredAccount,
  restoreActiveAccountTokens,
  upsertAccountSession,
  updateStoredAccountUser,
  type StoredAccount,
} from "../lib/accountVault";

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
  const [accounts, setAccounts] = useState<StoredAccount[]>(() => listStoredAccounts());
  const clearError = useCallback(() => setError(null), []);

  /** Пересоздание Socket после смены access-токена. */
  const [socketRev, setSocketRev] = useState(0);
  const bumpSocketRev = useCallback(() => setSocketRev((v) => v + 1), []);

  /** Загрузка текущего user'а — при boot и после login. */
  const loadMe = useCallback(async () => {
    migrateLegacyToken();
    if (!getAccess() && !getRefresh()) restoreActiveAccountTokens();
    if (!getAccess() && !getRefresh()) {
      setView("auth");
      return;
    }
    try {
      const data = await apiJson<{ user: PublicUser | null }>("/api/auth/me");
      if (data.user) {
        setUser(data.user);
        setAccounts(persistCurrentSessionFor(data.user));
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

  useEffect(() => {
    const sync = () => setAccounts(listStoredAccounts());
    window.addEventListener(ACCOUNT_VAULT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACCOUNT_VAULT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

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
          if (acc && data.refreshToken) {
            setAccounts(upsertAccountSession(data.user, acc, data.refreshToken));
          }
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
          const message = data.error ?? "Ошибка регистрации";
          setError(message);
          return { success: false, error: message };
        }
        const acc = data.accessToken ?? data.token;
        if (acc && data.refreshToken) {
          setTokenPair(acc, data.refreshToken);
        }
        if (data.user) {
          setUser(data.user);
          if (acc && data.refreshToken) {
            setAccounts(upsertAccountSession(data.user, acc, data.refreshToken));
          }
        }
        setView("app");
        bumpSocketRev();
        return { success: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Сетевая ошибка";
        setError(message);
        return { success: false, error: message };
      }
    },
    [bumpSocketRev],
  );

  const logout = useCallback(async () => {
    const activeAccountId = user?.id ?? getActiveAccountId();
    let refreshToken = getRefresh();
    let accessToken = getAccess();
    if (accessToken && refreshToken) {
      try {
        let response = await fetch(apiPath("api/auth/logout"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
        });
        if (response.status === 401) {
          await refreshAccessToken();
          accessToken = getAccess();
          refreshToken = getRefresh();
          if (accessToken && refreshToken) {
            response = await fetch(apiPath("api/auth/logout"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ refreshToken }),
            });
          }
        }
      } catch {
        /* logout best-effort — даже если backend упал, локально чистим */
      }
    }
    const remaining = activeAccountId ? removeStoredAccount(activeAccountId) : [];
    setAccounts(remaining);
    const next = remaining[0] ? activateStoredAccount(remaining[0].id) : null;
    if (next) {
      setUser(next.user);
      setView("app");
    } else {
      clearAllTokens();
      setUser(null);
      setView("auth");
    }
    bumpSocketRev();
  }, [bumpSocketRev, user?.id]);

  const switchAccount = useCallback(async (accountId: string): Promise<boolean> => {
    if (accountId === user?.id) return true;
    const previousId = user?.id ?? getActiveAccountId();
    const next = activateStoredAccount(accountId);
    if (!next) return false;
    setError(null);
    try {
      const data = await apiJson<{ user: PublicUser | null }>("/api/auth/me");
      if (!data.user || data.user.id !== accountId) throw new Error("Сессия аккаунта истекла");
      setUser(data.user);
      setAccounts(updateStoredAccountUser(data.user));
      setView("app");
      bumpSocketRev();
      return true;
    } catch (cause) {
      removeStoredAccount(accountId);
      if (previousId) activateStoredAccount(previousId);
      setAccounts(listStoredAccounts());
      setError(cause instanceof Error ? cause.message : "Не удалось переключить аккаунт");
      return false;
    }
  }, [bumpSocketRev, user?.id]);

  const forgetAccount = useCallback(async (accountId: string) => {
    if (accountId === user?.id) {
      await logout();
      return;
    }
    setAccounts(removeStoredAccount(accountId));
  }, [logout, user?.id]);

  return {
    view,
    user,
    error,
    login,
    register,
    logout,
    accounts,
    switchAccount,
    forgetAccount,
    socketRev,
    bumpSocketRev,
    clearError,
  };
}
