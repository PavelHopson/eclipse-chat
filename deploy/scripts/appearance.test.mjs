import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
function load(source, globals = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...globals });
  return exports;
}
function environment(storage = new Map()) {
  const styles = new Map(), dataset = {};
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const document = { documentElement: { dataset, style: { setProperty: (k, v) => styles.set(k, v), removeProperty: k => styles.delete(k) } }, visibilityState: "visible" };
  return { storage, styles, dataset, localStorage, document };
}
const source = read("apps/web/src/lib/appearance.ts");
const p = load(source);

test("only exact six-digit HEX values enter the palette", () => {
  assert.equal(p.normalizeHex("#ABCDEF"), "#abcdef");
  for (const value of ["#abc", "red", "#abcdef00", " #ffffff", "#ffffff\n", "url(https://example.test)", "#abc;--x:red", "<svg onload=alert(1)>", 123, null]) assert.equal(p.normalizeHex(value), null);
  assert.equal(p.parsePalette({ ...p.DEFAULT_PALETTE, unknown: "#abcdef" }), null);
  assert.equal(p.parsePalette([]), null);
});
test("all presets keep normal and secondary text readable on every generated tier", () => {
  for (const preset of p.PALETTE_PRESETS) {
    assert.equal(p.paletteError(preset.colors), null);
    const t = p.paletteTokens(preset.colors);
    for (const bg of ["--ec-bg", "--ec-surface-1", "--ec-surface-2", "--ec-surface-3", "--ec-surface-4"])
      for (const text of ["--ec-text", "--ec-text-muted", "--ec-text-placeholder"]) assert.ok(p.contrast(t[text], t[bg]) >= 4.5, `${preset.name} ${text}/${bg}`);
  }
});
test("dark-only contract rejects bright backgrounds and unreadable text", () => {
  for (const change of [{ background: "#ffffff" }, { surface: "#eeeeee" }, { text: "#111111" }]) assert.equal(p.parsePalette({ ...p.DEFAULT_PALETTE, ...change }), null);
});
test("dark accents receive safe visible states without changing semantic status colors", () => {
  const t = p.paletteTokens({ ...p.DEFAULT_PALETTE, accent: "#010101", secondary: "#121212" });
  assert.ok(p.contrast(t["--ec-accent"], t["--ec-surface-4"]) >= 3);
  assert.ok(p.contrast(t["--ec-accent"], t["--ec-on-accent"]) >= 4.5);
  assert.ok(!Object.keys(t).some(key => /danger|presence|status-|ec-ok|ec-warn/.test(key)));
});
test("invalid CSS never produces tokens", () => {
  assert.equal(Object.keys(p.paletteTokens({ ...p.DEFAULT_PALETTE, accent: "url(https://example.test)" })).length, 0);
});
test("cache and reset are isolated by account", () => {
  const e = environment(), lib = load(source, e);
  lib.writePaletteCache("alice", p.DEFAULT_PALETTE);
  lib.writePaletteCache("bob", p.PALETTE_PRESETS[2].colors);
  assert.equal(lib.readPaletteCache("alice").accent, p.DEFAULT_PALETTE.accent);
  assert.equal(lib.readPaletteCache("bob").accent, p.PALETTE_PRESETS[2].colors.accent);
  lib.writePaletteCache("alice", null);
  assert.equal(lib.readPaletteCache("alice"), null);
  assert.ok(lib.readPaletteCache("bob"));
});
test("blocked/corrupt storage never breaks the interface", () => {
  const lib = load(source, { localStorage: { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); }, removeItem() { throw Error("denied"); } } });
  assert.equal(lib.readPaletteCache("alice"), null);
  assert.doesNotThrow(() => lib.writePaletteCache("alice", p.DEFAULT_PALETTE));
  const e = environment(new Map([[p.paletteCacheKey("alice"), "not-json"]]));
  assert.equal(load(source, e).readPaletteCache("alice"), null);
});
test("switching back to defaults removes all custom tokens without touching other styles", () => {
  const e = environment(), lib = load(source, e);
  e.styles.set("--unrelated", "keep");
  lib.applyPalette(p.DEFAULT_PALETTE);
  assert.equal(e.dataset.ecPalette, "custom");
  lib.applyPalette(null);
  assert.equal(e.dataset.ecPalette, undefined);
  assert.equal(e.styles.size, 1);
  assert.equal(e.styles.get("--unrelated"), "keep");
});
test("legacy solar preference and denied storage still boot dark", () => {
  for (const denied of [false, true]) {
    const attributes = {};
    runInNewContext(read("apps/web/public/boot-preferences.js"), {
      document: { documentElement: { setAttribute: (k, v) => { attributes[k] = v; } } },
      localStorage: { getItem() { if (denied) throw Error("denied"); return "solar"; } },
    });
    assert.equal(attributes["data-ec-theme"], "obsidian");
  }
  assert.doesNotMatch(read("apps/web/src/components/ThemeToggle.tsx"), /role="switch"|solar|localStorage/);
  assert.doesNotMatch(read("apps/web/src/pages/AppShell.tsx"), /ThemeToggle/);
  assert.match(read("apps/web/src/styles/app.css"), /@import "\.\/personal-palette\.css"/);
});

// Deterministic hook lifecycle: run the real callbacks with a deferred transport.
function hookHarness(user = "alice", shared = environment()) {
  let cursor = 0, dirty = true, value;
  const cells = [], effects = [], requests = [], events = new Map();
  const equal = (a, b) => a?.length === b?.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = typeof initial === "function" ? initial() : initial;
      return [cells[i], next => { const v = typeof next === "function" ? next(cells[i]) : next; if (!Object.is(v, cells[i])) { cells[i] = v; dirty = true; } }];
    },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!cells[i] || !equal(cells[i].deps, deps)) cells[i] = { deps, fn }; return cells[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!cells[i] || !equal(cells[i].deps, deps)) { const previous = cells[i]; cells[i] = { deps }; effects.push(() => { previous?.cleanup?.(); cells[i].cleanup = fn(); }); } },
  };
  react.useLayoutEffect = react.useEffect;
  const lib = load(source, shared);
  const module = load(read("apps/web/src/hooks/useAppearance.ts"), {
    ...shared, AbortController,
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) },
    require(name) {
      if (name === "react") return react;
      if (name.endsWith("/appearance")) return lib;
      if (name.endsWith("/api")) return { apiJson: (path, options) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })) };
      throw Error(name);
    },
  });
  const flush = () => { for (let tries = 0; dirty && tries < 20; tries++) { dirty = false; cursor = 0; value = module.useAppearance(user); while (effects.length) effects.shift()(); } return value; };
  flush();
  return { shared, requests, events, flush, get value() { return value; }, unmount() { cells.forEach(cell => cell?.cleanup?.()); }, async settle() { await new Promise(setImmediate); flush(); } };
}
test("loading, preview/cancel, save and reload run through the actual hook", async () => {
  const h = hookHarness();
  h.requests[0].resolve({ palette: null }); await h.settle();
  assert.equal(h.value.loaded, true);
  h.value.previewPalette(p.PALETTE_PRESETS[2].colors); h.flush();
  assert.equal(h.shared.styles.get("--ec-bg"), p.PALETTE_PRESETS[2].colors.background);
  h.value.cancelPreview(); h.flush(); assert.equal(h.shared.dataset.ecPalette, undefined);
  const save = h.value.save(p.PALETTE_PRESETS[2].colors);
  h.requests[1].resolve({ palette: p.PALETTE_PRESETS[2].colors }); await save; await h.settle();
  assert.equal(h.value.saved.accent, p.PALETTE_PRESETS[2].colors.accent);
  h.unmount(); assert.equal(h.shared.dataset.ecPalette, undefined);
  const next = hookHarness("alice", h.shared);
  assert.equal(next.value.saved.accent, p.PALETTE_PRESETS[2].colors.accent);
  next.unmount();
});
test("load/save failure preserves saved data and allows retry", async () => {
  const h = hookHarness(); h.requests[0].reject(Error("offline")); await h.settle();
  assert.equal(h.value.loaded, false); assert.ok(h.value.error);
  const retry = h.value.reload(); h.requests[1].resolve({ palette: p.DEFAULT_PALETTE }); await retry; await h.settle();
  h.value.previewPalette(p.PALETTE_PRESETS[2].colors); h.flush();
  const save = h.value.save(p.PALETTE_PRESETS[2].colors); h.requests[2].reject(Error("offline"));
  assert.equal(await save, false); await h.settle();
  assert.equal(h.value.saved.accent, p.DEFAULT_PALETTE.accent); assert.ok(h.value.error);
  h.unmount();
});
test("an old account response cannot recolor a newly mounted account", async () => {
  const shared = environment(); const first = hookHarness("alice", shared);
  first.unmount(); const second = hookHarness("bob", shared);
  second.requests[0].resolve({ palette: p.PALETTE_PRESETS[2].colors }); await second.settle();
  first.requests[0].resolve({ palette: p.DEFAULT_PALETTE }); await first.settle();
  assert.equal(first.requests[0].options.signal.aborted, true);
  assert.equal(shared.styles.get("--ec-bg"), p.PALETTE_PRESETS[2].colors.background);
  second.unmount();
});
test("focus refresh cannot overwrite an active preview", async () => {
  const h = hookHarness(); h.requests[0].resolve({ palette: null }); await h.settle();
  h.value.previewPalette(p.DEFAULT_PALETTE); h.flush();
  h.events.get("focus")(); assert.equal(h.requests.length, 1);
  h.unmount();
});
