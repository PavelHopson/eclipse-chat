import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
function load(path) {
  const exports = {};
  runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  return exports;
}
const media = load("apps/web/src/lib/mediaPresentation.ts");
const voice = load("apps/web/src/lib/voicePresentation.ts");

test("media clocks and seeks remain finite and bounded", () => {
  assert.equal(media.mediaTime(NaN), "0:00");
  assert.equal(media.mediaTime(-50), "0:00");
  assert.equal(media.mediaTime(3661000), "1:01:01");
  assert.equal(media.boundedSeek(9000, 5000), 5000);
  assert.equal(media.boundedSeek(-10, 5000), 0);
  assert.equal(media.boundedSeek(Infinity, 5000), 0);
});
test("compact audio leaves more chat space but preserves a usable stage", () => {
  assert.equal(voice.voiceChatWidth(900, 1200, true), 820);
  assert.equal(voice.voiceChatWidth(900, 1200, false), 620);
  assert.ok(media.preferredAudioChatWidth(1200, true) > media.preferredAudioChatWidth(1200, false));
  assert.ok(voice.voiceChatWidth(820, 800, true) <= 540);
});
test("actual microphone reconfiguration effect never enables a muted or deafened mic", () => {
  const source = read("apps/web/src/hooks/useVoice.ts");
  const ast = ts.createSourceFile("voice.ts", source, ts.ScriptTarget.Latest, true);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" &&
        node.arguments[0]?.getText(ast).includes("const needsRefresh")) callback = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback, "tests the real hook callback, not a duplicate model");
  for (const input of [
    { muted: true, deafened: false, mode: "open", expected: 0 },
    { muted: false, deafened: true, mode: "open", expected: 0 },
    { muted: false, deafened: false, mode: "push_to_talk", expected: 0 },
    { muted: false, deafened: false, mode: "open", expected: 1 },
  ]) {
    const calls = [];
    const exports = {};
    const settings = { inputDeviceId: "new", noiseSuppression: "standard", micGain: 1, micActivationMode: input.mode };
    const code = ts.transpileModule("exports.effect = " + callback.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(code, { exports, settings, state: "connected", roomRef: { current: {} },
      micCaptureAllowedRef: { current: true }, publishedMicConfigRef: { current: { inputDeviceId: "old", enhancerMode: "none" } },
      isMicMuted: input.muted, isDeafened: input.deafened,
      applyLocalMicrophoneSettings: (...args) => { calls.push(args); return Promise.resolve(); },
      setError() {}, console,
    });
    exports.effect();
    assert.equal(calls.length, input.expected, JSON.stringify(input));
  }
});
test("quick device menus enumerate without requesting microphone capture", () => {
  const source = read("apps/web/src/components/VoiceDeviceControl.tsx");
  assert.doesNotMatch(source, /getUserMedia|requestPermission/);
  assert.match(source, /focusTarget=\{trigger\}/);
  const overlay = read("apps/web/src/components/AnchoredOverlay.tsx");
  assert.match(overlay, /requestAnimationFrame/);
  assert.match(overlay, /event.key === "Escape"/);
});
test("players expose keyboard and state controls instead of decorative activity", () => {
  const video = read("apps/web/src/components/VideoPlayer.tsx");
  const audio = read("apps/web/src/components/AudioPlayer.tsx");
  const viewport = read("apps/web/src/components/MediaViewport.tsx");
  assert.match(video, /onWaiting/);
  assert.match(video, /onError/);
  assert.match(audio, /onError/);
  assert.match(viewport, /aria-pressed/);
  assert.match(viewport, /onPointerCancel/);
  assert.match(read("apps/web/src/components/MediaScrubber.tsx"), /Home/);
});
test("motion can be disabled and player layout has one component owner", () => {
  const css = read("apps/web/src/styles/media-workbench.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-ec-motion="quiet"/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(read("apps/web/src/styles/workspace-interactions.css"), /ec-player-dialog \.ec-modal-body/);
});
test("development source modules cannot be served from a production service-worker cache", () => {
  assert.match(read("apps/web/src/main.tsx"), /import.meta.env.PROD && "serviceWorker" in navigator/);
  const sw = read("apps/web/public/sw.js");
  assert.match(sw, /localDevelopment/);
  assert.ok(sw.indexOf("if (localDevelopment") < sw.indexOf("event.respondWith(staleWhileRevalidate"));
});
test("service-worker activation preserves caches owned by other products", async () => {
  const handlers = {};
  const deleted = [];
  const current = read("apps/web/public/sw.js").match(/const SW_VERSION = "([^"]+)"/)[1];
  runInNewContext(read("apps/web/public/sw.js"), {
    self: { addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim: async () => {} } },
    caches: { keys: async () => ["star-crm-static", "user-content", "eclipse-v1.0-assets", current + "-assets"],
      delete: async name => { deleted.push(name); } },
  });
  let completion;
  handlers.activate({ waitUntil: promise => { completion = promise; } });
  await completion;
  assert.deepEqual(deleted, ["eclipse-v1.0-assets"]);
});
test("compact participants are not forced into legacy oversized tiles", () => {
  assert.match(read("apps/web/src/styles/voice-room.css"), /:not\(\[data-audio-density="compact"\]\)/);
  assert.match(read("apps/web/src/styles/components.css"), /justify-content: safe center !important/);
  assert.match(read("apps/web/src/styles/media-workbench.css"), /aspect-ratio: var\(--ec-media-ratio/);
});
