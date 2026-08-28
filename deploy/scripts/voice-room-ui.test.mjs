import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import test from "node:test";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const room = read("apps/web/src/components/VoiceRoom.tsx");
const shell = read("apps/web/src/pages/AppShell.tsx");
const layout = read("apps/web/src/hooks/useVoiceRoomLayout.ts");
const css = read("apps/web/src/styles/voice-room.css");
function loadFunctions(source, names, globals = {}) {
  const ast = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join("\n");
  const code = declarations + "\n" + names.map(name => "exports." + name + "=" + name + ";").join("\n");
  const exports = {};
  runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...globals });
  return exports;
}
const labels = loadFunctions(room, ["resolveConnectionBadge", "formatRoomAudience"]);
const modes = loadFunctions(layout, ["resolveVoiceRoomLayout"]);

test("room labels distinguish joining, recovery, live and push-to-talk", () => {
  assert.equal(labels.resolveConnectionBadge(false, false, false, false), "Готов");
  assert.equal(labels.resolveConnectionBadge(false, false, true, false), "Подключаемся");
  assert.equal(labels.resolveConnectionBadge(false, true, false, false), "Переподключение");
  assert.equal(labels.resolveConnectionBadge(true, false, false, false), "В эфире");
  assert.equal(labels.resolveConnectionBadge(true, false, false, true), "Передача");
});
test("audience counts do not fabricate music-bot listeners", () => {
  for (const [count, word] of [[0, "участников"], [1, "участник"], [2, "участника"], [11, "участников"], [21, "участник"]])
    assert.equal(labels.formatRoomAudience(count), count + " " + word);
  assert.doesNotMatch(room, /musicAudienceCount|music-bot-card|music-bridge/);
});
test("small rooms fall back to stage without overwriting the desktop preference", () => {
  assert.equal(modes.resolveVoiceRoomLayout("split", true, true), "stage");
  assert.equal(modes.resolveVoiceRoomLayout("split", false, true), "split");
  assert.equal(modes.resolveVoiceRoomLayout("chat", true, true), "chat");
  assert.equal(modes.resolveVoiceRoomLayout("chat", false, false), "stage");
  assert.match(layout, /ResizeObserver/);
  assert.match(layout, /observer\.disconnect/);
  assert.equal((layout.match(/localStorage\.setItem\(layoutKey/g) ?? []).length, 1);
  assert.equal((layout.match(/localStorage\.setItem\("ec.voiceRoom.audioCompact."/g) ?? []).length, 1);
  assert.match(layout, /choice\.channelId === channelId/);
});
test("invalid or unavailable storage falls back safely", () => {
  const key = channelId => "ec.voiceRoom.layout." + channelId;
  for (const saved of [null, "bad", "<script>", "split"]) {
    const { readLayout } = loadFunctions(layout, ["readLayout"], { layoutKey: key, localStorage: { getItem: () => saved } });
    assert.equal(readLayout("room"), "split");
  }
  const { readLayout } = loadFunctions(layout, ["readLayout"], { layoutKey: key, localStorage: { getItem: () => { throw new Error("blocked"); } } });
  assert.equal(readLayout("room"), "split");
});
test("participants and media are scoped to the viewed joined room", () => {
  assert.match(room, /v\.state === "connected" && v\.activeChannelId === channelId/);
  assert.match(room, /roomParticipants = isJoinedHere \? v\.participants : \[\]/);
  assert.match(room, /roomVisualTracks = isJoinedHere \? v\.visualTracks : \[\]/);
  assert.match(room, /screenTracks = roomVisualTracks\.filter/);
  assert.match(room, /cameraTracks = roomVisualTracks\.filter/);
});
test("the real music transport moves into voice, never mounts in both headers", () => {
  assert.match(shell, /music\.session && !\(selectedChannel\.type === "VOICE" && voiceHealth\.enabled\)/);
  assert.match(shell, /musicPlayer=\{music\.session \? \(/);
  assert.match(room, /\{musicPlayer \?\? \(/);
  assert.match(room, /onOpenMusicPicker/);
  assert.doesNotMatch(room, /getUserMedia|new WebSocket|dangerouslySetInnerHTML/);
});
test("persistent controls, focus, failures and reduced motion remain explicit", () => {
  assert.ok(room.indexOf('aria-label="Чат голосовой комнаты"') < room.indexOf('aria-label="Управление голосовой комнатой"'));
  assert.match(room, /isJoinedHere \|\| effectiveLayoutMode === "chat"/);
  assert.match(room, /role="alert"/);
  assert.match(room, /event\.key === "Escape"/);
  assert.match(room, /querySelector\("summary"\)\?\.focus/);
  assert.match(room, /onClick=\{\(\) => void v\.leave\(\)\}/);
  assert.match(room, /aria-pressed=\{v\.isCameraEnabled\}/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /minmax\(5[26]0px/);
});

const presentation = loadFunctions(read("apps/web/src/lib/voicePresentation.ts"),
  ["musicTrackTitle", "musicSpeechGain", "speechLevel", "voiceChatWidth"]);
test("track labels are display-only and preserve meaningful punctuation", () => {
  assert.equal(presentation.musicTrackTitle("Artist_____Song.mp3"), "Artist Song");
  assert.equal(presentation.musicTrackTitle("AC-DC — Live (2026).flac"), "AC-DC — Live (2026)");
  assert.equal(presentation.musicTrackTitle("___"), "Без названия");
});
test("music ducking is opt-in, local and never changes stored volume", () => {
  assert.equal(presentation.musicSpeechGain(false, true, true), 1);
  assert.equal(presentation.musicSpeechGain(true, false, true), 1);
  assert.equal(presentation.musicSpeechGain(true, true, false), 1);
  assert.equal(presentation.musicSpeechGain(true, true, true), .24);
  const player = read("apps/web/src/components/MusicMiniPlayer.tsx");
  assert.match(player, /volume \* speechGain/);
  assert.match(player, /cancelAnimationFrame\(frame\)/);
  assert.match(player, /nominalChanged \|\| volume === 0 \|\| document\.hidden/);
  assert.match(player, /document\.removeEventListener\("visibilitychange", onHidden\)/);
  assert.doesNotMatch(player, /setVolume\([^)]*speechGain/);
});
test("layout and speech inputs are bounded", () => {
  assert.equal(presentation.speechLevel(NaN), 0);
  assert.equal(presentation.speechLevel(-2), 0);
  assert.equal(presentation.speechLevel(2), 1);
  assert.equal(presentation.voiceChatWidth(Infinity, 1000), 380);
  assert.equal(presentation.voiceChatWidth(900, 900), 520);
  assert.equal(presentation.voiceChatWidth(10, 1000), 300);
});
test("video pinning is local, channel-scoped and preserves all selectable sources", () => {
  const stage = read("apps/web/src/components/VoiceVisualStage.tsx");
  assert.match(stage, /pinned\?\.channel === channelId/);
  assert.match(stage, /tracks\.find\(track => track\.source === "screen"\)/);
  assert.match(stage, /tracks\.map/);
  assert.match(stage, /setPinned\(null\)/);
  assert.doesNotMatch(stage, /getUserMedia|apiJson|socket\.emit/);
});
test("hidden room chat does not auto-scroll and reports messages and mentions", () => {
  const list = read("apps/web/src/components/MessageList.tsx");
  assert.match(list, /if \(!visibleRef\.current\) return;/);
  assert.match(list, /visibleRef\.current && \(atBottomRef\.current/);
  assert.match(list, /scrollTop = savedScroll\.current/);
  assert.match(list, /reportUnread\?\.\(\{ total: newMessagesCount, mentions: mentions\.length/);
});
test("mic check releases resources, ignores late permission grants and never records or sends audio", () => {
  const check = read("apps/web/src/components/VoiceMicCheck.tsx");
  assert.match(check, /request !== generation\.current/);
  assert.match(check, /stream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
  assert.match(check, /active\.context\.close\(\)/);
  assert.match(check, /10000/);
  assert.match(check, /visibilitychange/);
  assert.doesNotMatch(check, /MediaRecorder|\.destination|apiJson|fetch\(|WebSocket/);
});

test("join muted never calls mic publication; ordinary joining remains unchanged", async () => {
  const source = read("apps/web/src/hooks/useVoice.ts");
  const ast = ts.createSourceFile("useVoice.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hook = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useVoice");
  const declaration = hook.body.statements.filter(ts.isVariableStatement)
    .flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(ast) === "join");
  const callback = declaration.initializer.arguments[0].getText(ast);
  for (const muted of [true, false]) {
    let micCalls = 0;
    const allowed = { current: true };
    const noOp = () => {};
    class FakeRoom { localParticipant = {}; on() { return this; } async connect() {} }
    const exports = {};
    const globals = {
      exports, require: () => ({ Room: FakeRoom, RoomEvent: {}, Track: {}, ConnectionState: { Connected: "connected" } }),
      busy: false, activeChannelId: null, state: "disconnected", roomRef: { current: null },
      micCaptureAllowedRef: allowed, settingsRef: { current: { micActivationMode: "open", outputDeviceId: null } },
      socketRef: { current: null }, isDeafened: false,
      setError: noOp, setBusy: noOp, setIsMicMuted: noOp, setRoom: noOp, setActiveChannelId: noOp,
      leave: async () => {}, apiJson: async () => ({ wsUrl: "wss://example.invalid", token: "fixture-only" }),
      refreshParticipants: noOp, refreshVisualTracks: noOp, resetLocalVoiceState: noOp,
      applyRemoteAudioState: noOp, playNotificationSound: noOp,
      applyLocalMicrophoneSettings: async () => { micCalls++; },
      SocketEvents: { VoiceJoin: "voice:join" }, ApiError: class extends Error {}, console,
    };
    const js = ts.transpileModule("exports.join = " + callback, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(js, globals);
    assert.equal(await exports.join("room", { muted }), true);
    assert.equal(micCalls, muted ? 0 : 1);
    assert.equal(allowed.current, !muted);
  }
  assert.match(source, /state !== "connected" \|\| !micCaptureAllowedRef\.current/);
});
