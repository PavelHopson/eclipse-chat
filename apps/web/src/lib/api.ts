import { assertDisplayedIdentity, assertIdentityCurrent, AuthStateChangedError, captureAuth, captureDisplayedAuth, withAuthMutation, withRefreshLock, type AuthCapture, type AuthIdentity } from "./storage";
import { accountFor, beginRefreshAttempt, commitRotatedSession } from "./accountVault";
export function apiPath(path: string): string { return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`; }

export const AUTH_PROTOCOL_HEADER = "X-Eclipse-Auth-Protocol";
export const CLIENT_UPDATE_EVENT = "ec:client-update-required";
let clientUpdateRequired = false;
export class ClientUpdateRequiredError extends Error {
  constructor() { super("Для продолжения обновите Eclipse Chat."); this.name = "ClientUpdateRequiredError"; }
}
export function isClientUpdateRequired(): boolean { return clientUpdateRequired; }
export function markClientUpdateRequired(): void {
  if (clientUpdateRequired) return;
  clientUpdateRequired = true;
  window.dispatchEvent(new CustomEvent(CLIENT_UPDATE_EVENT));
}
export function assertClientCanRequest(): void { if (clientUpdateRequired) throw new ClientUpdateRequiredError(); }
export class SessionUpgradeRequiredError extends Error {
  constructor() { super("Не удалось обновить вход. Проверьте соединение, войдите снова и повторите действие."); this.name = "SessionUpgradeRequiredError"; }
}
type ServerGateCode = "CLIENT_UPDATE_REQUIRED" | "SESSION_UPGRADE_REQUIRED" | null;
async function readServerGate(response: Response): Promise<ServerGateCode> {
  if (response.status !== 426) return null;
  let body: unknown;
  try { body = await response.clone().json(); } catch { return null; }
  if (!body || typeof body !== "object") return null;
  const code = (body as { code?: unknown }).code;
  return code === "CLIENT_UPDATE_REQUIRED" || code === "SESSION_UPGRADE_REQUIRED" ? code : null;
}
function throwForServerGate(code: ServerGateCode): void {
  if (code === "CLIENT_UPDATE_REQUIRED") { markClientUpdateRequired(); throw new ClientUpdateRequiredError(); }
  if (code === "SESSION_UPGRADE_REQUIRED") throw new SessionUpgradeRequiredError();
}
/** Verify the issuing identity after reading the gate body and before notifying the UI. */
export async function enforceClientUpdate(response: Response, assertCurrent: () => void = () => {}): Promise<void> {
  const code = await readServerGate(response);
  assertCurrent();
  throwForServerGate(code);
}

function identityStillCurrent(identity: AuthIdentity): boolean { try { assertIdentityCurrent(identity); return true; } catch { return false; } }
type RefreshListener = () => void;
const refreshListeners = new Set<RefreshListener>();
export function onTokenRefresh(listener: RefreshListener): () => void { refreshListeners.add(listener); return () => { refreshListeners.delete(listener); }; }
function notifyRefresh(): void { for (const fn of refreshListeners) { try { fn(); } catch { /* listener failure */ } } }

async function refreshFor(capture: AuthCapture): Promise<string | null> {
  assertClientCanRequest();
  const original = capture.account;
  if (!original) return null;
  return withRefreshLock(original.id, async () => {
    const current = accountFor(capture.identity);
    if (!current) return null;
    if (current.refreshAttempt) throw new Error("Не удалось подтвердить обновление входа. Войдите заново.");
    if (current.refreshToken !== original.refreshToken) return current.accessToken;
    const attempt = crypto.randomUUID();
    if (!await beginRefreshAttempt(capture.identity, original.refreshToken, attempt)) throw new Error("Не удалось подтвердить обновление входа. Войдите заново.");
    // The persisted attempt survives timeout/crash: never replay an uncertain token.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    let data: { accessToken?: string; token?: string; refreshToken?: string };
    try {
      const response = await fetch(apiPath("api/auth/refresh"), {
        method: "POST", headers: { "Content-Type": "application/json", [AUTH_PROTOCOL_HEADER]: "2" }, body: JSON.stringify({ refreshToken: original.refreshToken }), signal: controller.signal,
      });
      const code = await readServerGate(response);
      if (code) {
        // Both explicit gate codes reject before server-side rotation. Preserve
        // both tokens and clear only this exact, known-unapplied attempt.
        await withAuthMutation((state) => ({
          state: { ...state, accounts: state.accounts.map((account) =>
            account.id === capture.identity.accountId && account.generation === capture.identity.generation &&
            account.refreshToken === original.refreshToken && account.refreshAttempt === attempt
              ? { ...account, refreshAttempt: undefined } : account) },
          result: undefined,
        }));
        // A late rejection belonging to a previous profile must not gate this UI.
        assertIdentityCurrent(capture.identity);
        throwForServerGate(code);
      }
      if (!response.ok) return null;
      data = await response.json() as { accessToken?: string; token?: string; refreshToken?: string };
    } finally { window.clearTimeout(timeout); }
    const access = data.accessToken ?? data.token;
    if (!access || !data.refreshToken) return null;
    const saved = await commitRotatedSession(capture.identity, original.refreshToken, access, data.refreshToken, false, attempt);
    if (!saved) return null;
    if (identityStillCurrent(capture.identity)) notifyRefresh();
    return access;
  });
}
export async function refreshAccessToken(): Promise<string | null> {
  const capture = captureDisplayedAuth();
  const result = await refreshFor(capture);
  assertIdentityCurrent(capture.identity);
  return result;
}
/** Check reads, including queued chunks; retain transformed stream value types. */
function guardReadable<T>(source: ReadableStream<T>, assertCurrent: () => void, bytes = false): ReadableStream<T> {
  const sourceReader = source.getReader();
  const pull = async (controller: ReadableStreamDefaultController<T> | ReadableByteStreamController) => {
    try {
      assertCurrent();
      const chunk = await sourceReader.read();
      assertCurrent();
      if (chunk.done) {
        controller.close();
        if (bytes) (controller as ReadableByteStreamController).byobRequest?.respond(0);
      } else if (bytes) (controller as ReadableByteStreamController).enqueue(new Uint8Array(chunk.value as Uint8Array));
      else (controller as ReadableStreamDefaultController<T>).enqueue(chunk.value);
    } catch (error) { void sourceReader.cancel().catch(() => undefined); controller.error(error); }
  };
  const cancel = async (reason: unknown) => { await sourceReader.cancel(reason); };
  const stream: ReadableStream<T> = bytes
    ? new ReadableStream({ type: "bytes", pull, cancel }, { highWaterMark: 0 }) as ReadableStream<T>
    : new ReadableStream<T>({ pull, cancel }, { highWaterMark: 0 });
  return new Proxy(stream, {
    get(target, property) {
      assertCurrent();
      if (property === "getReader") return (options?: { mode?: string }) => {
        if (options?.mode !== undefined && options.mode !== "byob") throw new TypeError("Неизвестный режим чтения");
        const reader = options?.mode === "byob" ? target.getReader({ mode: "byob" }) : target.getReader();
        return new Proxy(reader, {
          get(actual, key) {
            if (key === "read") return async (...args: unknown[]) => {
              assertCurrent();
              const chunk = await (actual.read as (...readArgs: unknown[]) => Promise<unknown>).apply(actual, args);
              assertCurrent();
              return chunk;
            };
            const value = Reflect.get(actual, key, actual);
            return typeof value === "function" ? value.bind(actual) : value;
          },
        });
      };
      if (property === Symbol.asyncIterator || property === "values") return (...args: unknown[]) => {
        assertCurrent();
        const values = Reflect.get(target, property, target) as (...valuesArgs: unknown[]) => AsyncIterator<T>;
        const iterator = values.apply(target, args);
        return new Proxy(iterator, {
          get(actual, key) {
            if (key === "next") return async (...nextArgs: unknown[]) => {
              assertCurrent();
              const result = await (actual.next as (...valuesArgs: unknown[]) => Promise<IteratorResult<T>>).apply(actual, nextArgs);
              assertCurrent();
              return result;
            };
            const value = Reflect.get(actual, key, actual);
            return typeof value === "function" ? value.bind(actual) : value;
          },
        });
      };
      if (property === "tee") return () => { assertCurrent(); const [a, b] = target.tee(); return [guardReadable(a, assertCurrent, bytes), guardReadable(b, assertCurrent, bytes)]; };
      if (property === "pipeThrough") return (...args: Parameters<ReadableStream<T>["pipeThrough"]>) => { assertCurrent(); return guardReadable(target.pipeThrough(...args), assertCurrent); };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
/** Keep the originating identity bound until body consumption, including streams. */
function guardResponse(response: Response, identity: AuthIdentity, uiBound: boolean): Response {
  const assertCurrent = () => { assertClientCanRequest(); uiBound ? assertDisplayedIdentity(identity) : assertIdentityCurrent(identity); };
  let wrappedBody: ReadableStream<Uint8Array> | null | undefined;
  const consumers = new Set(["arrayBuffer", "blob", "bytes", "formData", "json", "text"]);
  return new Proxy(response, {
    get(target, property) {
      assertCurrent();
      if (property === "body") {
        if (wrappedBody !== undefined) return wrappedBody;
        if (!target.body) return wrappedBody = null;
        return wrappedBody = guardReadable(target.body, assertCurrent, true);
      }
      if (property === "clone") return () => { assertCurrent(); return guardResponse(target.clone(), identity, uiBound); };
      if (typeof property === "string" && consumers.has(property)) {
        return async () => {
          assertCurrent();
          const method = Reflect.get(target, property, target) as () => Promise<unknown>;
          const result = await method.call(target);
          assertCurrent();
          return result;
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
const responseIdentities = new WeakMap<Response, AuthIdentity>();
async function request(path: string, init: RequestInit | undefined, capture: AuthCapture, uiBound: boolean, anonymous = false, retryAuth = true): Promise<Response> {
  const assertCurrent = () => { assertClientCanRequest(); uiBound ? assertDisplayedIdentity(capture.identity) : assertIdentityCurrent(capture.identity); };
  const build = (access: string | null) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
    if (access) headers.set("Authorization", `Bearer ${access}`);
    if (headers.has("Authorization") || /^\/?api\/auth\/(?:qr\/exchange(?:-code)?|media-session)(?:\?|$)/.test(path)) headers.set(AUTH_PROTOCOL_HEADER, "2");
    return fetch(apiPath(path), { ...init, headers });
  };
  assertCurrent();
  let response = await build(anonymous ? null : capture.account?.accessToken ?? null);
  assertCurrent();
  let code = await readServerGate(response);
  assertCurrent();
  if (code === "CLIENT_UPDATE_REQUIRED") throwForServerGate(code);
  let upgraded = false;
  if (code === "SESSION_UPGRADE_REQUIRED") {
    // Only re-read profile after a coordinated legacy-session upgrade. Never
    // replay a mutation or a different GET as an implicit side effect.
    const isMe = path.replace(/^\/+/, "") === "api/auth/me" && (init?.method ?? "GET").toUpperCase() === "GET";
    if (!isMe || anonymous || !capture.account?.refreshToken || !retryAuth) throwForServerGate(code);
    let access: string | null;
    try { access = await refreshFor(capture); }
    catch (error) {
      if (error instanceof AuthStateChangedError || error instanceof ClientUpdateRequiredError) throw error;
      throw new SessionUpgradeRequiredError();
    }
    assertCurrent();
    if (!access) throw new SessionUpgradeRequiredError();
    upgraded = true;
    response = await build(access);
    assertCurrent();
    code = await readServerGate(response);
    assertCurrent();
    throwForServerGate(code);
  }
  const method = (init?.method ?? "GET").toUpperCase();
  if (!upgraded && retryAuth && !anonymous && response.status === 401 && capture.account?.refreshToken && method !== "GET" && method !== "HEAD") {
    // The server may already have observed an unsafe request. Never replay it.
    throw new Error("Запрос отклонён. Проверьте вход и повторите действие вручную.");
  }
  if (!upgraded && retryAuth && !anonymous && response.status === 401 && capture.account?.refreshToken && (method === "GET" || method === "HEAD")) {
    const access = await refreshFor(capture);
    assertCurrent();
    if (access) {
      response = await build(access);
      assertCurrent();
      code = await readServerGate(response);
      assertCurrent();
      throwForServerGate(code);
    }
  }
  const guarded = guardResponse(response, capture.identity, uiBound);
  responseIdentities.set(guarded, capture.identity);
  return guarded;
}
export async function api(path: string, init?: RequestInit): Promise<Response> {
  return request(path, init, captureDisplayedAuth(), true);
}
/** Only useAuth may validate a selected profile while no profile is rendered. */
export async function apiJsonForAuth<T>(identity: AuthIdentity, path: string, init?: RequestInit, anonymous = false, retryAuth = true): Promise<T> {
  const capture = captureAuth();
  if (capture.identity.accountId !== identity.accountId || capture.identity.revision !== identity.revision || capture.identity.generation !== identity.generation) throw new AuthStateChangedError();
  const response = await request(path, init, capture, false, anonymous, retryAuth);
  const detail: unknown = await response.json();
  assertIdentityCurrent(identity);
  if (!response.ok) throw new ApiError((detail && typeof detail === "object" && "error" in detail && typeof (detail as { error: unknown }).error === "string") ? (detail as { error: string }).error : `HTTP ${response.status}`, response.status, detail);
  return detail as T;
}
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const identity = responseIdentities.get(res);
  if (!res.ok) {
    let detail: unknown = null;
    try { detail = await res.json(); } catch { /* no body */ }
    if (identity) assertIdentityCurrent(identity);
    const message = (detail && typeof detail === "object" && "error" in detail && typeof (detail as { error: unknown }).error === "string" ? (detail as { error: string }).error : null) ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status, detail);
  }
  const data = await res.json() as T;
  if (identity) assertIdentityCurrent(identity);
  return data;
}
export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly detail: unknown) { super(message); this.name = "ApiError"; }
}
