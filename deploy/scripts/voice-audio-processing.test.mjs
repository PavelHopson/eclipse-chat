import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
function functions(path, names, globals = {}) {
  const source = read(path);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  const exports = {};
  runInNewContext(ts.transpileModule(declarations.map(node => node.getText(ast)).join("\n") +
    names.map(name => `\nexports.${name} = ${name};`).join(""), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, ...globals });
  return exports;
}

test("screen playback mounts and applies user mute before SDK attach; failed attach cleans up", async () => {
  const events = [];
  const element = { style: {}, muted: false, srcObject: {},
    setAttribute() {}, pause() { events.push("pause"); }, remove() { events.push("remove"); },
  };
  const document = { createElement: () => element, body: { appendChild: () => events.push("mount") } };
  const { attachRemoteAudioElement, requestRemoteAudioPlayback } = functions("apps/web/src/hooks/useVoice.ts",
    ["attachRemoteAudioElement", "requestRemoteAudioPlayback"]);
  const configure = el => { el.muted = true; el.volume = 0.4; events.push("configure"); };
  const el = attachRemoteAudioElement({ attach(el) {
    events.push("attach"); assert.equal(el.muted, true); assert.equal(el.volume, 0.4);
  } }, configure, document);
  assert.deepEqual(events, ["configure", "mount", "attach", "configure"]);
  assert.equal(el.autoplay, true);
  assert.equal(await requestRemoteAudioPlayback({ play: async () => {} }), true);
  assert.equal(await requestRemoteAudioPlayback({ play: async () => { throw new Error("blocked"); } }), false);
  assert.throws(() => attachRemoteAudioElement({ attach() { throw new Error("SDK"); } }, configure, document));
  assert.equal(element.srcObject, null);
  assert.deepEqual(events.slice(-2), ["pause", "remove"]);
});

test("autoplay recovery restores deafen synchronously before awaiting the SDK", async () => {
  const path = "apps/web/src/hooks/useVoice.ts";
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
  const hook = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useVoice");
  const variable = hook.body.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .find(node => node.name.getText(ast) === "resumeAudioPlayback");
  const callback = variable.initializer.arguments[0];
  const audioEl = { muted: true }; let resolve;
  const pending = new Promise(done => { resolve = done; });
  const room = { canPlaybackAudio: true, startAudio() { audioEl.muted = false; return pending; } };
  const exports = {};
  runInNewContext(ts.transpileModule(`exports.resume = ${callback.getText(ast)}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, roomRef: { current: room }, remoteTracksRef: { current: new Map([["screen", { audioEl }]]) },
    deafenedRef: { current: true }, applyRemoteAudioState: (entry, deafened) => { entry.audioEl.muted = deafened; },
    setIsAudioPlaybackBlocked() {}, setError() {}, AUDIO_PLAYBACK_ERROR: "blocked",
  });
  const playback = exports.resume();
  assert.equal(audioEl.muted, true, "recovery cannot leak audio while the SDK promise is pending");
  resolve(); await playback; assert.equal(audioEl.muted, true);
});

function processorFactory({ fail = false } = {}) {
  let Processor;
  let destroyed = 0;
  const messages = [];
  const frames = [];
  class AudioWorkletProcessor {
    port = { postMessage: data => messages.push(data), close() {}, onmessage: null };
  }
  const model = { frameSize: 480, createDenoiseState: () => ({
    processFrame(frame) { frames.push(Float32Array.from(frame)); if (fail) throw new Error("DSP"); },
    destroy() { destroyed++; },
  }) };
  runInNewContext(read("apps/web/src/lib/rnnoise.worklet.js").replace(/^import[^\n]*\n/, ""), {
    Rnnoise: { load: async () => model }, sampleRate: 48000, AudioWorkletProcessor,
    registerProcessor: (_, value) => { Processor = value; }, Float32Array,
  });
  return { create: () => new Processor(), messages, frames, destroyed: () => destroyed };
}

test("RNNoise buffers 128→480 samples losslessly, scales PCM16, and discards mute tails", async () => {
  const factory = processorFactory();
  const processor = factory.create();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(factory.messages, ["ready"]);
  processor.port.onmessage({ data: { enabled: true } });
  const received = [];
  for (let block = 0; block < 20; block++) {
    const input = Float32Array.from({ length: 128 }, (_, i) => (block * 128 + i + 1) / 32768);
    const output = new Float32Array(128);
    processor.process([[input]], [[output]]);
    received.push(...output);
  }
  assert.deepEqual([...factory.frames[0]], Array.from({ length: 480 }, (_, i) => i + 1));
  assert.ok(received.slice(0, 479).every(value => value === 0));
  assert.deepEqual(received.slice(479), Array.from({ length: 20 * 128 - 479 }, (_, i) => (i + 1) / 32768));
  processor.port.onmessage({ data: { enabled: false } });
  assert.equal(factory.destroyed(), 1);
  processor.port.onmessage({ data: { enabled: false } });
  assert.equal(factory.destroyed(), 1, "repeated mute must not recreate model state");
  processor.port.onmessage({ data: { enabled: true } });
  const output = new Float32Array(128).fill(1);
  processor.process([[new Float32Array(128)]], [[output]]);
  assert.ok(output.every(value => value === 0), "no old speech after mute/PTT resumes");
  processor.port.onmessage({ data: "destroy" });
  assert.equal(processor.process([], [[output]]), false);
});

test("processor failure is silent and reported; audio samples never leave worklet", async () => {
  const factory = processorFactory({ fail: true });
  const processor = factory.create();
  await new Promise(resolve => setImmediate(resolve));
  processor.port.onmessage({ data: { enabled: true } });
  for (let i = 0; i < 4; i++) {
    const output = new Float32Array(128);
    processor.process([[new Float32Array(128).fill(0.2)]], [[output]]);
    assert.ok(output.every(value => value === 0));
  }
  assert.deepEqual(factory.messages, ["ready", "failed"]);
  assert.equal(processor.enabled, false);
});

test("aggressive capture disables automatic noise boost and preserves off/standard", () => {
  const { noiseModeToConstraints } = functions("apps/web/src/hooks/useVoiceSettings.ts", ["noiseModeToConstraints"]);
  assert.equal(noiseModeToConstraints("aggressive").autoGainControl, false);
  assert.equal(noiseModeToConstraints("aggressive").sampleRate.ideal, 48000);
  assert.equal(noiseModeToConstraints("standard").autoGainControl, true);
  assert.equal(noiseModeToConstraints("off").noiseSuppression, false);
  assert.doesNotMatch(read("apps/web/src/lib/audioEnhancer.ts"), /createDynamicsCompressor\(/);
});

function enhancerFixture({ unavailable = false } = {}) {
  const input = { enabled: false, stop() { this.ended = true; } };
  const output = { enabled: true, stop() { this.ended = true; } };
  const messages = [];
  const denoise = { connect() {}, disconnect() {}, port: { postMessage: value => messages.push(value), close() {} } };
  let failures = 0, closed = 0;
  class AudioContext {
    state = "running";
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
    createBiquadFilter() { return { frequency: {}, Q: {}, connect() {} }; }
    createMediaStreamDestination() { return { stream: { getAudioTracks: () => [output] } }; }
    async resume() {}
    async close() { closed++; }
  }
  const { createAudioEnhancer } = functions("apps/web/src/lib/audioEnhancer.ts", ["resolveAudioContextCtor", "createAudioEnhancer"], {
    window: { AudioContext }, MediaStream: class {},
    createMicrophoneDenoise: async () => { if (unavailable) throw new Error("unavailable"); return denoise; },
  });
  return { input, output, denoise, messages, failures: () => failures, closed: () => closed,
    create: () => createAudioEnhancer(input, { micGain: 1, onFailure: () => { failures++; } }) };
}

test("neural runtime failure closes both gates permanently; cleanup is idempotent", async () => {
  const f = enhancerFixture(); const enhancer = await f.create();
  assert.equal(enhancer.processing, "rnnoise"); assert.equal(f.output.enabled, false);
  enhancer.setInputEnabled(true); enhancer.setOutputEnabled(true);
  f.denoise.onprocessorerror(); f.denoise.onprocessorerror();
  assert.equal(f.failures(), 1); assert.equal(f.input.enabled, false); assert.equal(f.output.enabled, false);
  enhancer.setInputEnabled(true); enhancer.setOutputEnabled(true);
  assert.equal(f.input.enabled, false); assert.equal(f.output.enabled, false);
  enhancer.destroy(); enhancer.destroy();
  assert.equal(f.closed(), 1); assert.equal(f.input.ended, true); assert.equal(f.output.ended, true);
});

test("unavailable neural processor reports browser fallback without opening capture", async () => {
  const f = enhancerFixture({ unavailable: true }); const enhancer = await f.create();
  assert.equal(enhancer.processing, "browser"); assert.equal(f.input.enabled, false); assert.equal(f.output.enabled, false);
  enhancer.destroy(); assert.equal(f.closed(), 1);
});

test("vendored RNNoise matches pinned release with only documented worklet compatibility edit", () => {
  const vendor = read("apps/web/src/vendor/rnnoise/rnnoise.js");
  const original = vendor.replace("    // Eclipse compatibility: AudioWorklet has WebAssembly but no Window/WorkerGlobalScope.\n", "")
    .replace(' || typeof AudioWorkletProcessor === "function"', "");
  assert.equal(createHash("sha256").update(original).digest("hex"), "e6958293a0118bf9860cb2753332f7562531cc987c914552c426cd7d7180a63e");
  assert.doesNotMatch(vendor, /\bfetch\(|\bXMLHttpRequest\b|\beval\(|new Function\(/);
  const sbom = JSON.parse(read("apps/web/src/vendor/rnnoise/sbom.cdx.json"));
  assert.equal(sbom.components[0].hashes[0].content, createHash("sha256").update(vendor).digest("hex"));
  assert.match(read(".github/workflows/security.yml"), /apps\/web\/src\/vendor\/rnnoise\/sbom\.cdx\.json/);
});
