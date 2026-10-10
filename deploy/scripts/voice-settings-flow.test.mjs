import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const source = read("apps/web/src/components/VoiceSettingsContent.tsx");
const ast = ts.createSourceFile("settings.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "VoiceSettingsContent");
// Run the real component's handlers/effects, not a second implementation. UI is checked in Chromium.
const statements = component.body.statements.filter(n => !ts.isReturnStatement(n)).map(n => n.getText(ast)).join("\n");
const js = ts.transpileModule(`exports.mount = () => { ${statements}
  return { startTest, stopTestResources, playOutputTest, stopOutputResources, pttButtonRef }; };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture(options = {}) {
  const state = {}, effects = [], cleanups = [], listeners = new Map(), timers = new Map();
  const contexts = [], audios = [], tracks = [];
  let captures = 0, enhances = 0, destroyed = 0, selectedKey = "Space", focused = 0;
  const track = () => { const events = new Map(); const t = { enabled: true, readyState: "live",
    addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key),
    end() { this.readyState = "ended"; events.get("ended")?.(); },
    stop() { this.readyState = "ended"; } }; tracks.push(t); return t; };
  class Stream { constructor(items = [track()]) { this.items = items; } getTracks() { return this.items; } getAudioTracks() { return this.items; } }
  const input = new Stream();
  class Context {
    currentTime = 0; closed = 0;
    constructor() { contexts.push(this); }
    close() { this.closed++; return Promise.resolve(); }
    resume() { return Promise.resolve(); }
    createOscillator() { return { frequency: {}, connect: node => node, start() {}, stop() {}, disconnect() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createMediaStreamDestination() { return { stream: new Stream() }; }
    createMediaStreamSource() { return { connect() {} }; }
    createAnalyser() { return { frequencyBinCount: 128, getByteTimeDomainData: buf => buf.fill(128) }; }
  }
  class Audio {
    plays = 0; pauses = 0; srcObject = null;
    constructor() { audios.push(this); }
    setSinkId() { return options.sink?.promise ?? Promise.resolve(); }
    play() { this.plays++; return options.play?.() ?? Promise.resolve(); }
    pause() { this.pauses++; }
  }
  const settings = { noiseSuppression: "aggressive", inputDeviceId: null, outputDeviceId: options.sink ? "speaker" : null,
    micGain: 1, masterOutputVolume: 1, micActivationMode: "push_to_talk", pttKey: "Space", vadThreshold: .05 };
  let slot = 0;
  const names = ["testLevel", "testing", "outputTesting", "recordingPtt", "permError", "outputError", "processing"];
  const document = { hidden: false, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const exports = {};
  runInNewContext(js, {
    exports, Error, MediaStream: Stream, Audio, document,
    navigator: { mediaDevices: { getUserMedia: () => { captures++; return options.permission?.promise ?? Promise.resolve(input); } } },
    window: { AudioContext: Context, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key),
      setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    useState: initial => { const name = names[slot++]; state[name] = name === "recordingPtt" ? !!options.recording : initial;
      return [state[name], value => { state[name] = value; }]; },
    useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => effects.push(fn),
    useConfirm: () => async () => false, useAudioDevices: () => ({ refresh: async () => {} }),
    useVoiceSettings: () => ({ settings, setPttKey: value => { selectedKey = value; } }),
    noiseModeToConstraints: () => ({ noiseSuppression: true }),
    createAudioEnhancer: async () => { enhances++; if (options.enhancer) return options.enhancer.promise; return enhancer; },
  });
  const enhancer = { outputTrack: track(), processing: "rnnoise", setInputEnabled() {}, setOutputEnabled() {}, destroy() { destroyed++; } };
  const api = exports.mount(); api.pttButtonRef.current = { focus: () => { focused++; } };
  for (const effect of effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  return { ...api, state, input, enhancer, contexts, audios, tracks, listeners, timers, document,
    captures: () => captures, enhances: () => enhances, destroyed: () => destroyed, selectedKey: () => selectedKey, focused: () => focused,
    unmount: () => cleanups.forEach(fn => fn()) };
}

test("profile and call mount the same settings implementation without nested dialogs or transport", () => {
  assert.match(read("apps/web/src/components/settings/SettingsPanel.tsx"), /active === "voice-video"\) return <VoiceSettingsContent/);
  assert.match(read("apps/web/src/components/VoiceSettingsModal.tsx"), /<VoiceSettingsContent/);
  assert.doesNotMatch(source, /<Modal|MediaRecorder|apiJson|fetch\(|WebSocket|console\./);
  assert.doesNotMatch(read("apps/web/src/components/settings/SettingsTreeNav.tsx"), /id: "voice-video"[^\n]*soon/);
  const f = fixture(); assert.equal(f.captures(), 0); assert.equal(f.contexts.length, 0); f.unmount();
});
test("mic test uses DSP, then unmount releases input and processing", async () => {
  const f = fixture(); await f.startTest();
  assert.equal(f.captures(), 1); assert.equal(f.state.processing, "rnnoise");
  f.unmount(); assert.equal(f.input.getTracks()[0].readyState, "ended"); assert.equal(f.destroyed(), 1);
  assert.ok(f.contexts.every(ctx => ctx.closed === 1));
});
test("permission resolving after stop never starts processing or leaks a track", async () => {
  const permission = deferred(), f = fixture({ permission }); const pending = f.startTest();
  f.stopTestResources(); permission.resolve(f.input); await pending;
  assert.equal(f.enhances(), 0); assert.equal(f.input.getTracks()[0].readyState, "ended");
});
test("unplugging the microphone ends the test and releases the DSP/context", async () => {
  const f = fixture(); await f.startTest(); f.input.getTracks()[0].end();
  assert.equal(f.state.testing, false); assert.equal(f.state.processing, null);
  assert.match(f.state.permError, /Микрофон отключён/); assert.equal(f.destroyed(), 1);
  assert.ok(f.contexts.every(ctx => ctx.closed === 1)); f.unmount();
});
test("DSP resolving after close is destroyed instead of being activated", async () => {
  const enhancer = deferred(), f = fixture({ enhancer }); const pending = f.startTest();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.enhances(), 1);
  f.unmount(); enhancer.resolve(f.enhancer); await pending;
  assert.equal(f.destroyed(), 1); assert.equal(f.state.processing, null);
});
test("speaker play rejection closes its context/track and sanitizes the error", async () => {
  const f = fixture({ play: () => Promise.reject(new Error("SYNTHETIC-SECRET")) });
  await f.playOutputTest();
  assert.ok(f.contexts.every(ctx => ctx.closed === 1)); assert.equal(f.audios[0].srcObject, null);
  assert.equal(f.tracks.at(-1).readyState, "ended"); assert.equal(f.state.outputTesting, false);
  assert.doesNotMatch(f.state.outputError, /SYNTHETIC-SECRET/);
});
test("speaker sink resolving after close cannot start playback", async () => {
  const sink = deferred(), f = fixture({ sink }); const pending = f.playOutputTest();
  f.unmount(); sink.resolve(); await pending;
  assert.equal(f.audios[0].plays, 0); assert.equal(f.contexts[0].closed, 1); assert.equal(f.timers.size, 0);
});
test("late speaker play resolution is paused and never creates a cleanup timer", async () => {
  const play = deferred(), f = fixture({ play: () => play.promise }); const pending = f.playOutputTest();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.audios[0].plays, 1);
  f.unmount(); play.resolve(); await pending;
  assert.equal(f.audios[0].srcObject, null); assert.ok(f.audios[0].pauses > 0); assert.equal(f.timers.size, 0);
});
test("speaker cleanup clears timer and is idempotent", async () => {
  const f = fixture(); await f.playOutputTest(); assert.equal(f.timers.size, 1);
  f.stopOutputResources(); f.stopOutputResources();
  assert.equal(f.timers.size, 0); assert.equal(f.contexts[0].closed, 1); assert.equal(f.audios[0].srcObject, null);
});
for (const code of ["Escape", "Tab", "KeyT", "ControlLeft"]) test(`PTT capture handles ${code} and removes its listener`, () => {
  const f = fixture({ recording: true }); let prevented = false, stopped = false;
  f.listeners.get("keydown")({ code, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.equal(f.selectedKey(), ["Escape", "Tab"].includes(code) ? "Space" : code);
  assert.equal(prevented, code !== "Tab"); assert.equal(stopped, code !== "Tab");
  assert.equal(f.state.recordingPtt, false); assert.equal(f.focused(), code === "Tab" ? 0 : 1);
  f.unmount(); assert.equal(f.listeners.has("keydown"), false);
});
test("hidden document stops both tests without opening a new capture", async () => {
  const f = fixture(); await f.startTest(); await f.playOutputTest();
  f.document.hidden = true; f.listeners.get("visibilitychange")();
  assert.equal(f.state.testing, false); assert.equal(f.state.outputTesting, false); assert.equal(f.state.processing, null);
  assert.equal(f.captures(), 1); assert.equal(f.timers.size, 0); assert.equal(f.input.getTracks()[0].readyState, "ended");
  f.unmount(); assert.equal(f.listeners.size, 0);
});
