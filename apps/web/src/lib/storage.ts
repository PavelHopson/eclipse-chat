/** Atomic per-origin auth state. Mutations require the shared Web Lock. */
import type { PublicUser } from "../hooks/useAuth";

export const AUTH_STATE_KEY = "ec.auth.state.v2";
export const AUTH_STATE_EVENT = "ec:auth-state-change";
const STATE_LOCK = "ec-auth-state-v2";
const REFRESH_LOCK = "ec-auth-refresh-v2:";
const LEGACY_ACCOUNTS = "ec.auth.accounts.v1";
const LEGACY_ACTIVE = "ec.auth.activeAccount.v1";
const LEGACY_ACCESS = "eclipse_chat_access";
const LEGACY_REFRESH = "eclipse_chat_refresh";
const LEGACY_TOKEN = "eclipse_chat_token";

export type StoredAccount = { id: string; user: PublicUser; accessToken: string; refreshToken: string; updatedAt: string; generation: string; refreshAttempt?: string };
export type AuthState = { schema: 2; activeId: string | null; revision: number; accounts: StoredAccount[] };
export type AuthIdentity = { accountId: string | null; revision: number; generation: string | null };
export type AuthCapture = { identity: AuthIdentity; account: StoredAccount | null };

export class AuthStateChangedError extends Error {
  constructor() { super("Аккаунт изменился. Повторите действие."); this.name = "AuthStateChangedError"; }
}
export class AuthCoordinationUnavailableError extends Error {
  constructor() { super("Безопасная синхронизация входа недоступна. Обновите приложение."); this.name = "AuthCoordinationUnavailableError"; }
}

function emptyState(): AuthState { return { schema: 2, activeId: null, revision: 0, accounts: [] }; }
function validAccount(a: unknown): a is StoredAccount {
  if (!a || typeof a !== "object") return false;
  const x = a as Partial<StoredAccount>;
  return typeof x.id === "string" && !!x.id && !!x.user && x.user.id === x.id && typeof x.accessToken === "string" && !!x.accessToken && typeof x.refreshToken === "string" && !!x.refreshToken && typeof x.generation === "string" && !!x.generation && typeof x.updatedAt === "string" && (x.refreshAttempt === undefined || (typeof x.refreshAttempt === "string" && !!x.refreshAttempt));
}
function parseState(raw: string | null): AuthState | null {
  if (raw === null) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new AuthCoordinationUnavailableError(); }
  if (!data || typeof data !== "object") throw new AuthCoordinationUnavailableError();
  const s = data as Partial<AuthState>;
  if (s.schema !== 2 || !Number.isSafeInteger(s.revision) || (s.revision ?? -1) < 0 || !Array.isArray(s.accounts) || !s.accounts.every(validAccount) || (s.activeId !== null && (typeof s.activeId !== "string" || !s.accounts.some((a) => a.id === s.activeId))) || new Set(s.accounts.map((a) => a.id)).size !== s.accounts.length) throw new AuthCoordinationUnavailableError();
  return s as AuthState;
}
export function readAuthState(): AuthState {
  const state = parseState(localStorage.getItem(AUTH_STATE_KEY));
  if (!state) throw new AuthCoordinationUnavailableError();
  return state;
}
function commit(state: AuthState): void {
  localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT));
}
function locks(): LockManager {
  if (typeof navigator === "undefined" || !navigator.locks || typeof navigator.locks.request !== "function") throw new AuthCoordinationUnavailableError();
  return navigator.locks;
}
async function locked<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    return await locks().request(name, { mode: "exclusive", signal: controller.signal }, async () => {
      window.clearTimeout(timeout);
      return fn();
    });
  } finally { window.clearTimeout(timeout); }
}
export async function withAuthMutation<T>(fn: (state: AuthState) => { state: AuthState; result: T }): Promise<T> {
  return locked(STATE_LOCK, () => {
    const result = fn(readAuthState());
    commit(result.state);
    return result.result;
  });
}
export async function withRefreshLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
  return locked(`${REFRESH_LOCK}${accountId}`, fn);
}
function subject(access: string): string | null {
  try { const payload = JSON.parse(atob(access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return typeof payload.sub === "string" ? payload.sub : null; } catch { return null; }
}
/** Cannot safely forget credentials while an old client can still restore them. */
export function hasLegacyAccountData(accountId: string): boolean {
  try {
    const active = localStorage.getItem(LEGACY_ACTIVE);
    const raw = localStorage.getItem(LEGACY_ACCOUNTS);
    const access = localStorage.getItem(LEGACY_ACCESS) ?? localStorage.getItem(LEGACY_TOKEN);
    const refresh = localStorage.getItem(LEGACY_REFRESH);
    if (active === accountId && (access || refresh)) return true;
    if (access && subject(access) === accountId) return true;
    if (raw) {
      const accounts: unknown = JSON.parse(raw);
      if (!Array.isArray(accounts)) return true;
      if (accounts.some((a) => !a || typeof a !== "object" || typeof (a as { id?: unknown }).id !== "string")) return true;
      if (accounts.some((a) => (a as { id: string }).id === accountId)) return true;
    }
    // Unknown owner of a legacy pair cannot be safely attributed.
    if ((access || refresh) && !active && (!access || !subject(access))) return true;
    return false;
  } catch { return true; }
}
export async function initializeAuthStore(): Promise<void> {
  await locked(STATE_LOCK, () => {
    if (parseState(localStorage.getItem(AUTH_STATE_KEY))) return;
    const raw = localStorage.getItem(LEGACY_ACCOUNTS);
    let oldAccounts: unknown = [];
    try { oldAccounts = raw ? JSON.parse(raw) : []; } catch { throw new AuthCoordinationUnavailableError(); }
    if (!Array.isArray(oldAccounts)) throw new AuthCoordinationUnavailableError();
    const accounts: StoredAccount[] = [];
    for (const a of oldAccounts) {
      if (!a || typeof a !== "object") throw new AuthCoordinationUnavailableError();
      const x = a as Partial<StoredAccount>;
      const migrated = { ...x, generation: crypto.randomUUID() };
      if (!validAccount(migrated)) throw new AuthCoordinationUnavailableError();
      if (accounts.some((item) => item.id === migrated.id)) throw new AuthCoordinationUnavailableError();
      accounts.push(migrated);
    }
    const legacyAccess = localStorage.getItem(LEGACY_ACCESS) ?? localStorage.getItem(LEGACY_TOKEN);
    const legacyRefresh = localStorage.getItem(LEGACY_REFRESH);
    const wanted = localStorage.getItem(LEGACY_ACTIVE);
    const matchingId = legacyAccess ? subject(legacyAccess) : null;
    // Import a current pair only when its signed access subject matches the saved account.
    let current = accounts.find((item) => item.id === wanted && item.id === matchingId);
    // Older versions may have a pair but no vault. Import a provisional identity;
    // the app never shows it before /auth/me verifies the signed access token.
    if (!current && !wanted && accounts.length === 0 && legacyAccess && legacyRefresh && matchingId) {
      current = { id: matchingId, user: { id: matchingId, email: "", displayName: "", avatar: null, bio: null, createdAt: "" }, accessToken: legacyAccess, refreshToken: legacyRefresh, generation: crypto.randomUUID(), updatedAt: new Date().toISOString() };
      accounts.push(current);
    }
    if (legacyAccess && legacyRefresh && current) { current.accessToken = legacyAccess; current.refreshToken = legacyRefresh; }
    if ((legacyAccess || legacyRefresh) && (!current || !legacyAccess || !legacyRefresh)) throw new AuthCoordinationUnavailableError();
    const activeId = current?.id ?? (wanted && accounts.some((item) => item.id === wanted) ? wanted : null);
    commit({ ...emptyState(), accounts, activeId, revision: activeId ? 1 : 0 });
    // Keep old keys until old-client retirement policy is explicitly enforced.
  });
}
export function captureAuth(): AuthCapture {
  const state = readAuthState();
  const account = state.accounts.find((a) => a.id === state.activeId) ?? null;
  return { identity: { accountId: state.activeId, revision: state.revision, generation: account?.generation ?? null }, account };
}
export function identityCurrent(identity: AuthIdentity): boolean {
  const current = captureAuth().identity;
  return current.accountId === identity.accountId && current.revision === identity.revision && current.generation === identity.generation;
}
export function assertIdentityCurrent(identity: AuthIdentity): void { if (!identityCurrent(identity)) throw new AuthStateChangedError(); }
export function getAccess(): string | null { return captureDisplayedAuth().account?.accessToken ?? null; }
export function getRefresh(): string | null { return captureDisplayedAuth().account?.refreshToken ?? null; }




// Tab-local binding: a tab may only issue UI requests for the profile it displays.
let displayedIdentity: AuthIdentity | null = null;
let authScreenIdentity: AuthIdentity | null = null;
export function bindDisplayedIdentity(identity: AuthIdentity | null): void {
  if (identity) assertIdentityCurrent(identity);
  displayedIdentity = identity;
  authScreenIdentity = null;
}
export function assertDisplayedIdentity(identity: AuthIdentity): void {
  assertIdentityCurrent(identity);
  if (identity.accountId === null && displayedIdentity === null) return;
  if (!displayedIdentity || displayedIdentity.accountId !== identity.accountId || displayedIdentity.revision !== identity.revision || displayedIdentity.generation !== identity.generation) throw new AuthStateChangedError();
}
export function captureDisplayedAuth(): AuthCapture {
  const captured = captureAuth();
  assertDisplayedIdentity(captured.identity);
  return captured;
}


/** Allow explicit login/anonymous QR only for the auth screen actually shown in this tab. */
export function bindAuthScreenIdentity(identity: AuthIdentity): void {
  assertIdentityCurrent(identity);
  displayedIdentity = null;
  authScreenIdentity = identity;
}
export function captureAuthScreen(): AuthCapture {
  const captured = captureAuth();
  const expected = authScreenIdentity;
  if (!expected || expected.accountId !== captured.identity.accountId || expected.revision !== captured.identity.revision || expected.generation !== captured.identity.generation) throw new AuthStateChangedError();
  return captured;
}
