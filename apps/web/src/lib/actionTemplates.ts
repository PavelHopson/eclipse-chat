import type { ActionItemPriority } from "./socket";

// Personal convenience data, not a vault: stored only in this browser/profile.
export const MAX_ACTION_TEMPLATES = 10;
export const MAX_TEMPLATE_NAME = 60;
export const MAX_TEMPLATE_DESCRIPTION = 4000;
export const MAX_TEMPLATE_BYTES = 128 * 1024;

export type ActionTemplateInput = {
  name: string;
  description: string;
  priority: ActionItemPriority;
};
export type ActionTemplate = ActionTemplateInput & { id: string };
export type ActionTemplateErrorCode = "INVALID" | "LIMIT" | "DUPLICATE" | "CORRUPT" | "STORAGE_UNAVAILABLE" | "QUOTA" | "CONFLICT" | "NOT_FOUND" | "ID_UNAVAILABLE" | "LOCK_UNAVAILABLE";
export type ActionTemplatesReadResult = {
  templates: ActionTemplate[];
  raw: string | null;
  error: string | null;
  code: ActionTemplateErrorCode | null;
};
export type ActionTemplatesWriteResult = ActionTemplatesReadResult & { ok: boolean };
type TemplateStorage = Pick<Storage, "getItem" | "setItem">;
type Envelope = { version: 1; ownerUserId: string; templates: ActionTemplate[] };

const priorities: ActionItemPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const invalidControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
class TemplateError extends Error {
  constructor(readonly code: ActionTemplateErrorCode, message: string) { super(message); }
}
function fail(code: ActionTemplateErrorCode, message: string): never { throw new TemplateError(code, message); }
function record(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail("INVALID", "Некорректные данные шаблона");
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== "string" || !allowed.includes(key) || ["__proto__", "prototype", "constructor"].includes(key) || !descriptor.enumerable || !("value" in descriptor)) fail("INVALID", "Некорректные поля шаблона");
  }
  return value as Record<string, unknown>;
}
function checkedUserId(value: string): string {
  if (typeof value !== "string" || !value || value.length > 128 || value.trim() !== value || invalidControls.test(value) || /[\r\n\t]/.test(value)) fail("INVALID", "Не удалось определить текущий профиль");
  return value;
}
export function actionTemplateStorageKey(userId: string): string {
  checkedUserId(userId);
  try { return "eclipse-chat.action-templates.v1." + encodeURIComponent(userId); }
  catch (_) { fail("INVALID", "Не удалось определить текущий профиль"); }
}
function checkedText(value: unknown, max: number, label: string, multiline = false): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || invalidControls.test(value) || (!multiline && /[\r\n\t]/.test(value))) fail("INVALID", `${label}: от 1 до ${max} символов`);
  return value.trim();
}
function input(value: unknown): ActionTemplateInput {
  const data = record(value, ["name", "description", "priority"]);
  if (!priorities.includes(data.priority as ActionItemPriority)) fail("INVALID", "Выберите приоритет шаблона");
  return { name: checkedText(data.name, MAX_TEMPLATE_NAME, "Название"), description: checkedText(data.description, MAX_TEMPLATE_DESCRIPTION, "Описание", true), priority: data.priority as ActionItemPriority };
}
function nameKey(name: string): string { return name.normalize("NFC").toLocaleLowerCase("ru-RU"); }
function checkedId(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value)) fail("INVALID", "Некорректный ID шаблона");
  return value;
}
function decode(raw: string | null, userId: string): ActionTemplate[] {
  if (raw === null) return [];
  if (typeof raw !== "string" || new TextEncoder().encode(raw).byteLength > MAX_TEMPLATE_BYTES) fail("CORRUPT", "Сохранённые шаблоны повреждены. Данные не перезаписаны");
  try {
    const data = record(JSON.parse(raw), ["version", "ownerUserId", "templates"]);
    if (data.version !== 1 || data.ownerUserId !== userId || !Array.isArray(data.templates) || data.templates.length > MAX_ACTION_TEMPLATES) fail("INVALID", "Некорректная коллекция");
    const ids = new Set<string>(), names = new Set<string>();
    return data.templates.map((value: unknown) => {
      const row = record(value, ["id", "name", "description", "priority"]);
      const template = { id: checkedId(row.id), ...input({ name: row.name, description: row.description, priority: row.priority }) };
      const key = nameKey(template.name);
      if (ids.has(template.id) || names.has(key)) fail("INVALID", "Повтор шаблона");
      ids.add(template.id); names.add(key);
      return template;
    });
  } catch (_) { fail("CORRUPT", "Сохранённые шаблоны повреждены. Данные не перезаписаны"); }
}
function storageOrDefault(storage?: TemplateStorage): TemplateStorage { return storage === undefined ? globalThis.localStorage : storage; }
function readStorage(storage: TemplateStorage, key: string): string | null {
  try { return storage.getItem(key); }
  catch (_) { fail("STORAGE_UNAVAILABLE", "Хранилище шаблонов недоступно. Черновик задачи остаётся в форме"); }
}
function failure(error: unknown, current: ActionTemplatesReadResult): ActionTemplatesWriteResult {
  return { ...current, ok: false, error: error instanceof TemplateError ? error.message : "Хранилище шаблонов недоступно. Черновик задачи остаётся в форме", code: error instanceof TemplateError ? error.code : "STORAGE_UNAVAILABLE" };
}
export function readActionTemplates(userId: string, storage?: TemplateStorage): ActionTemplatesReadResult {
  let raw: string | null = null;
  try {
    const key = actionTemplateStorageKey(userId);
    raw = readStorage(storageOrDefault(storage), key);
    return { templates: decode(raw, userId), raw, error: null, code: null };
  } catch (error) {
    const { templates, error: message, code } = failure(error, { templates: [], raw, error: null, code: null });
    return { templates, raw, error: message, code };
  }
}
function mutateLocked(userId: string, expectedRaw: string | null, storage: TemplateStorage | undefined, change: (templates: ActionTemplate[]) => ActionTemplate[]): ActionTemplatesWriteResult {
  let current: ActionTemplatesReadResult = { templates: [], raw: null, error: null, code: null };
  try {
    const key = actionTemplateStorageKey(userId), store = storageOrDefault(storage);
    current = readActionTemplates(userId, store);
    if (current.error) return { ...current, ok: false };
    if ((expectedRaw !== null && typeof expectedRaw !== "string") || expectedRaw !== current.raw) fail("CONFLICT", "Шаблоны изменились в другой вкладке. Нажмите «Перечитать шаблоны»");
    const templates = change(current.templates);
    const envelope: Envelope = { version: 1, ownerUserId: userId, templates };
    const raw = JSON.stringify(envelope);
    if (new TextEncoder().encode(raw).byteLength > MAX_TEMPLATE_BYTES) fail("LIMIT", "Шаблоны занимают слишком много места");
    // The enclosing Web Lock serializes cooperating tabs; this also catches
    // a non-cooperating writer that changed the snapshot before this check.
    if (readStorage(store, key) !== expectedRaw) fail("CONFLICT", "Шаблоны изменились в другой вкладке. Нажмите «Перечитать шаблоны»");
    try { store.setItem(key, raw); }
    catch (error) {
      if ((error as { name?: string })?.name === "QuotaExceededError" || (error as { name?: string })?.name === "NS_ERROR_DOM_QUOTA_REACHED") fail("QUOTA", "Нет места для шаблона. Черновик задачи остаётся в форме");
      fail("STORAGE_UNAVAILABLE", "Не удалось сохранить шаблоны. Черновик задачи остаётся в форме");
    }
    return { ok: true, templates, raw, error: null, code: null };
  } catch (error) { return failure(error, current); }
}
async function mutate(userId: string, expectedRaw: string | null, storage: TemplateStorage | undefined, change: (templates: ActionTemplate[]) => ActionTemplate[]): Promise<ActionTemplatesWriteResult> {
  try {
    const key = actionTemplateStorageKey(userId);
    const locks = globalThis.navigator?.locks;
    if (!locks || typeof locks.request !== "function") fail("LOCK_UNAVAILABLE", "Безопасное сохранение шаблонов недоступно. Обновите браузер или приложение");
    try { return await locks.request(key, { mode: "exclusive" }, () => mutateLocked(userId, expectedRaw, storage, change)); }
    catch (_) { fail("LOCK_UNAVAILABLE", "Не удалось получить доступ к шаблонам. Попробуйте ещё раз или обновите браузер"); }
  } catch (error) { return failure(error, readActionTemplates(userId, storage)); }
}
export function saveActionTemplate(userId: string, value: ActionTemplateInput, expectedRaw: string | null, storage?: TemplateStorage): Promise<ActionTemplatesWriteResult> {
  return mutate(userId, expectedRaw, storage, templates => {
    const draft = input(value);
    if (templates.some(template => nameKey(template.name) === nameKey(draft.name))) fail("DUPLICATE", "Шаблон с таким названием уже есть. Выберите другое название");
    if (templates.length >= MAX_ACTION_TEMPLATES) fail("LIMIT", "Можно сохранить 10 шаблонов. Сначала удалите ненужный");
    let id: string | undefined;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = globalThis.crypto.randomUUID();
        if (uuid.test(candidate) && !templates.some(template => template.id === candidate)) { id = candidate; break; }
      }
    } catch (_) { /* No weak random fallback. */ }
    if (!id) fail("ID_UNAVAILABLE", "Не удалось создать ID шаблона. Откройте Chat через HTTPS и попробуйте снова");
    return [...templates, { id, ...draft }];
  });
}
export function removeActionTemplate(userId: string, id: string, expectedRaw: string | null, storage?: TemplateStorage): Promise<ActionTemplatesWriteResult> {
  return mutate(userId, expectedRaw, storage, templates => {
    checkedId(id);
    if (!templates.some(template => template.id === id)) fail("NOT_FOUND", "Шаблон уже удалён. Нажмите «Перечитать шаблоны»");
    return templates.filter(template => template.id !== id);
  });
}
