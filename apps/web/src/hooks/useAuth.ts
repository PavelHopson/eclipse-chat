import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_PROTOCOL_HEADER, CLIENT_UPDATE_EVENT, ClientUpdateRequiredError, SessionUpgradeRequiredError, ApiError, apiJsonForAuth, apiPath, assertClientCanRequest, enforceClientUpdate, isClientUpdateRequired, onTokenRefresh } from "../lib/api";
import { AUTH_STATE_KEY, AuthStateChangedError, bindAuthScreenIdentity, bindDisplayedIdentity, captureAuth, captureAuthScreen, captureDisplayedAuth, hasLegacyAccountData, identityCurrent, initializeAuthStore } from "../lib/storage";
import { activateStoredAccount, finishLogout, listStoredAccounts, removeStoredAccount, restoreSelectionIfCurrent, updateStoredAccountUser, upsertAccountSession, type StoredAccount } from "../lib/accountVault";

export type PublicUser = { id: string; email: string; displayName: string; avatar: string | null; bio: string | null; createdAt: string; isPlatformOwner?: boolean };
type AuthResponse = { accessToken?: string; refreshToken?: string; token?: string; user?: PublicUser };
export type AuthView = "loading" | "auth" | "app";

export function useAuth() {
  const [view, setView] = useState<AuthView>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [socketRev, setSocketRev] = useState(0);
  const selected = useRef<number | null>(null);
  const clearError = useCallback(() => setError(null), []);
  const bumpSocketRev = useCallback(() => setSocketRev((v) => v + 1), []);
  const loadMe = useCallback(async () => {
    let intent: ReturnType<typeof captureAuth>["identity"] | null = null;
    try {
      await initializeAuthStore();
      const snapshot = captureAuth();
      intent = snapshot.identity;
      selected.current = snapshot.identity.revision;
      setAccounts(listStoredAccounts());
      if (!snapshot.account) { bindAuthScreenIdentity(snapshot.identity); setUser(null); setView("auth"); return { ok: false as const, error: "Аккаунт не выбран" }; }
      const data = await apiJsonForAuth<{ user: PublicUser | null }>(snapshot.identity, "api/auth/me");
      if (!identityCurrent(snapshot.identity)) return { ok: false as const, error: "Аккаунт изменился. Повторите действие." };
      if (!data.user || data.user.id !== snapshot.account.id) throw new ApiError("Сессия аккаунта недоступна", 401, null);
      await updateStoredAccountUser(data.user, snapshot.identity);
      if (!identityCurrent(snapshot.identity)) return { ok: false as const, error: "Аккаунт изменился. Повторите действие." };
      bindDisplayedIdentity(snapshot.identity); setUser(data.user); setAccounts(listStoredAccounts()); setView("app");
      return { ok: true as const };
    } catch (cause) {
      if (cause instanceof AuthStateChangedError || (intent && !identityCurrent(intent))) return { ok: false as const, error: "Аккаунт изменился. Повторите действие." };
      if (intent) bindAuthScreenIdentity(intent); else bindDisplayedIdentity(null);
      setUser(null); setView("auth");
      const message = cause instanceof SessionUpgradeRequiredError ? cause.message : intent?.accountId ? (cause instanceof ApiError && (cause.status === 401 || cause.status === 403) ? "Сессию не удалось подтвердить. Повторите вход." : "Профиль не удалось проверить. Сессия сохранена; проверьте соединение и повторите вход.") : cause instanceof Error ? cause.message : "Не удалось проверить вход";
      setError(message);
      return { ok: false as const, error: message };
    }
  }, []);
  useEffect(() => { void loadMe(); }, [loadMe]);
  useEffect(() => onTokenRefresh(bumpSocketRev), [bumpSocketRev]);
  useEffect(() => {
    const expired = () => {
      if (!isClientUpdateRequired()) setError("Не удалось обновить вход. Проверьте соединение или войдите снова.");
    };
    window.addEventListener("ec:socket-auth-expired", expired);
    return () => window.removeEventListener("ec:socket-auth-expired", expired);
  }, []);
  useEffect(() => {
    // Keep the current screen and drafts mounted, while disconnecting the socket.
    const requireUpdate = () => { bindDisplayedIdentity(null); bumpSocketRev(); };
    window.addEventListener(CLIENT_UPDATE_EVENT, requireUpdate);
    return () => window.removeEventListener(CLIENT_UPDATE_EVENT, requireUpdate);
  }, [bumpSocketRev]);
  useEffect(() => {
    const showWarning = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail === "string") setError(detail);
    };
    window.addEventListener("ec:auth-warning", showWarning);
    return () => window.removeEventListener("ec:auth-warning", showWarning);
  }, []);
  useEffect(() => {
    const changed = () => { bindDisplayedIdentity(null); setUser(null); setView("loading"); bumpSocketRev(); void loadMe(); };
    window.addEventListener("ec:auth-password-changed", changed);
    return () => window.removeEventListener("ec:auth-password-changed", changed);
  }, [bumpSocketRev, loadMe]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== AUTH_STATE_KEY && event.key !== null) return;
      try {
        const snapshot = captureAuth();
        setAccounts(listStoredAccounts());
        bumpSocketRev();
        if (snapshot.identity.revision !== selected.current) {
          selected.current = snapshot.identity.revision;
          bindDisplayedIdentity(null); setUser(null); setView("loading");
          void loadMe();
        }
      } catch { setUser(null); setView("auth"); setError("Не удалось безопасно синхронизировать аккаунты"); }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [bumpSocketRev, loadMe]);

  const login = useCallback(async (email: string, password: string, opts?: { totpCode?: string; recoveryCode?: string }): Promise<{ success: boolean; needs2FA?: boolean; error?: string }> => {
    setError(null);
    let sessionMayExist = false;
    try {
      assertClientCanRequest();
      const expected = (view === "auth" ? captureAuthScreen() : captureDisplayedAuth()).identity;
      const body: Record<string, unknown> = { email, password, ...opts };
      sessionMayExist = true; // request may have committed even if its response is lost
      const res = await fetch(apiPath("api/auth/login"), { method: "POST", headers: { "Content-Type": "application/json", [AUTH_PROTOCOL_HEADER]: "2" }, body: JSON.stringify(body) });
      await enforceClientUpdate(res, () => { if (!identityCurrent(expected)) throw new AuthStateChangedError(); });
      if (res.status >= 400 && res.status < 500) sessionMayExist = false;
      const data = await res.json().catch(() => ({})) as AuthResponse & { error?: string; twoFactorRequired?: boolean };
      if (!identityCurrent(expected)) throw new AuthStateChangedError();
      if (!res.ok) { if (sessionMayExist) throw new Error("Неизвестный исход входа"); const message = data.error ?? "Ошибка входа"; setError(message); return { success: false, needs2FA: Boolean(data.twoFactorRequired), error: message }; }
      const access = data.accessToken ?? data.token;
      if (!access || !data.refreshToken || !data.user) throw new Error("Сервер вернул неполную сессию");
      await upsertAccountSession(data.user, access, data.refreshToken, expected);
      sessionMayExist = false; // locally associated with the exact intended account
      bumpSocketRev(); const verified = await loadMe(); return verified.ok ? { success: true } : { success: false, error: verified.error };
    } catch (cause) {
      const message = cause instanceof ClientUpdateRequiredError ? cause.message : sessionMayExist ? "Вход не завершён на устройстве, но сервер мог создать сеанс. Проверьте активные сеансы аккаунта." : cause instanceof Error ? cause.message : "Сетевая ошибка";
      setError(message); return { success: false, error: message };
    }
  }, [bumpSocketRev, loadMe, view]);
  const register = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    let sessionMayExist = false;
    try {
      assertClientCanRequest();
      const expected = (view === "auth" ? captureAuthScreen() : captureDisplayedAuth()).identity;
      sessionMayExist = true; // registration/session outcome is uncertain after network loss
      const res = await fetch(apiPath("api/auth/register"), { method: "POST", headers: { "Content-Type": "application/json", [AUTH_PROTOCOL_HEADER]: "2" }, body: JSON.stringify({ email, password, displayName: displayName || "User" }) });
      await enforceClientUpdate(res, () => { if (!identityCurrent(expected)) throw new AuthStateChangedError(); });
      if (res.status >= 400 && res.status < 500) sessionMayExist = false;
      const data = await res.json().catch(() => ({})) as AuthResponse & { error?: string };
      if (!identityCurrent(expected)) throw new AuthStateChangedError();
      if (!res.ok) throw new Error(data.error ?? "Ошибка регистрации");
      const access = data.accessToken ?? data.token;
      if (!access || !data.refreshToken || !data.user) throw new Error("Сервер вернул неполную сессию");
      await upsertAccountSession(data.user, access, data.refreshToken, expected);
      sessionMayExist = false;
      bumpSocketRev(); const verified = await loadMe(); return verified.ok ? { success: true } : { success: false, error: verified.error };
    } catch (cause) {
      const message = cause instanceof ClientUpdateRequiredError ? cause.message : sessionMayExist ? "Регистрация не завершена на устройстве, но сервер мог создать аккаунт и сеанс. Попробуйте войти и проверьте активные сеансы." : cause instanceof Error ? cause.message : "Сетевая ошибка";
      setError(message); return { success: false, error: message };
    }
  }, [bumpSocketRev, loadMe, view]);
  const logout = useCallback(async () => {
    const capture = captureDisplayedAuth();
    if (!capture.account) return;
    let confirmed = false;
    try {
      let account = capture.account;
      let response = await fetch(apiPath("api/auth/logout"), { method: "POST", headers: { "Content-Type": "application/json", [AUTH_PROTOCOL_HEADER]: "2", Authorization: `Bearer ${account.accessToken}` }, body: JSON.stringify({ refreshToken: account.refreshToken }) });
      if (response.status === 426) await enforceClientUpdate(response, () => { if (!identityCurrent(capture.identity)) throw new AuthStateChangedError(); });
      if (response.status === 401) {
        if (identityCurrent(capture.identity)) setError("Выход на сервере не подтверждён. Обновите вход и повторите действие.");
        return; // Never replay a mutating request or discard its session on 401.
      }
      confirmed = response.ok;
    } catch (cause) {
      if (cause instanceof ClientUpdateRequiredError || cause instanceof SessionUpgradeRequiredError || cause instanceof AuthStateChangedError) {
        if (identityCurrent(capture.identity)) setError(cause.message);
        return; // Gate/reselection must never delete or switch a stored account.
      }
      /* The server outcome can be unknown. */
    }
    const result = await finishLogout(capture.identity, confirmed);
    setAccounts(result.accounts);
    if (result.activeChanged) { bindDisplayedIdentity(null); bumpSocketRev(); setUser(null); setView("loading"); await loadMe(); }
    if (!confirmed) setError("Выход на сервере не подтверждён. Проверьте активные сеансы аккаунта.");
  }, [bumpSocketRev, loadMe]);
  const switchAccount = useCallback(async (accountId: string): Promise<boolean> => {
    const previous = captureDisplayedAuth();
    if (accountId === previous.identity.accountId) return true;
    const next = await activateStoredAccount(accountId);
    if (!next) return false;
    const expected = next.selectionIdentity;
    if (!identityCurrent(expected)) return false;
    bindDisplayedIdentity(null); setError(null); setUser(null); setView("loading"); bumpSocketRev();
    try {
      const data = await apiJsonForAuth<{ user: PublicUser | null }>(expected, "api/auth/me");
      if (!data.user || data.user.id !== accountId) throw new Error("Сессия аккаунта истекла");
      await updateStoredAccountUser(data.user, expected);
      if (!identityCurrent(expected)) throw new AuthStateChangedError();
      selected.current = expected.revision; bindDisplayedIdentity(expected); setUser(data.user); setAccounts(listStoredAccounts()); setView("app"); return true;
    } catch (cause) {
      const restored = await restoreSelectionIfCurrent(expected, previous.identity.accountId);
      if (restored) { await loadMe(); setError(cause instanceof Error ? cause.message : "Не удалось переключить аккаунт"); }
      return false;
    }
  }, [bumpSocketRev, loadMe]);
  const forgetAccount = useCallback(async (accountId: string) => {
    if (hasLegacyAccountData(accountId)) {
      setError("Удаление аккаунта отложено: в старой версии сохранены данные входа. Сначала завершите старые сеансы.");
      return;
    }
    const capture = captureDisplayedAuth();
    if (accountId === capture.identity.accountId) { await logout(); return; }
    const account = listStoredAccounts().find((a) => a.id === accountId);
    if (account) setAccounts(await removeStoredAccount(accountId, account.generation));
  }, [logout]);
  return { view, user, error, login, register, logout, accounts, switchAccount, forgetAccount, socketRev, bumpSocketRev, clearError };
}
