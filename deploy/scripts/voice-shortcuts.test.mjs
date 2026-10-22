import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VOICE_SHORTCUTS,
  eventToVoiceShortcut,
  formatVoiceShortcut,
  normalizeShortcut,
  resetVoiceShortcuts,
  setVoiceShortcut,
} from "../../apps/web/src/lib/voiceShortcuts.ts";

test("voice shortcuts normalize and format consistently", () => {
  assert.equal(normalizeShortcut("Ctrl+Shift+KeyM"), "Ctrl+Shift+KeyM");
  assert.equal(formatVoiceShortcut("Ctrl+Shift+KeyM"), "Ctrl + Shift + M");
  assert.equal(formatVoiceShortcut(null), "Не назначено");
});

test("voice shortcut capture uses KeyboardEvent code and modifiers", () => {
  const event = {
    code: "KeyD",
    ctrlKey: true,
    altKey: false,
    shiftKey: true,
    metaKey: false,
  };
  assert.equal(eventToVoiceShortcut(event), "Ctrl+Shift+KeyD");
  assert.equal(eventToVoiceShortcut({ ...event, code: "ShiftLeft" }), null);
});

test("voice shortcut assignments reject conflicts and can be reset", () => {
  resetVoiceShortcuts();
  const conflict = setVoiceShortcut("toggle-deafen", DEFAULT_VOICE_SHORTCUTS["toggle-mic"]);
  assert.deepEqual(conflict, { ok: false, reason: "Сочетание уже назначено: «Микрофон»." });

  assert.deepEqual(setVoiceShortcut("leave", null), { ok: true });
  resetVoiceShortcuts();
  assert.deepEqual(setVoiceShortcut("leave", DEFAULT_VOICE_SHORTCUTS.leave), { ok: true });
});
