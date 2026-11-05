import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
// Local synthetic QA only: never load credentials or contact a real service.
// Set AUTH_SOURCE_ROOT to a candidate tree containing apps/web/src.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceRoot = process.env.AUTH_SOURCE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectRequire = createRequire(path.join(process.env.AUTH_TEST_DEPENDENCY_ROOT || sourceRoot, 'package.json'));
const ts = projectRequire('typescript');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function sleepTick() { return new Promise(resolve => setImmediate(resolve)); }

// Approximation of Web Locks: queue by name, release after callback settles.
// This is not a browser implementation and cannot prove Web Locks integration.
function lockManager() {
  const tails = new Map();
  return { async request(name, options, callback) {
    if (typeof options === 'function') { callback = options; options = {}; }
    const before = tails.get(name) || Promise.resolve();
    const released = deferred();
    const tail = before.catch(() => {}).then(() => released.promise);
    tails.set(name, tail);
    await before.catch(() => {});
    if (options?.signal?.aborted) { released.resolve(); throw new Error('AbortError'); }
    try { return await callback({ name, mode: 'exclusive' }); }
    finally { released.resolve(); if (tails.get(name) === tail) tails.delete(name); }
  } };
}

function world(options = {}) {
  const values = new Map(), listeners = new Map(), lock = lockManager();
  const pending = [], requests = [];
  function fetch(url, init = {}) {
    const request = { url: String(url), method: init.method || 'GET', authorization: new Headers(init.headers).get('authorization'), headers: new Headers(init.headers), signal: init.signal, control: deferred() };
    requests.push(request); pending.push(request);
    return request.control.promise;
  }
  function tab(label) {
    const handlers = new Map(); listeners.set(label, handlers);
    const win = {
      addEventListener(type, fn) { const a = handlers.get(type) || []; a.push(fn); handlers.set(type, a); },
      removeEventListener(type, fn) { handlers.set(type, (handlers.get(type) || []).filter(x => x !== fn)); },
      dispatchEvent(event) { for (const fn of handlers.get(event.type) || []) fn(event); return true; },
      location: { origin: 'http://localhost:5173', href: 'http://localhost:5173/', reload() {} },
      setTimeout: (fn, ms) => setTimeout(fn, options.fastTimeout && ms === 30000 ? 10 : ms), clearTimeout,
    };
    const localStorage = {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { const oldValue = this.getItem(key); const newValue = String(value); values.set(key, newValue); for (const [other, events] of listeners) if (other !== label) queueMicrotask(() => (events.get('storage') || []).forEach(fn => fn({ key, oldValue, newValue, storageArea: localStorage }))); },
      removeItem(key) { const oldValue = this.getItem(key); values.delete(key); for (const [other, events] of listeners) if (other !== label) queueMicrotask(() => (events.get('storage') || []).forEach(fn => fn({ key, oldValue, newValue: null, storageArea: localStorage }))); },
    };
    const context = vm.createContext({ window: win, localStorage, navigator: options.withoutLocks ? {} : { locks: lock }, fetch, Response, Headers, AbortController, DOMException, URL, crypto: require('node:crypto').webcrypto, atob, btoa, setTimeout, clearTimeout, queueMicrotask, console, CustomEvent: class { constructor(type, opts = {}) { this.type = type; this.detail = opts.detail; } } });
    const loaded = new Map();
    function load(relative) {
      const file = path.resolve(sourceRoot, 'apps/web/src/lib', relative.endsWith('.ts') ? relative : `${relative}.ts`);
      if (loaded.has(file)) return loaded.get(file).exports;
      let source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.BASE_URL', '"/"');
      const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      const module = { exports: {} }; loaded.set(file, module);
      const requireLocal = name => {
        if (!name.startsWith('.')) return projectRequire(name);
        return load(path.relative(path.resolve(sourceRoot, 'apps/web/src/lib'), path.resolve(path.dirname(file), name)));
      };
      const wrapper = vm.runInContext(`(function(exports, require, module) {${js}\n})`, context, { filename: file });
      wrapper(module.exports, requireLocal, module);
      return module.exports;
    }
    return { api: load('api'), vault: load('accountVault'), storage: load('storage') };
  }
  const next = async () => { for (let i = 0; !pending.length && i < 30; i++) await sleepTick(); assert.ok(pending.length, 'Expected a local synthetic request'); return pending.shift(); };
  return { tab, next, requests, values };
}
function user(id) { return { id, email: `${id}@fixture.invalid`, displayName: id, avatar: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' }; }
async function seed(a) {
  if (typeof a.storage.initializeAuthStore === 'function') await a.storage.initializeAuthStore();
  const expected = () => typeof a.storage.captureAuth === 'function' ? a.storage.captureAuth().identity : undefined;
  await a.vault.upsertAccountSession(user('alpha'), 'fixture-access-alpha', 'fixture-refresh-alpha', expected());
  await a.vault.upsertAccountSession(user('beta'), 'fixture-access-beta', 'fixture-refresh-beta', expected());
  assert.ok(await a.vault.activateStoredAccount('alpha'));
  if (typeof a.storage.bindDisplayedIdentity === 'function') a.storage.bindDisplayedIdentity(a.storage.captureAuth().identity);
}
async function activate(tab, id) {
  const result = await tab.vault.activateStoredAccount(id);
  if (result && typeof tab.storage.bindDisplayedIdentity === 'function') tab.storage.bindDisplayedIdentity(tab.storage.captureAuth().identity);
  return result;
}
function bind(tab) { if (typeof tab.storage.bindDisplayedIdentity === 'function') tab.storage.bindDisplayedIdentity(tab.storage.captureAuth().identity); }
function assertBeta(a) {
  assert.ok(a.vault.getActiveAccountId() === 'beta', 'Selected account changed unexpectedly');
  assert.ok(a.storage.getAccess() === 'fixture-access-beta', 'Another account access changed');
  assert.ok(a.storage.getRefresh() === 'fixture-refresh-beta', 'Another account refresh changed');
  const b = a.vault.listStoredAccounts().find(x => x.id === 'beta');
  assert.ok(b?.accessToken === 'fixture-access-beta' && b?.refreshToken === 'fixture-refresh-beta', 'Another account vault changed');
}


test('precise 426 stops further calls without retry or token changes', async () => {
  const w = world(), a = w.tab('one'); await seed(a);
  const before = JSON.stringify(a.vault.listStoredAccounts());
  const result = a.api.api('/api/fixture/mutate', { method: 'POST', body: '{}' });
  const call = await w.next();
  call.control.resolve(Response.json({ code: 'CLIENT_UPDATE_REQUIRED' }, { status: 426 }));
  await assert.rejects(result, error => error?.name === 'ClientUpdateRequiredError');
  assert.equal(a.api.isClientUpdateRequired(), true);
  assert.equal(JSON.stringify(a.vault.listStoredAccounts()), before);
  await assert.rejects(a.api.api('/api/fixture/mutate', { method: 'POST' }), error => error?.name === 'ClientUpdateRequiredError');
  assert.equal(w.requests.length, 1, 'Update gate must never retry a mutation');
});

test('refresh 426 preserves both accounts and clears only confirmed-rejected attempt', async () => {
  const w = world(), a = w.tab('one'); await seed(a);
  const before = JSON.stringify(a.vault.listStoredAccounts());
  const result = a.api.refreshAccessToken();
  const call = await w.next();
  assert.equal(call.headers.get('x-eclipse-auth-protocol'), '2');
  call.control.resolve(Response.json({ code: 'CLIENT_UPDATE_REQUIRED' }, { status: 426 }));
  await assert.rejects(result, error => error?.name === 'ClientUpdateRequiredError');
  assert.equal(JSON.stringify(a.vault.listStoredAccounts()), before);
  assert.equal(w.requests.length, 1, 'A rejected refresh must not be repeated');
});

test('426 without the exact server code does not pretend an update was required', async () => {
  const w = world(), a = w.tab('one'); await seed(a);
  const result = a.api.api('/api/fixture/read');
  const call = await w.next();
  call.control.resolve(Response.json({ code: 'OTHER' }, { status: 426 }));
  const response = await result;
  assert.equal(response.status, 426);
  assert.equal(a.api.isClientUpdateRequired(), false);
  assert.equal(w.requests.length, 1);
});

test('QR exchanges and media bootstrap advertise protocol 2', async () => {
  const w = world(), a = w.tab('one'); await seed(a);
  for (const path of ['/api/auth/qr/exchange', '/api/auth/qr/exchange-code', '/api/auth/media-session']) {
    const result = a.api.apiJsonForAuth(a.storage.captureAuth().identity, path, { method: 'POST', body: '{}' }, false, false);
    const call = await w.next();
    assert.equal(call.headers.get('x-eclipse-auth-protocol'), '2', path);
    call.control.resolve(Response.json({ ok: true }));
    assert.equal((await result).ok, true);
  }
});

test('authenticated API requests advertise protocol 2', async () => {
  const w = world(), a = w.tab('one'); await seed(a);
  const result = a.api.api('/api/fixture/read');
  const call = await w.next();
  assert.equal(call.headers.get('x-eclipse-auth-protocol'), '2');
  call.control.resolve(Response.json({ ok: true }));
  assert.equal((await result).status, 200);
});


test('legacy profile GET performs exactly one coordinated upgrade and profile retry', async () => {
  const w=world(), a=w.tab('one'); await seed(a);
  const result=a.api.apiJsonForAuth(a.storage.captureAuth().identity, '/api/auth/me');
  const first=await w.next(); assert.equal(first.headers.get('x-eclipse-auth-protocol'),'2');
  first.control.resolve(Response.json({code:'SESSION_UPGRADE_REQUIRED'},{status:426}));
  const refresh=await w.next(); assert.match(refresh.url,/\/auth\/refresh$/); assert.equal(refresh.headers.get('x-eclipse-auth-protocol'),'2');
  refresh.control.resolve(Response.json({accessToken:'fixture-access-alpha-next',refreshToken:'fixture-refresh-alpha-next'}));
  const again=await w.next(); assert.match(again.url,/\/auth\/me$/); assert.equal(again.authorization,'Bearer fixture-access-alpha-next');
  again.control.resolve(Response.json({user:user('alpha')}));
  assert.equal((await result).user.id,'alpha'); assert.equal(w.requests.length,3);
});

test('legacy-session response on mutation never triggers refresh or replay', async () => {
  const w=world(), a=w.tab('one'); await seed(a);
  const before=JSON.stringify(a.vault.listStoredAccounts());
  const result=a.api.api('/api/fixture/mutate',{method:'POST',body:'{}'}); const call=await w.next();
  assert.equal(call.headers.get('x-eclipse-auth-protocol'),'2');
  call.control.resolve(Response.json({code:'SESSION_UPGRADE_REQUIRED'},{status:426}));
  await assert.rejects(result,e=>e?.name==='SessionUpgradeRequiredError' && /повторите/i.test(e.message));
  assert.equal(w.requests.length,1); assert.equal(JSON.stringify(a.vault.listStoredAccounts()),before);
  assert.equal(a.api.isClientUpdateRequired(),false);
});

test('late update response from A after selecting B never gates B', async () => {
  const w=world(), a=w.tab('one'), b=w.tab('two'); await seed(a);
  const result=a.api.api('/api/fixture/mutate',{method:'POST',body:'{}'}); const call=await w.next();
  await activate(b,'beta'); call.control.resolve(Response.json({code:'CLIENT_UPDATE_REQUIRED'},{status:426}));
  await assert.rejects(result,e=>e?.name==='AuthStateChangedError'); assert.equal(a.api.isClientUpdateRequired(),false); assertBeta(b);
  const next=b.api.api('/api/fixture/read'); const bcall=await w.next(); bcall.control.resolve(Response.json({ok:true}));
  assert.equal((await next).status,200);
});

test('identity is rechecked after slow 426 body before update gate', async () => {
  const w=world(), a=w.tab('one'), b=w.tab('two'); await seed(a);
  let controller; const stream=new ReadableStream({start(c){controller=c}});
  const result=a.api.api('/api/fixture/read'); const call=await w.next();
  call.control.resolve(new Response(stream,{status:426,headers:{'content-type':'application/json'}})); await sleepTick();
  await activate(b,'beta'); controller.enqueue(new TextEncoder().encode('{"code":"CLIENT_UPDATE_REQUIRED"}')); controller.close();
  await assert.rejects(result,e=>e?.name==='AuthStateChangedError'); assert.equal(a.api.isClientUpdateRequired(),false); assertBeta(b);
});

test('late refresh 426 clears only A attempt without gating selected B', async () => {
  const w=world(), a=w.tab('one'), b=w.tab('two'); await seed(a);
  const result=a.api.refreshAccessToken(); const call=await w.next(); await activate(b,'beta');
  call.control.resolve(Response.json({code:'CLIENT_UPDATE_REQUIRED'},{status:426}));
  await assert.rejects(result,e=>e?.name==='AuthStateChangedError'); assert.equal(a.api.isClientUpdateRequired(),false); assertBeta(b);
  assert.equal(b.vault.listStoredAccounts().find(x=>x.id==='alpha').refreshAttempt,undefined);
});

test('lost legacy refresh response is not replayed and preserves stored accounts', async () => {
  const w=world(), a=w.tab('one'); await seed(a); const before=a.storage.getRefresh();
  const result=a.api.apiJsonForAuth(a.storage.captureAuth().identity,'/api/auth/me');
  (await w.next()).control.resolve(Response.json({code:'SESSION_UPGRADE_REQUIRED'},{status:426}));
  const refresh=await w.next(); refresh.control.reject(new Error('fixture network failure'));
  await assert.rejects(result,e=>e?.name==='SessionUpgradeRequiredError');
  assert.equal(a.storage.getRefresh(),before); assert.equal(w.requests.length,2);
  const second=a.api.apiJsonForAuth(a.storage.captureAuth().identity,'/api/auth/me');
  (await w.next()).control.resolve(Response.json({code:'SESSION_UPGRADE_REQUIRED'},{status:426}));
  await assert.rejects(second,e=>e?.name==='SessionUpgradeRequiredError');
  assert.equal(w.requests.filter(x=>x.url.endsWith('/api/auth/refresh')).length,1);
});


test('POST 401 does not refresh or replay and explains manual retry', async () => {
  const w=world(), a=w.tab('one'); await seed(a);
  const before=JSON.stringify(a.vault.listStoredAccounts());
  const result=a.api.api('/api/fixture/mutate',{method:'POST',body:'{}'});
  const req=await w.next(); req.control.resolve(Response.json({error:'Unauthorized'},{status:401}));
  await assert.rejects(result,e=>/проверьте вход и повторите действие вручную/i.test(e?.message));
  assert.equal(w.requests.length,1); assert.equal(JSON.stringify(a.vault.listStoredAccounts()),before);
});

test('GET 401 permits one coordinated refresh and one safe retry', async () => {
  const w=world(), a=w.tab('one'); await seed(a);
  const result=a.api.api('/api/fixture/read');
  (await w.next()).control.resolve(Response.json({error:'Unauthorized'},{status:401}));
  const refresh=await w.next(); assert.match(refresh.url,/\/auth\/refresh$/);
  refresh.control.resolve(Response.json({accessToken:'fixture-access-alpha-next',refreshToken:'fixture-refresh-alpha-next'}));
  const again=await w.next(); assert.equal(again.method,'GET');
  again.control.resolve(Response.json({ok:true}));
  assert.equal((await result).status,200); assert.equal(w.requests.length,3);
});
