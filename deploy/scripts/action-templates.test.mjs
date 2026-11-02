import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const output = ts.transpileModule(readFileSync(join(root, "apps/web/src/lib/actionTemplates.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const draft = { name: " Проверка интерфейса ", description: " Проверить форму\nи повторную попытку. ", priority: "HIGH" };
const memory = () => {
  const values = new Map(), reads = [], writes = [];
  return { values, reads, writes, getItem(key) { reads.push(key); return values.get(key) ?? null; }, setItem(key, value) { writes.push({ key, value }); values.set(key, value); } };
};
function lockManager() {
  const tails = new Map(), requests = [];
  return { requests, request(name, options, callback) {
    assert.equal(options.mode, "exclusive"); requests.push(name);
    const result = (tails.get(name) ?? Promise.resolve()).then(() => callback({ name, mode: "exclusive" }));
    tails.set(name, result.catch(() => {}));
    return result;
  } };
}
function harness(store = memory(), cryptoOverride, locks = lockManager()) {
  let sequence = 0;
  const context = createContext({ exports: {}, TextEncoder, localStorage: store, store, navigator: locks === null ? {} : { locks }, crypto: cryptoOverride ?? { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` } });
  runInContext(output, context);
  const run = code => {
    const result = runInContext(code, context);
    const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    return result && typeof result.then === "function" ? result.then(plain) : plain(result);
  };
  return { store, run, constants: context.exports, key: userId => context.exports.actionTemplateStorageKey(userId), call(method, ...args) {
    context.argsJSON = JSON.stringify(args); context.method = method;
    return run("exports[method](...JSON.parse(argsJSON), store)");
  } };
}
async function seeded() {
  const h = harness(), saved = await h.call("saveActionTemplate", "user-a", draft, null);
  assert.equal(saved.ok, true);
  return { h, saved };
}

test("template roundtrip persists only description and priority defaults, scoped to the owner", async () => {
  const { h, saved } = await seeded();
  assert.equal(saved.templates.length, 1);
  assert.equal(saved.templates[0].name, "Проверка интерфейса");
  assert.equal(saved.templates[0].description, "Проверить форму\nи повторную попытку.");
  assert.equal(saved.templates[0].priority, "HIGH");
  assert.match(saved.templates[0].id, /^[a-f0-9-]{36}$/);
  const envelope = JSON.parse(saved.raw);
  assert.deepEqual(Object.keys(envelope), ["version", "ownerUserId", "templates"]);
  assert.equal(envelope.version, 1); assert.equal(envelope.ownerUserId, "user-a");
  assert.deepEqual(Object.keys(envelope.templates[0]).sort(), ["description", "id", "name", "priority"]);
  const fresh = harness(h.store);
  assert.deepEqual(fresh.call("readActionTemplates", "user-a"), { templates: saved.templates, raw: saved.raw, error: null, code: null });
  assert.deepEqual(fresh.run("exports.readActionTemplates('user-a')").templates, saved.templates);
  assert.equal(fresh.run("typeof fetch"), "undefined");
});

test("each account reads and changes only its own namespace; owner mismatch never yields templates", async () => {
  const { h, saved } = await seeded();
  h.store.reads.length = 0;
  const other = h.call("readActionTemplates", "user-b");
  assert.deepEqual(other.templates, []); assert.equal(other.raw, null);
  assert.deepEqual(h.store.reads, [h.key("user-b")]);
  const foreignDelete = await h.call("removeActionTemplate", "user-b", saved.templates[0].id, null);
  assert.equal(foreignDelete.code, "NOT_FOUND");
  assert.equal(h.store.values.get(h.key("user-a")), saved.raw);
  h.store.values.set(h.key("user-b"), saved.raw);
  const misplaced = h.call("readActionTemplates", "user-b");
  assert.equal(misplaced.code, "CORRUPT"); assert.deepEqual(misplaced.templates, []);
  assert.ok(!misplaced.error.includes("Проверка интерфейса"));
  assert.notEqual(h.key("a/b"), h.key("a%2Fb"));
});

test("invalid user identities never access storage", async () => {
  const h = harness();
  for (const userId of ["", " ", " user", "user\nnext", "bad\u0000", "x".repeat(129), "\ud800", null, 19]) {
    assert.equal(h.call("readActionTemplates", userId).code, "INVALID");
    assert.equal((await h.call("saveActionTemplate", userId, draft, null)).ok, false);
  }
  assert.equal(h.store.reads.length, 0); assert.equal(h.store.writes.length, 0);
});

test("invalid drafts and hidden task fields cannot overwrite an existing collection", async () => {
  const { h, saved } = await seeded(), count = h.store.writes.length;
  const changes = [
    d => d.name = "", d => d.description = "  ", d => d.name = "x".repeat(61), d => d.description = "x".repeat(4001),
    d => d.name = "name\nnext", d => d.description = "bad\u0000", d => d.priority = "CRITICAL", d => d.priority = 5,
    d => d.title = "Unwanted title", d => d.assigneeUserId = "other-user", d => d.dueAt = "2030-01-01", d => d.messageId = "foreign-message",
  ];
  for (const change of changes) {
    const value = { ...draft, name: "Новый шаблон" }; change(value);
    const result = await h.call("saveActionTemplate", "user-a", value, saved.raw);
    assert.equal(result.ok, false); assert.equal(result.code, "INVALID");
    assert.deepEqual(result.templates, saved.templates); assert.equal(result.raw, saved.raw);
  }
  assert.equal(h.store.writes.length, count); assert.equal(h.store.values.get(h.key("user-a")), saved.raw);
});

test("template validation rejects prototype, accessor and symbol payloads without invoking getters", async () => {
  const h = harness();
  for (const expression of [
    "Object.assign(Object.create({hidden:true}), {name:'n',description:'d',priority:'NORMAL'})",
    "JSON.parse('{\"name\":\"n\",\"description\":\"d\",\"priority\":\"NORMAL\",\"__proto__\":{\"polluted\":true}}')",
    "{name:'n', description:'d', priority:'NORMAL', [Symbol('extra')]:true}",
    "Object.defineProperty({description:'d',priority:'NORMAL'},'name',{get(){throw Error('getter invoked')},enumerable:true})",
  ]) {
    const result = await h.run(`exports.saveActionTemplate('user-a', ${expression}, null, store)`);
    assert.equal(result.code, "INVALID");
    assert.ok(!result.error.includes("getter invoked"));
  }
  assert.equal(h.store.writes.length, 0);
  assert.equal(h.run("({}).polluted"), undefined);
});

test("duplicate names are rejected consistently and ten-item limit never auto-evicts", async () => {
  const { h, saved } = await seeded();
  assert.equal((await h.call("saveActionTemplate", "user-a", { ...draft, name: " проверка ИНТЕРФЕЙСА " }, saved.raw)).code, "DUPLICATE");
  let last = saved;
  for (let i = 1; i < 10; i++) {
    last = await h.call("saveActionTemplate", "user-a", { ...draft, name: "Шаблон " + i }, last.raw);
    assert.equal(last.ok, true);
  }
  const before = h.store.writes.length;
  const over = await h.call("saveActionTemplate", "user-a", { ...draft, name: "Одиннадцатый" }, last.raw);
  assert.equal(over.code, "LIMIT"); assert.equal(h.store.writes.length, before);
  assert.equal(h.store.values.get(h.key("user-a")), last.raw);
  assert.equal(new Set(last.templates.map(t => t.id)).size, 10);
  assert.equal(last.templates[0].id, saved.templates[0].id);
});

test("corrupted and foreign schemas remain untouched by read, add and delete", async () => {
  const { h, saved } = await seeded(), good = JSON.parse(saved.raw);
  const invalid = ["{broken", "null", "[]", " ".repeat(h.constants.MAX_TEMPLATE_BYTES + 1)];
  for (const change of [
    d => d.version = 2, d => d.ownerUserId = "user-b", d => d.templates = {}, d => d.templates.push(d.templates[0]),
    d => d.templates[0].id = "not-uuid", d => d.templates[0].priority = "OTHER", d => d.templates[0].description = "",
    d => d.templates[0].name = "bad\u0000", d => d.templates[0].extra = true, d => d.extra = true,
  ]) { const value = structuredClone(good); change(value); invalid.push(JSON.stringify(value)); }
  invalid.push(saved.raw.replace('"version":1', '"version":1,"__proto__":{"polluted":true}'));
  for (const raw of invalid) {
    h.store.values.set(h.key("user-a"), raw);
    const before = h.store.writes.length;
    for (const result of [h.call("readActionTemplates", "user-a"), await h.call("saveActionTemplate", "user-a", draft, raw), await h.call("removeActionTemplate", "user-a", saved.templates[0].id, raw)]) {
      assert.equal(result.code, "CORRUPT"); assert.deepEqual(result.templates, []);
    }
    assert.equal(h.store.values.get(h.key("user-a")), raw); assert.equal(h.store.writes.length, before);
  }
});

test("stale snapshots and a change immediately before writing fail without losing the newer data", async () => {
  const { h, saved } = await seeded();
  const second = await h.call("saveActionTemplate", "user-a", { ...draft, name: "Второй" }, saved.raw);
  const count = h.store.writes.length;
  for (const result of [await h.call("saveActionTemplate", "user-a", { ...draft, name: "Третий" }, saved.raw), await h.call("removeActionTemplate", "user-a", saved.templates[0].id, saved.raw)]) assert.equal(result.code, "CONFLICT");
  assert.equal(h.store.values.get(h.key("user-a")), second.raw); assert.equal(h.store.writes.length, count);
  let reads = 0, writes = 0;
  const racing = harness({ getItem: () => ++reads === 1 ? saved.raw : second.raw, setItem: () => writes++ });
  const result = await racing.call("saveActionTemplate", "user-a", { ...draft, name: "Третий" }, saved.raw);
  assert.equal(result.code, "CONFLICT"); assert.equal(writes, 0);
});

test("quota and denied storage errors retain the persisted list and never claim success", async () => {
  const { saved } = await seeded();
  const store = { getItem: () => saved.raw, setItem() { const error = Error("private diagnostic"); error.name = "QuotaExceededError"; throw error; } };
  const h = harness(store);
  for (const result of [await h.call("saveActionTemplate", "user-a", { ...draft, name: "Новый" }, saved.raw), await h.call("removeActionTemplate", "user-a", saved.templates[0].id, saved.raw)]) {
    assert.equal(result.ok, false); assert.equal(result.code, "QUOTA"); assert.deepEqual(result.templates, saved.templates); assert.equal(result.raw, saved.raw); assert.ok(!result.error.includes("private"));
  }
  const denied = harness({ getItem() { throw Error("private diagnostic"); }, setItem() { assert.fail("must not write"); } });
  assert.equal(denied.call("readActionTemplates", "user-a").code, "STORAGE_UNAVAILABLE");
  assert.equal((await denied.call("saveActionTemplate", "user-a", draft, null)).code, "STORAGE_UNAVAILABLE");
  assert.equal(denied.run("Object.defineProperty(globalThis,'localStorage',{get(){throw Error('private')}}); exports.readActionTemplates('user-a')").code, "STORAGE_UNAVAILABLE");
});

test("explicit removal affects one template and unknown or invalid IDs do not rewrite storage", async () => {
  const { h, saved } = await seeded();
  const second = await h.call("saveActionTemplate", "user-a", { ...draft, name: "Второй" }, saved.raw);
  const removed = await h.call("removeActionTemplate", "user-a", saved.templates[0].id, second.raw);
  assert.equal(removed.ok, true); assert.equal(removed.templates.length, 1); assert.equal(removed.templates[0].name, "Второй");
  const before = h.store.writes.length;
  assert.equal((await h.call("removeActionTemplate", "user-a", saved.templates[0].id, removed.raw)).code, "NOT_FOUND");
  assert.equal((await h.call("removeActionTemplate", "user-a", "../foreign", removed.raw)).code, "INVALID");
  assert.equal(h.store.writes.length, before);
  const empty = await h.call("removeActionTemplate", "user-a", removed.templates[0].id, removed.raw);
  assert.equal(empty.ok, true); assert.deepEqual(h.call("readActionTemplates", "user-a").templates, []);
});

test("secure UUID unavailability and repeated collisions never fall back to weak IDs", async () => {
  const h = harness(memory(), {});
  assert.equal((await h.call("saveActionTemplate", "user-a", draft, null)).code, "ID_UNAVAILABLE");
  assert.equal(h.store.writes.length, 0);
  const { h: source, saved } = await seeded();
  const collision = harness(source.store, { randomUUID: () => saved.templates[0].id });
  assert.equal((await collision.call("saveActionTemplate", "user-a", { ...draft, name: "Второй" }, saved.raw)).code, "ID_UNAVAILABLE");
  assert.equal(source.store.values.get(source.key("user-a")), saved.raw);
});

test("HTML and script-like content remains bounded literal text, with all four priority values supported", async () => {
  const h = harness(); let raw = null;
  for (const priority of ["LOW", "NORMAL", "HIGH", "URGENT"]) {
    const result = await h.call("saveActionTemplate", "user-a", { name: priority, description: '<img src=x onerror="alert(1)">\n<script>run()</script>', priority }, raw);
    assert.equal(result.ok, true); assert.equal(result.templates.at(-1).description, '<img src=x onerror="alert(1)">\n<script>run()</script>'); raw = result.raw;
  }
  const result = await h.call("saveActionTemplate", "user-a", { name: "я".repeat(60), description: "界".repeat(4000), priority: "NORMAL" }, raw);
  assert.equal(result.ok, true);
});

test("concurrent additions serialize across tabs and stale writer conflicts instead of losing either snapshot", async () => {
  const { h: source, saved } = await seeded(), locks = lockManager();
  const first = harness(source.store, undefined, locks), second = harness(source.store, undefined, locks);
  let release;
  const held = locks.request(first.key("user-a"), { mode: "exclusive" }, () => new Promise(resolve => { release = resolve; }));
  await Promise.resolve();
  const reads = source.store.reads.length, writes = source.store.writes.length;
  const addOne = first.call("saveActionTemplate", "user-a", { ...draft, name: "Из первой вкладки" }, saved.raw);
  const addTwo = second.call("saveActionTemplate", "user-a", { ...draft, name: "Из второй вкладки" }, saved.raw);
  await Promise.resolve();
  assert.equal(source.store.reads.length, reads); assert.equal(source.store.writes.length, writes);
  release(); await held;
  const [one, two] = await Promise.all([addOne, addTwo]);
  assert.equal(one.ok, true); assert.equal(two.ok, false); assert.equal(two.code, "CONFLICT");
  assert.deepEqual(two.templates, one.templates); assert.equal(two.raw, one.raw);
  assert.equal(source.store.writes.length, writes + 1);
  assert.equal(source.store.values.get(first.key("user-a")), one.raw);
  assert.ok(locks.requests.every(key => key === first.key("user-a")));
  const retried = await second.call("saveActionTemplate", "user-a", { ...draft, name: "Из второй вкладки" }, two.raw);
  assert.equal(retried.ok, true); assert.equal(retried.templates.length, 3);
  assert.ok(retried.templates.some(t => t.name === "Из первой вкладки"));
  assert.ok(retried.templates.some(t => t.name === "Из второй вкладки"));
});

test("concurrent delete and save use the same exclusive lock and cannot resurrect a removed template", async () => {
  const { h: source, saved } = await seeded(), locks = lockManager();
  const first = harness(source.store, undefined, locks), second = harness(source.store, undefined, locks);
  const [removed, added] = await Promise.all([
    first.call("removeActionTemplate", "user-a", saved.templates[0].id, saved.raw),
    second.call("saveActionTemplate", "user-a", { ...draft, name: "Новый" }, saved.raw),
  ]);
  assert.equal(removed.ok, true); assert.equal(added.code, "CONFLICT");
  assert.deepEqual(second.call("readActionTemplates", "user-a").templates, []);
  assert.equal(source.store.values.get(first.key("user-a")), removed.raw);
  assert.deepEqual(locks.requests, [first.key("user-a"), first.key("user-a")]);
});

test("unavailable or rejected Web Locks keep existing templates readable and deny every write", async () => {
  const { h: source, saved } = await seeded(), writes = source.store.writes.length;
  for (const locks of [null, {}, { request() { return Promise.reject(Error("private lock detail")); } }]) {
    const h = harness(source.store, undefined, locks);
    assert.deepEqual(h.call("readActionTemplates", "user-a").templates, saved.templates);
    for (const result of [await h.call("saveActionTemplate", "user-a", { ...draft, name: "Новый" }, saved.raw), await h.call("removeActionTemplate", "user-a", saved.templates[0].id, saved.raw)]) {
      assert.equal(result.ok, false); assert.equal(result.code, "LOCK_UNAVAILABLE");
      assert.deepEqual(result.templates, saved.templates); assert.equal(result.raw, saved.raw);
      assert.ok(!result.error.includes("private lock detail"));
    }
    assert.equal(source.store.writes.length, writes);
    assert.equal(source.store.values.get(h.key("user-a")), saved.raw);
  }
});
