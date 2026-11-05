import type { PublicUser } from "../hooks/useAuth";
import { AuthStateChangedError, AUTH_STATE_EVENT, captureAuth, identityCurrent, readAuthState, withAuthMutation, type AuthIdentity, type StoredAccount } from "./storage";
export type { StoredAccount } from "./storage";
export const ACCOUNT_VAULT_EVENT = AUTH_STATE_EVENT;
export function listStoredAccounts(): StoredAccount[] { return [...readAuthState().accounts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export function getActiveAccountId(): string | null { return readAuthState().activeId; }
function matches(s: ReturnType<typeof readAuthState>, identity: AuthIdentity): boolean { return s.activeId === identity.accountId && s.revision === identity.revision && (s.accounts.find((a) => a.id === s.activeId)?.generation ?? null) === identity.generation; }
export async function upsertAccountSession(user: PublicUser, accessToken: string, refreshToken: string, expected: AuthIdentity, valid: () => boolean = () => true): Promise<StoredAccount[]> {
  return withAuthMutation((s) => {
    if (!valid() || !matches(s, expected)) throw new AuthStateChangedError();
    const account: StoredAccount = { id: user.id, user, accessToken, refreshToken, updatedAt: new Date().toISOString(), generation: crypto.randomUUID() };
    const accounts = [account, ...s.accounts.filter((a) => a.id !== user.id)];
    return { state: { ...s, activeId: user.id, revision: s.revision + 1, accounts }, result: accounts };
  });
}
export async function updateStoredAccountUser(user: PublicUser, expected: AuthIdentity): Promise<StoredAccount[]> {
  return withAuthMutation((s) => {
    if (!matches(s, expected) || expected.accountId !== user.id) throw new AuthStateChangedError();
    const accounts = s.accounts.map((a) => a.id === user.id ? { ...a, user, updatedAt: new Date().toISOString() } : a);
    return { state: { ...s, accounts }, result: accounts };
  });
}
export type ActivatedAccount = StoredAccount & { selectionIdentity: AuthIdentity };
export async function activateStoredAccount(accountId: string): Promise<ActivatedAccount | null> {
  return withAuthMutation((s) => {
    const account = s.accounts.find((a) => a.id === accountId) ?? null;
    if (!account) return { state: s, result: null };
    const revision = s.revision + 1;
    return { state: { ...s, activeId: account.id, revision }, result: { ...account, selectionIdentity: { accountId: account.id, revision, generation: account.generation } } };
  });
}
export async function restoreSelectionIfCurrent(expected: AuthIdentity, previousId: string | null): Promise<boolean> {
  return withAuthMutation((s) => {
    if (!matches(s, expected)) return { state: s, result: false };
    const activeId = previousId && s.accounts.some((a) => a.id === previousId) ? previousId : null;
    return { state: { ...s, activeId, revision: s.revision + 1 }, result: true };
  });
}
export async function removeStoredAccount(accountId: string, expectedGeneration?: string, selectNext = false, expected?: AuthIdentity): Promise<StoredAccount[]> {
  return withAuthMutation((s) => {
    if (expected && !matches(s, expected)) return { state: s, result: s.accounts };
    const target = s.accounts.find((a) => a.id === accountId);
    if (!target || (expectedGeneration && target.generation !== expectedGeneration)) return { state: s, result: s.accounts };
    const accounts = s.accounts.filter((a) => a.id !== accountId);
    const wasActive = s.activeId === accountId;
    const activeId = wasActive ? (selectNext ? accounts[0]?.id ?? null : null) : s.activeId;
    return { state: { ...s, accounts, activeId, revision: wasActive ? s.revision + 1 : s.revision }, result: accounts };
  });
}
/** Remove only the session that logout targeted; never remove a replacement session. */
export async function finishLogout(identity: AuthIdentity, confirmed: boolean): Promise<{ accounts: StoredAccount[]; activeChanged: boolean }> {
  return withAuthMutation((s) => {
    const target = s.accounts.find((a) => a.id === identity.accountId);
    if (!target || target.generation !== identity.generation || (!confirmed && !matches(s, identity))) return { state: s, result: { accounts: s.accounts, activeChanged: false } };
    const accounts = s.accounts.filter((a) => a.id !== target.id);
    const activeChanged = s.activeId === target.id;
    return { state: { ...s, accounts, activeId: activeChanged ? accounts[0]?.id ?? null : s.activeId, revision: activeChanged ? s.revision + 1 : s.revision }, result: { accounts, activeChanged } };
  });
}
export async function beginRefreshAttempt(identity: AuthIdentity, expectedRefresh: string, attempt: string): Promise<boolean> {
  return withAuthMutation((s) => {
    const account = s.accounts.find((a) => a.id === identity.accountId);
    if (!account || account.generation !== identity.generation || account.refreshToken !== expectedRefresh || account.refreshAttempt) return { state: s, result: false };
    return { state: { ...s, accounts: s.accounts.map((a) => a.id === account.id ? { ...a, refreshAttempt: attempt } : a) }, result: true };
  });
}
export async function commitRotatedSession(identity: AuthIdentity, expectedRefresh: string, accessToken: string, refreshToken: string, newGeneration = false, expectedAttempt?: string): Promise<boolean> {
  return withAuthMutation((s) => {
    const account = s.accounts.find((a) => a.id === identity.accountId);
    if (!account || account.generation !== identity.generation || account.refreshToken !== expectedRefresh || (expectedAttempt !== undefined && account.refreshAttempt !== expectedAttempt)) return { state: s, result: false };
    const accounts = s.accounts.map((a) => a.id === account.id ? { ...a, accessToken, refreshToken, updatedAt: new Date().toISOString(), generation: newGeneration ? crypto.randomUUID() : a.generation, refreshAttempt: undefined } : a);
    return { state: { ...s, accounts, revision: newGeneration && s.activeId === account.id ? s.revision + 1 : s.revision }, result: true };
  });
}
export function accountFor(identity: AuthIdentity): StoredAccount | null { return readAuthState().accounts.find((a) => a.id === identity.accountId && a.generation === identity.generation) ?? null; }
export function isCurrent(identity: AuthIdentity): boolean { return identityCurrent(identity); }
export function currentAccount(): StoredAccount | null { return captureAuth().account; }
