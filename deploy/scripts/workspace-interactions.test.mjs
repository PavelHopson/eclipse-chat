import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
function load(path, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, ...globals });
  return exports;
}
const timing = load("apps/web/src/lib/musicTiming.ts");
const feedback = load("apps/web/src/lib/voiceFeedback.ts").voiceFeedback;
const live = { channelId: "room", connection: "connected", micMuted: false, deafened: false, camera: false, screen: false, pushToTalk: false, error: null };
const cues = (before, after) => Array.from(feedback(before, after));

test("server clock avoids listener wall-clock drift", () => {
  assert.equal(timing.sessionPositionMs({ isPlaying: true, positionMs: 10000, startedAt: "2026-08-28T12:00:00Z", serverNow: "2026-08-28T12:00:20Z" }, Date.parse("2026-08-28T12:04:00Z")), 30000);
  assert.equal(timing.sessionPositionMs({ isPlaying: false, positionMs: 2000, startedAt: "bad" }), 2000);
  assert.equal(timing.sessionPositionMs({ isPlaying: true, positionMs: NaN, startedAt: "bad" }), 0);
});
test("elapsed cannot exceed known track duration", () => {
  assert.equal(timing.mediaClock(364000, 166000), "2:46");
  assert.equal(timing.boundedMediaPosition(-10, 5000), 0);
  assert.equal(timing.mediaClock(NaN, 5000), "0:00");
  assert.equal(timing.mediaClock(12000, null), "0:12");
});
test("mic cues follow confirmed state; unchanged state and PTT stay silent", () => {
  assert.deepEqual(cues(live, live), []);
  assert.deepEqual(cues(live, { ...live, micMuted: true }), ["micOff"]);
  assert.deepEqual(cues({ ...live, micMuted: true }, live), ["micOn"]);
  assert.deepEqual(cues(live, { ...live, pushToTalk: true, micMuted: true }), []);
});
test("deafen does not emit duplicate microphone feedback", () => {
  assert.deepEqual(cues(live, { ...live, deafened: true, micMuted: true }), ["audioOff"]);
  assert.deepEqual(cues({ ...live, deafened: true, micMuted: true }, live), ["audioOn"]);
});
test("connection, visual tracks and failures have distinct feedback", () => {
  assert.deepEqual(cues(live, { ...live, camera: true }), ["cameraOn"]);
  assert.deepEqual(cues(live, { ...live, screen: true }), ["screenOn"]);
  assert.deepEqual(cues(live, { ...live, connection: "reconnecting" }), ["callRecover"]);
  assert.deepEqual(cues({ ...live, connection: "reconnecting" }, live), ["callReady"]);
  assert.deepEqual(cues(live, { ...live, connection: "disconnected", channelId: null }), ["callEnd"]);
  const failed = { ...live, error: "Denied" };
  assert.deepEqual(cues(live, failed), ["actionError"]);
  assert.deepEqual(cues(failed, failed), []);
});
test("old preferences keep master mute and gain independent action volume", () => {
  const sounds = load("apps/web/src/lib/notificationSounds.ts", { localStorage: { getItem: () => JSON.stringify({ enabled: false, volume: .7 }) } });
  const prefs = sounds.readNotificationSoundSettings();
  assert.equal(prefs.enabled, false);
  assert.equal(prefs.volume, .7);
  assert.equal(prefs.actions, true);
  assert.equal(prefs.actionsVolume, .25);
  assert.equal(sounds.playNotificationSound("micOn"), false);
});
test("action mute and volume bounds are enforced", () => {
  const sounds = load("apps/web/src/lib/notificationSounds.ts", { localStorage: { getItem: () => JSON.stringify({ enabled: true, actions: false, volume: -1, actionsVolume: 5 }) } });
  const prefs = sounds.readNotificationSoundSettings();
  assert.equal(prefs.volume, 0);
  assert.equal(prefs.actionsVolume, 1);
  assert.equal(sounds.playNotificationSound("screenOn"), false);
});
test("overlay geometry flips above near bottom and clamps horizontal edges", () => {
  const source = read("apps/web/src/components/AnchoredOverlay.tsx");
  const ast = ts.createSourceFile("overlay.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "overlayPosition");
  const exports = {};
  runInNewContext(ts.transpileModule(fn.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  const viewport = { left: 0, top: 0, width: 390, height: 844 };
  const value = exports.overlayPosition({ left: 360, right: 385, top: 800, bottom: 830 }, 320, 200, viewport);
  assert.equal(value.left, 58); assert.equal(value.top, 592);
  assert.equal(exports.overlayPosition({ left: 0, right: 24, top: 20, bottom: 40 }, 320, 200, viewport).left, 12);
});
test("feedback never publishes audio and reduced-motion stops decorative work", () => {
  const sound = read("apps/web/src/lib/notificationSounds.ts");
  assert.doesNotMatch(sound, /fetch\(|getUserMedia|MediaStreamDestination|new WebSocket/);
  assert.match(sound, /performance.now\(\) - requestedAt > 800/);
  const motion = read("apps/web/src/hooks/useInteractionMotion.ts");
  assert.match(motion, /!document.hidden/);
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(motion, /readInteractionPreferences\(\).motion/);
});

test("dialogs escape pane stacking and pending camera does not disable the microphone", () => {
  const modal = read("apps/web/src/components/Modal.tsx");
  assert.match(modal, /return createPortal/);
  assert.match(modal, /document.querySelector\("\.ec-shell\.ec-workspace-v2"\)/);
  const room = read("apps/web/src/components/VoiceRoom.tsx");
  assert.match(room, /pendingRef = useRef\(new Set<string>\(\)\)/);
  assert.match(room, /controlPending.includes\("camera"\)/);
  assert.doesNotMatch(room, /controlPending !== null/);
  assert.match(room, /borderWidth: 1/);
});
test("interaction opt-out survives unavailable storage for the current session", () => {
  const prefs = load("apps/web/src/lib/interactionPreferences.ts", {
    localStorage: { getItem: () => { throw new Error("disabled"); }, setItem: () => { throw new Error("disabled"); } },
    window: { dispatchEvent() {} }, CustomEvent: class {},
  });
  prefs.writeInteractionPreferences({ pointer: false, motion: false });
  assert.equal(prefs.readInteractionPreferences().motion, false);
  assert.equal(prefs.readInteractionPreferences().pointer, false);
});
