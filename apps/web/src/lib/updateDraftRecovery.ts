/** Mounted composers synchronously report unsaved work before a manual update. */
type UpdateBlocker = { blocked?: boolean; text?: string; accountId?: string | null; draftKey?: string | null; isCurrent?: () => boolean; select: () => void };
const participants = new Set<() => UpdateBlocker>();
let selectBlocked: (() => void) | null = null;
export function liveDraftText(current: string, rendered: string, dom: string | undefined): string {
  return current !== rendered ? current : (dom ?? current);
}
export function registerUpdateDraft(read: () => UpdateBlocker): () => void {
  participants.add(read);
  return () => { participants.delete(read); };
}
export function checkUpdateDrafts(): boolean {
  selectBlocked = null;
  for (const read of participants) {
    try {
      const current = read();
      if (current.blocked || current.text?.length) { selectBlocked = current.select; return false; }
    } catch { return false; }
  }
  return true;
}
export function selectUpdateDraft(): void { try { selectBlocked?.(); } catch { /* allow manual selection */ } }
export const flushUpdateDrafts = checkUpdateDrafts;

// Retained for compatibility with account-scoped drafts. The durable copy is
// shared between tabs and its check/write operations are not atomic.
const PREFIX = "eclipse-chat:draft:v2:";
function draftStorageKey(accountId: string, draftKey: string): string {
  return `${PREFIX}${encodeURIComponent(accountId)}:${encodeURIComponent(draftKey)}`;
}
export function hasLegacyDraft(draftKey: string | null | undefined): boolean {
  if (!draftKey) return false;
  try { return localStorage.getItem(`eclipse-chat:draft:v1:${draftKey}`) !== null; } catch { return false; }
}
export function loadScopedDraft(accountId: string, draftKey: string): string | null {
  const key = draftStorageKey(accountId, draftKey);
  try { const value = sessionStorage.getItem(key); if (value !== null) return value; } catch { /* durable copy */ }
  try { return localStorage.getItem(key); } catch { return null; }
}
export function saveScopedDraft(accountId: string, draftKey: string, text: string): boolean {
  try {
    const key = draftStorageKey(accountId, draftKey);
    const previous = sessionStorage.getItem(key);
    sessionStorage.setItem(key, text);
    if (sessionStorage.getItem(key) !== text) return false;
    try { if (text !== "" || localStorage.getItem(key) === previous) localStorage.setItem(key, text); } catch { /* tab copy remains */ }
    return true;
  } catch { return false; }
}
export function clearSentDraft(accountId: string, draftKey: string, sentText: string): void {
  try {
    const key = draftStorageKey(accountId, draftKey);
    if (sessionStorage.getItem(key) === sentText) sessionStorage.setItem(key, "");
    try { if (localStorage.getItem(key) === sentText) localStorage.setItem(key, ""); } catch { /* retain copy */ }
  } catch { /* retain copy */ }
}
export function saveAfterConfirmedSend(accountId: string, draftKey: string, sentText: string, currentText: string): boolean {
  const key = draftStorageKey(accountId, draftKey);
  const next = currentText === sentText ? "" : currentText;
  try {
    sessionStorage.setItem(key, next);
    if (sessionStorage.getItem(key) !== next) return false;
    try { if (localStorage.getItem(key) === sentText) localStorage.setItem(key, next); } catch { /* retain copy */ }
    return true;
  } catch { return false; }
}

// V3 journal candidate: per-document owner, cooperative locks and revisioned snapshots.
// This is deliberately separate from legacy v1/v2; no automatic import or deletion.
export type JournalSnapshot = { owner: string; revision: string; text: string; updatedAt: number };
type Journal = { schema: 3; snapshots: Record<string, JournalSnapshot> };
const JOURNAL_PREFIX = "eclipse-chat:draft:v3:";
const OWNER_KEY = "eclipse-chat:draft:owner:v3";
const MAX_SNAPSHOTS = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type StagedDraft = { owner: string; text: string; revision: string };
let journalOwner: string | null = null;
let ownerReady: Promise<string> | null = null;
let releaseOwner: (() => void) | null = null;
let ownerEpoch = 0;
const pending = new Map<string, StagedDraft>();
const unsafeMemory = new Map<string, StagedDraft>();
function journalKey(account: string, chat: string): string {
  if (!account || !chat) throw new Error("Не указан аккаунт или чат");
  return JOURNAL_PREFIX + encodeURIComponent(account) + ":" + encodeURIComponent(chat);
}
function journalLocks(): LockManager {
  if (typeof navigator === "undefined" || !navigator.locks?.request) throw new Error("Безопасное сохранение черновиков недоступно");
  return navigator.locks;
}
function parseJournal(raw: string | null): Journal {
  if (raw === null) return { schema: 3, snapshots: {} };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Не удалось прочитать сохранённые черновики"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Не удалось прочитать сохранённые черновики");
  const record = value as Partial<Journal>;
  if (record.schema !== 3 || !record.snapshots || typeof record.snapshots !== "object" || Array.isArray(record.snapshots)) throw new Error("Не удалось прочитать сохранённые черновики");
  for (const [key, snapshot] of Object.entries(record.snapshots)) {
    if (!UUID.test(key) || !snapshot || snapshot.owner !== key || typeof snapshot.text !== "string" || typeof snapshot.revision !== "string" || !UUID.test(snapshot.revision) || !Number.isFinite(snapshot.updatedAt)) throw new Error("Не удалось прочитать сохранённые черновики");
  }
  return record as Journal;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
async function claimOwner(requested: string): Promise<string | null> {
  const grant = deferred<string | null>();
  const end = deferred<void>();
  const epoch = ownerEpoch;
  void journalLocks().request("ec-draft-owner-v3:" + requested, { ifAvailable: true }, async lock => {
    if (!lock || epoch !== ownerEpoch) { grant.resolve(null); return; }
    journalOwner = requested;
    releaseOwner = () => end.resolve();
    try { sessionStorage.setItem(OWNER_KEY, requested); } catch { journalOwner = null; releaseOwner = null; grant.resolve(null); return; }
    grant.resolve(requested);
    await end.promise;
  }).catch(() => grant.resolve(null));
  return grant.promise;
}
/** Every acquisition uses a new owner; copied sessionStorage never proves ownership. */
export async function startDraftOwner(): Promise<string> {
  if (journalOwner) return journalOwner;
  if (ownerReady) return ownerReady;
  const epoch = ownerEpoch;
  const promise = (async () => {
    journalLocks();
    const owner = await claimOwner(crypto.randomUUID());
    if (!owner || epoch !== ownerEpoch) throw new Error("Не удалось защитить черновик между вкладками");
    return owner;
  })();
  ownerReady = promise;
  try { return await promise; } finally { if (ownerReady === promise) ownerReady = null; }
}
/** Explicitly release on pagehide; pageshow must reacquire before future writes. */
export function suspendDraftOwner(): void {
  ownerEpoch += 1;
  const release = releaseOwner;
  releaseOwner = null;
  journalOwner = null;
  ownerReady = null;
  pending.clear();
  release?.();
}
export function currentDraftOwner(): string | null { return journalOwner; }
async function lockedJournal<T>(account: string, chat: string, operation: (journal: Journal) => { changed: boolean; result: T }): Promise<T> {
  const key = journalKey(account, chat);
  return journalLocks().request("ec-draft-registry-v3:" + key, { mode: "exclusive" }, () => {
    const journal = parseJournal(localStorage.getItem(key));
    const outcome = operation(journal);
    if (outcome.changed) localStorage.setItem(key, JSON.stringify(journal));
    return outcome.result;
  });
}
/** Save a revision synchronously; the caller must display any storage error. */
export function stageDraft(account: string, chat: string, text: string): StageResult {
  if (!journalOwner) throw new Error("Вкладка ещё не готова сохранять черновик");
  const key = journalKey(account, chat);
  const stage = { owner: journalOwner, text, revision: crypto.randomUUID() };
  pending.set(key, stage);
  let emergencySaved = false;
  let sessionSaved = false;
  try { writeEmergency(journalOwner, key, stage); emergencySaved = true; } catch { /* reported to caller */ }
  try { sessionStorage.setItem(sessionDraftKey(key, stage.owner), JSON.stringify(stage)); sessionSaved = true; } catch { /* reported to caller */ }
  if (emergencySaved) unsafeMemory.delete(key);
  else unsafeMemory.set(key, stage);
  return { ...stage, emergencySaved, sessionSaved };
}
/** A different owner indicates copied sessionStorage: do not restore automatically. */
export function loadStagedDraft(account: string, chat: string): StagedDraft | null {
  const key = journalKey(account, chat);
  if (!journalOwner) return null;
  const raw = sessionStorage.getItem(sessionDraftKey(key, journalOwner));
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Не удалось восстановить черновик вкладки"); }
  const entry = value as Partial<StagedDraft>;
  if (!entry || typeof entry.text !== "string" || typeof entry.owner !== "string" || !UUID.test(entry.owner) || typeof entry.revision !== "string" || !UUID.test(entry.revision)) throw new Error("Не удалось восстановить черновик вкладки");
  if (entry.owner === journalOwner) pending.set(key, entry as StagedDraft);
  return entry as StagedDraft;
}
/** Persist only the latest staged revision, failing visibly on quota/lock errors. */
export async function persistStagedDraft(account: string, chat: string, mayPersist: () => boolean = () => true): Promise<void> {
  const key = journalKey(account, chat);
  const owner = await startDraftOwner();
  const epoch = ownerEpoch;
  const committed = await lockedJournal(account, chat, journal => {
    if (journalOwner !== owner || epoch !== ownerEpoch || !mayPersist()) throw new Error("Аккаунт или вкладка изменились: черновик не сохранён");
    const stage = pending.get(key);
    if (!stage || stage.owner !== owner) return { changed: false, result: null };
    if (!stage.text) {
      const changed = Boolean(journal.snapshots[owner]);
      delete journal.snapshots[owner];
      return { changed, result: stage.revision };
    }
    if (!journal.snapshots[owner] && Object.keys(journal.snapshots).length >= MAX_SNAPSHOTS) throw new Error("Слишком много сохранённых вариантов: скопируйте текст перед обновлением");
    journal.snapshots[owner] = { ...stage, updatedAt: Date.now() };
    return { changed: true, result: stage.revision };
  });
  if (committed && journalOwner === owner && ownerEpoch === epoch && mayPersist() && pending.get(key)?.revision === committed) {
    if (unsafeMemory.get(key)?.revision === committed) unsafeMemory.delete(key);
    clearEmergency(owner, key, committed);
  }
}
export async function listDraftSnapshots(account: string, chat: string): Promise<JournalSnapshot[]> {
  return lockedJournal(account, chat, journal => ({ changed: false, result: Object.values(journal.snapshots).filter(s => s.text.length > 0).sort((a,b) => b.updatedAt-a.updatedAt) }));
}
/** Remove only this exact confirmed version; never overwrite a later edit. */
export async function acknowledgeDraft(account: string, chat: string, owner: string, sentRevision: string): Promise<boolean> {
  const epoch = ownerEpoch;
  const key = journalKey(account, chat);
  const removed = await lockedJournal(account, chat, journal => {
    const stage = pending.get(key);
    const entry = journal.snapshots[owner];
    if (journalOwner !== owner || ownerEpoch !== epoch || !stage || stage.owner !== owner || stage.revision !== sentRevision || (entry && entry.revision !== sentRevision)) return { changed: false, result: false };
    if (entry) delete journal.snapshots[owner];
    return { changed: Boolean(entry), result: true };
  });
  if (removed && pending.get(key)?.revision === sentRevision && journalOwner === owner && ownerEpoch === epoch) {
    clearEmergency(owner, key, sentRevision);
    const stored = loadStagedDraft(account, chat);
    if (stored?.owner === owner && stored.revision === sentRevision) sessionStorage.removeItem(sessionDraftKey(key, owner));
    if (pending.get(key)?.revision === sentRevision) pending.delete(key);
    if (unsafeMemory.get(key)?.revision === sentRevision) unsafeMemory.delete(key);
  }
  return removed;
}

// One lifecycle coordinator for every mounted composer in this document.
type DraftLifecycleParticipant = { flush: () => void; resumed: (error: unknown | null) => void };
const lifecycleParticipants = new Set<DraftLifecycleParticipant>();
let lifecycleInstalled = false;
export function registerDraftLifecycle(participant: DraftLifecycleParticipant): () => void {
  lifecycleParticipants.add(participant);
  if (!lifecycleInstalled && typeof window !== "undefined") {
    lifecycleInstalled = true;
    window.addEventListener("pagehide", () => {
      for (const p of lifecycleParticipants) { try { p.flush(); } catch { /* component reports its own storage failure */ } }
      suspendDraftOwner();
    });
    window.addEventListener("pageshow", event => {
      if (!event.persisted) return;
      void startDraftOwner().then(() => {
        for (const p of lifecycleParticipants) p.resumed(null);
      }, error => {
        for (const p of lifecycleParticipants) p.resumed(error);
      });
    });
  }
  return () => { lifecycleParticipants.delete(participant); };
}

// Synchronous write-ahead safety copy: one atomic map per held document owner.
const EMERGENCY_PREFIX = "eclipse-chat:draft:emergency:v3:";
const MAX_EMERGENCY_ENTRIES = 32;
type Emergency = { schema: 3; owner: string; entries: Record<string, StagedDraft> };
export type StageResult = StagedDraft & { emergencySaved: boolean; sessionSaved: boolean };
function emergencyKey(owner: string): string { return EMERGENCY_PREFIX + owner; }
function readEmergency(owner: string): Emergency {
  const raw = localStorage.getItem(emergencyKey(owner));
  if (raw === null) return { schema: 3, owner, entries: {} };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Не удалось прочитать аварийный черновик"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Не удалось прочитать аварийный черновик");
  const data = value as Partial<Emergency>;
  if (data.schema !== 3 || data.owner !== owner || !data.entries || typeof data.entries !== "object" || Array.isArray(data.entries)) throw new Error("Не удалось прочитать аварийный черновик");
  for (const [key, entry] of Object.entries(data.entries)) {
    if (!key.startsWith(JOURNAL_PREFIX) || !entry || entry.owner !== owner || typeof entry.text !== "string" || typeof entry.revision !== "string" || !UUID.test(entry.revision)) throw new Error("Не удалось прочитать аварийный черновик");
  }
  return data as Emergency;
}
function writeEmergency(owner: string, key: string, stage: StagedDraft): void {
  if (owner !== journalOwner) throw new Error("Владелец черновика изменился");
  const data = readEmergency(owner);
  if (!data.entries[key] && Object.keys(data.entries).length >= MAX_EMERGENCY_ENTRIES) throw new Error("Слишком много несохранённых черновиков");
  data.entries[key] = stage;
  localStorage.setItem(emergencyKey(owner), JSON.stringify(data));
}
function clearEmergency(owner: string, key: string, revision: string): void {
  if (owner !== journalOwner) return;
  const data = readEmergency(owner);
  if (data.entries[key]?.revision !== revision) return;
  delete data.entries[key];
  if (Object.keys(data.entries).length === 0) localStorage.removeItem(emergencyKey(owner));
  else localStorage.setItem(emergencyKey(owner), JSON.stringify(data));
}
/** Read candidates only for this account/chat. No implicit mutation or cleanup. */
export function listEmergencyDrafts(account: string, chat: string): StagedDraft[] {
  const key = journalKey(account, chat);
  const owners: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const name = localStorage.key(i);
    if (!name?.startsWith(EMERGENCY_PREFIX)) continue;
    const owner = name.slice(EMERGENCY_PREFIX.length);
    if (!UUID.test(owner)) throw new Error("Не удалось проверить аварийные черновики");
    owners.push(owner);
    if (owners.length > 512) throw new Error("Слишком много аварийных черновиков");
  }
  return owners.flatMap(owner => { const entry = readEmergency(owner).entries[key]; return entry?.text ? [entry] : []; });
}

/** Fallback is isolated by account/chat and remains in this page only. */
export function rememberUnsafeDraft(account: string, chat: string, text: string): StagedDraft {
  const stage = { owner: journalOwner ?? crypto.randomUUID(), text, revision: crypto.randomUUID() };
  unsafeMemory.set(journalKey(account, chat), stage);
  return stage;
}
export function readUnsafeDraft(account: string, chat: string): StagedDraft | null {
  return unsafeMemory.get(journalKey(account, chat)) ?? null;
}
export function hasUnsafeDrafts(): boolean { return [...unsafeMemory.values()].some(entry => entry.text.length > 0); }
/** Invoke only after a successful explicit copy of the exact version. */
export function acknowledgeUnsafeCopy(account: string, chat: string, revision: string): boolean {
  const key = journalKey(account, chat);
  if (unsafeMemory.get(key)?.revision !== revision) return false;
  unsafeMemory.delete(key);
  return true;
}

/**
 * Explicitly discard a selected old snapshot. Caller must explain this action.
 * An active owner is never modified. A lock guards the old owner, while the
 * registry update and emergency cleanup compare the exact revision.
 */
export async function discardOldDraftSnapshot(account: string, chat: string, owner: string, revision: string): Promise<"deleted" | "in-use" | "not-found"> {
  if (!UUID.test(owner) || !UUID.test(revision)) throw new Error("Не удалось проверить выбранный черновик");
  if (owner === journalOwner) return "in-use";
  const key = journalKey(account, chat);
  return journalLocks().request("ec-draft-owner-v3:" + owner, { ifAvailable: true }, async lock => {
    if (!lock) return "in-use" as const;
    const changed = await lockedJournal(account, chat, journal => {
      const item = journal.snapshots[owner];
      if (!item || item.revision !== revision) return { changed: false, result: false };
      delete journal.snapshots[owner];
      return { changed: true, result: true };
    });
    const emergency = readEmergency(owner);
    let deleted = changed;
    if (emergency.entries[key]?.revision === revision) {
      delete emergency.entries[key];
      if (Object.keys(emergency.entries).length === 0) localStorage.removeItem(emergencyKey(owner));
      else localStorage.setItem(emergencyKey(owner), JSON.stringify(emergency));
      deleted = true;
    }
    const sessionKey = sessionDraftKey(key, owner);
    const raw = sessionStorage.getItem(sessionKey);
    if (raw !== null) {
      let entry: unknown;
      try { entry = JSON.parse(raw); } catch { throw new Error("Не удалось проверить копию вкладки"); }
      const current = entry as Partial<StagedDraft> | null;
      if (current?.owner === owner && current.revision === revision) {
        sessionStorage.removeItem(sessionKey);
        deleted = true;
      }
    }
    return deleted ? "deleted" as const : "not-found" as const;
  });
}

/** Distinct session slot per owner prevents a clone overwriting old data. */
function sessionDraftKey(key: string, owner: string): string { return key + ":owner:" + owner; }
export function listSessionDrafts(account: string, chat: string): StagedDraft[] {
  const key = journalKey(account, chat);
  const prefix = key + ":owner:";
  const slots: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const slot = sessionStorage.key(i);
    if (slot === key || slot?.startsWith(prefix)) slots.push(slot);
    if (slots.length > 512) throw new Error("Слишком много черновиков вкладки");
  }
  return slots.map(slot => {
    const raw = sessionStorage.getItem(slot);
    let value: unknown;
    try { value = JSON.parse(raw ?? "null"); } catch { throw new Error("Не удалось прочитать черновик вкладки"); }
    const entry = value as Partial<StagedDraft> | null;
    if (!entry || typeof entry.owner !== "string" || !UUID.test(entry.owner) || typeof entry.revision !== "string" || !UUID.test(entry.revision) || typeof entry.text !== "string") throw new Error("Не удалось прочитать черновик вкладки");
    if (slot !== key && slot !== sessionDraftKey(key, entry.owner)) throw new Error("Не удалось проверить владельца черновика вкладки");
    return entry as StagedDraft;
  }).filter(entry => entry.text.length > 0);
}
