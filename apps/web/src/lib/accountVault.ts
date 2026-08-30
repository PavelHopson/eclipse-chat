import type { PublicUser } from "../hooks/useAuth";
import { clearAllTokens, getAccess, getRefresh, setTokenPair } from "./storage";

const ACCOUNTS_KEY = "ec.auth.accounts.v1";
const ACTIVE_ACCOUNT_KEY = "ec.auth.activeAccount.v1";

export const ACCOUNT_VAULT_EVENT = "ec:account-vault-change";

export type StoredAccount = {
  id: string;
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  updatedAt: string;
};

function isPublicUser(value: unknown): value is PublicUser {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PublicUser>;
  return typeof candidate.id === "string"
    && typeof candidate.email === "string"
    && typeof candidate.displayName === "string";
}

function isStoredAccount(value: unknown): value is StoredAccount {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredAccount>;
  return typeof candidate.id === "string"
    && isPublicUser(candidate.user)
    && typeof candidate.accessToken === "string"
    && candidate.accessToken.length > 0
    && typeof candidate.refreshToken === "string"
    && candidate.refreshToken.length > 0
    && typeof candidate.updatedAt === "string";
}

function emitChange() {
  window.dispatchEvent(new CustomEvent(ACCOUNT_VAULT_EVENT));
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  emitChange();
}

export function listStoredAccounts(): StoredAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredAccount).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function getActiveAccountId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function upsertAccountSession(
  user: PublicUser,
  accessToken: string,
  refreshToken: string,
): StoredAccount[] {
  const account: StoredAccount = {
    id: user.id,
    user,
    accessToken,
    refreshToken,
    updatedAt: new Date().toISOString(),
  };
  const next = [account, ...listStoredAccounts().filter((item) => item.id !== user.id)];
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, user.id);
  writeAccounts(next);
  return next;
}

export function updateStoredAccountUser(user: PublicUser): StoredAccount[] {
  const accounts = listStoredAccounts();
  const next = accounts.map((item) => item.id === user.id
    ? { ...item, user, updatedAt: new Date().toISOString() }
    : item);
  if (next.some((item) => item.id === user.id)) writeAccounts(next);
  return next;
}

export function updateActiveStoredTokens(accessToken: string, refreshToken: string): StoredAccount[] {
  const activeId = getActiveAccountId();
  if (!activeId) return listStoredAccounts();
  const accounts = listStoredAccounts();
  const next = accounts.map((item) => item.id === activeId
    ? { ...item, accessToken, refreshToken, updatedAt: new Date().toISOString() }
    : item);
  if (next.some((item) => item.id === activeId)) writeAccounts(next);
  return next;
}

export function activateStoredAccount(accountId: string): StoredAccount | null {
  const account = listStoredAccounts().find((item) => item.id === accountId) ?? null;
  if (!account) return null;
  setTokenPair(account.accessToken, account.refreshToken);
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
  writeAccounts([
    { ...account, updatedAt: new Date().toISOString() },
    ...listStoredAccounts().filter((item) => item.id !== account.id),
  ]);
  return account;
}

export function restoreActiveAccountTokens(): StoredAccount | null {
  const accounts = listStoredAccounts();
  const preferred = getActiveAccountId();
  const account = accounts.find((item) => item.id === preferred) ?? accounts[0] ?? null;
  if (!account) return null;
  setTokenPair(account.accessToken, account.refreshToken);
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
  return account;
}

export function removeStoredAccount(accountId: string): StoredAccount[] {
  const next = listStoredAccounts().filter((item) => item.id !== accountId);
  const wasActive = getActiveAccountId() === accountId;
  if (wasActive) {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    clearAllTokens();
  }
  writeAccounts(next);
  return next;
}

export function persistCurrentSessionFor(user: PublicUser): StoredAccount[] {
  const access = getAccess();
  const refresh = getRefresh();
  if (!access || !refresh) return listStoredAccounts();
  return upsertAccountSession(user, access, refresh);
}
