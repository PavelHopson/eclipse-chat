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
const voice = read("apps/web/src/hooks/useVoice.ts");
const voiceSettings = read("apps/web/src/components/VoiceSettingsModal.tsx");
function loadFunctions(source, names, globals = {}) {
  const ast = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join("\n");
  const code = declarations + "\n" + names.map(name => "exports." + name + "=" + name + ";").join("\n");
  const exports = {};
  runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...globals });
  return exports;
}
function loadConstant(source, name) {
  const ast = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.filter(ts.isVariableStatement)
    .flatMap(node => [...node.declarationList.declarations])
    .find(node => node.name.getText(ast) === name);
  assert.ok(declaration?.initializer, `Missing constant ${name}`);
  const exports = {};
  runInNewContext(ts.transpileModule(`exports.value = ${declaration.initializer.getText(ast)};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports });
  return exports.value;
}
function loadHookCallback(source, name, globals) {
  const ast = ts.createSourceFile("useVoice.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hook = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useVoice");
  const declaration = hook.body.statements.filter(ts.isVariableStatement)
    .flatMap(node => [...node.declarationList.declarations])
    .find(node => node.name.getText(ast) === name);
  assert.ok(declaration?.initializer && ts.isCallExpression(declaration.initializer), `Missing hook callback ${name}`);
  const exports = {};
  runInNewContext(ts.transpileModule(`exports.callback = ${declaration.initializer.arguments[0].getText(ast)};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, ...globals });
  return exports.callback;
}
function loadHookEffect(source, needle, globals) {
  const ast = ts.createSourceFile("useVoice.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hook = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useVoice");
  let effect;
  const visit = node => {
    if (
      !effect &&
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === "useEffect" &&
      node.getText(ast).includes(needle)
    ) effect = node;
    ts.forEachChild(node, visit);
  };
  visit(hook.body);
  assert.ok(effect?.arguments[0], `Missing hook effect containing ${needle}`);
  const exports = {};
  runInNewContext(ts.transpileModule(`exports.effect = ${effect.arguments[0].getText(ast)};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, ...globals });
  return exports.effect;
}
const labels = loadFunctions(room, ["resolveConnectionBadge", "formatRoomAudience"]);
const modes = loadFunctions(layout, ["resolveVoiceRoomLayout"]);

test("screen sharing requests browser-consented audio and remains restartable without it", async () => {
  const capture = loadConstant(voice, "SCREEN_SHARE_CAPTURE_OPTIONS");
  const publish = loadConstant(voice, "SCREEN_SHARE_PUBLISH_OPTIONS");
  const calls = [];
  const localParticipant = {
    isScreenShareEnabled: false,
    async setScreenShareEnabled(...args) {
      calls.push(args);
      this.isScreenShareEnabled = Boolean(args[0]);
      return { track: { stop() {} } };
    },
  };
  const activeRoom = { localParticipant };
  const roomRef = { current: activeRoom };
  let refreshes = 0;
  const toggle = loadHookCallback(voice, "toggleScreenShare", {
    roomRef,
    SCREEN_SHARE_CAPTURE_OPTIONS: capture,
    SCREEN_SHARE_PUBLISH_OPTIONS: publish,
    refreshVisualTracks: () => { refreshes++; },
    setError: error => { if (error) assert.fail(`Unexpected screen-share error: ${String(error)}`); },
  });

  await toggle();
  await toggle();
  await toggle();

  assert.deepEqual(calls.map(call => call[0]), [true, false, true]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1].audio)), {
    echoCancellation: false, noiseSuppression: false, autoGainControl: false,
  });
  assert.equal(calls[0][1].systemAudio, "include");
  assert.deepEqual(calls[0][2], publish);
  assert.equal(refreshes, 3);
  // No audio publication is required for a successful window/screen share.
  const { hasActiveScreenShareAudio } = loadFunctions(voice, ["hasActiveScreenShareAudio"]);
  assert.equal(hasActiveScreenShareAudio([]), false);
});

test("screen audio state follows only an active LiveKit screen-audio publication", () => {
  const { hasActiveScreenShareAudio } = loadFunctions(voice, ["hasActiveScreenShareAudio"]);
  assert.equal(hasActiveScreenShareAudio([{ source: "microphone", isMuted: false }]), false);
  assert.equal(hasActiveScreenShareAudio([{ source: "screen_share_audio", isMuted: true }]), false);
  assert.equal(hasActiveScreenShareAudio([{ source: "screen_share_audio", isMuted: false }]), true);
  assert.match(room, /Экран и звук в эфире/);
  assert.match(room, /Экран без звука/);
  assert.match(room, /Со звуком/);
  assert.match(room, /Без звука/);
});

test("late screen permission disables the whole stale source and stops its returned track", async () => {
  let resolvePermission;
  const permission = new Promise(resolve => { resolvePermission = resolve; });
  const calls = [];
  let stopped = 0;
  const localParticipant = {
    isScreenShareEnabled: false,
    async setScreenShareEnabled(enabled) {
      calls.push(enabled);
      if (enabled) await permission;
      return { track: { stop: () => { stopped++; } } };
    },
  };
  const staleRoom = { localParticipant };
  const roomRef = { current: staleRoom };
  let refreshes = 0;
  const toggle = loadHookCallback(voice, "toggleScreenShare", {
    roomRef,
    SCREEN_SHARE_CAPTURE_OPTIONS: loadConstant(voice, "SCREEN_SHARE_CAPTURE_OPTIONS"),
    SCREEN_SHARE_PUBLISH_OPTIONS: loadConstant(voice, "SCREEN_SHARE_PUBLISH_OPTIONS"),
    refreshVisualTracks: () => { refreshes++; },
    setError: error => assert.fail(`Unexpected stale cleanup error: ${String(error)}`),
  });

  const result = toggle();
  roomRef.current = { localParticipant: {} };
  resolvePermission();
  await result;

  assert.deepEqual(calls, [true, false]);
  assert.equal(stopped, 1);
  assert.equal(refreshes, 0);
});

test("remote screen audio uses the generic audio attach, output and deafen path", () => {
  const subscribed = voice.slice(
    voice.indexOf("RoomEvent.TrackSubscribed"),
    voice.indexOf("RoomEvent.TrackUnsubscribed"),
  );
  assert.match(subscribed, /track\.kind === Track\.Kind\.Audio/);
  assert.match(subscribed, /attachRemoteAudioElement\(track, configure\)/);
  assert.match(subscribed, /setSinkId/);
  assert.match(subscribed, /applyRemoteAudioState\(entry, deafenedRef\.current\)/);
  assert.doesNotMatch(subscribed, /Track\.Source\.Microphone|source === ["']microphone["']/);
});

test("microphone and deafen controls preserve explicit mute state and participant gain", async () => {
  const { disableRawMicrophoneTracks } = loadFunctions(voice, ["disableRawMicrophoneTracks"]);
  const settingsRef = {
    current: {
      participantVolumes: { speaker: 0.5 },
      masterOutputVolume: 0.8,
      mutedParticipants: ["muted-speaker"],
    },
  };
  const applyRemoteAudioState = loadHookCallback(voice, "applyRemoteAudioState", { settingsRef });
  const audible = { participantIdentity: "speaker", audioEl: { volume: 0, muted: true } };
  applyRemoteAudioState(audible, false);
  assert.equal(audible.audioEl.volume, 0.4);
  assert.equal(audible.audioEl.muted, false);
  const muted = { participantIdentity: "muted-speaker", audioEl: { volume: 0, muted: false } };
  applyRemoteAudioState(muted, false);
  assert.equal(muted.audioEl.muted, true);
  applyRemoteAudioState(audible, true);
  assert.equal(audible.audioEl.muted, true);

  const micCalls = [];
  let micMuted = false;
  let refreshes = 0;
  const roomRef = {
    current: {
      localParticipant: {
        audioTrackPublications: new Map(),
        setMicrophoneEnabled: async enabled => { micCalls.push(enabled); },
      },
    },
  };
  const toggleMic = loadHookCallback(voice, "toggleMic", {
    roomRef,
    micCaptureAllowedRef: { current: true },
    micManuallyMutedRef: { current: false },
    deafenedRef: { current: false },
    enhancerRef: { current: null },
    disableRawMicrophoneTracks,
    applyLocalMicrophoneSettings: () => assert.fail("Muting does not need reacquisition"),
    setIsMicMuted: value => { micMuted = value; },
    refreshParticipants: () => { refreshes++; },
    setError: error => { if (error) assert.fail(`Unexpected microphone error: ${String(error)}`); },
  });
  await toggleMic();
  assert.deepEqual(micCalls, [false]);
  assert.equal(micMuted, true);
  assert.equal(refreshes, 1);

  let deafened = false;
  const entries = new Map([["speaker", audible]]);
  const toggleDeafen = loadHookCallback(voice, "toggleDeafen", {
    isDeafened: false,
    roomRef,
    deafenedRef: { current: false },
    micCaptureAllowedRef: { current: true },
    micManuallyMutedRef: { current: false },
    pttActiveRef: { current: false },
    vadVoiceActiveRef: { current: false },
    remoteTracksRef: { current: entries },
    applyRemoteAudioState,
    disableRawMicrophoneTracks,
    enhancerRef: { current: null },
    setIsDeafened: value => { deafened = value; },
    setPttActive: () => {},
    setIsMicMuted: () => {},
    applyLocalMicrophoneSettings: () => assert.fail("Deafening must only disable the mic"),
    setError: error => assert.fail(`Unexpected deafen error: ${String(error)}`),
    refreshParticipants: () => { refreshes++; },
    console,
  });
  await toggleDeafen();
  assert.equal(deafened, true);
  assert.equal(audible.audioEl.muted, true);
  assert.deepEqual(micCalls, [false, false]);
});

test("camera control uses bounded capture and publish options and remains restartable", async () => {
  const calls = [];
  const localParticipant = {
    isCameraEnabled: false,
    async setCameraEnabled(...args) {
      calls.push(args);
      this.isCameraEnabled = Boolean(args[0]);
    },
  };
  let refreshes = 0;
  const toggleCamera = loadHookCallback(voice, "toggleCamera", {
    roomRef: { current: { localParticipant } },
    CAMERA_CAPTURE_OPTIONS: loadConstant(voice, "CAMERA_CAPTURE_OPTIONS"),
    CAMERA_PUBLISH_OPTIONS: loadConstant(voice, "CAMERA_PUBLISH_OPTIONS"),
    refreshVisualTracks: () => { refreshes++; },
    setError: error => { if (error) assert.fail(`Unexpected camera error: ${String(error)}`); },
  });
  await toggleCamera();
  await toggleCamera();
  await toggleCamera();
  assert.deepEqual(calls.map(call => call[0]), [true, false, true]);
  assert.equal(calls[0][1].resolution.width, 1280);
  assert.equal(calls[0][1].resolution.height, 720);
  assert.equal(calls[0][2].videoEncoding.maxBitrate, 1_800_000);
  assert.equal(refreshes, 3);
});

test("input and output device changes cover current and future audio tracks", () => {
  assert.match(voice, /switchActiveDevice\("audiooutput", targetId\)/);
  assert.match(voice, /el\.setSinkId\(targetId\)/);
  assert.match(voice, /switchActiveDevice\("audioinput", targetId\)/);
  assert.match(voice, /settings\.outputDeviceId/);
  assert.match(voice, /settings\.inputDeviceId/);
  assert.match(voice, /Не удалось переключить вывод звука/);
  assert.match(voice, /Не удалось переключить микрофон/);
});

test("one microphone policy closes PTT and VAD on manual mute, deafen and hidden tabs", () => {
  const { shouldTransmitMicrophone, shouldCaptureMicrophone, applyMicrophoneTrackPolicy } = loadFunctions(
    voice,
    ["shouldTransmitMicrophone", "shouldCaptureMicrophone", "applyMicrophoneTrackPolicy"],
  );
  const base = {
    manuallyMuted: false,
    deafened: false,
    documentVisible: true,
    pttActive: false,
    vadActive: false,
  };
  assert.equal(shouldTransmitMicrophone({ ...base, mode: "open" }), true);
  assert.equal(shouldTransmitMicrophone({ ...base, mode: "open", manuallyMuted: true }), false);
  assert.equal(shouldTransmitMicrophone({ ...base, mode: "open", deafened: true }), false);
  assert.equal(shouldTransmitMicrophone({ ...base, mode: "push_to_talk", pttActive: true }), true);
  assert.equal(shouldTransmitMicrophone({
    ...base, mode: "push_to_talk", pttActive: true, documentVisible: false,
  }), false);
  assert.equal(shouldTransmitMicrophone({ ...base, mode: "voice_activity", vadActive: true }), true);
  assert.equal(shouldTransmitMicrophone({
    ...base, mode: "voice_activity", vadActive: true, documentVisible: false,
  }), false);
  assert.equal(shouldCaptureMicrophone({ ...base, mode: "voice_activity" }), true);
  assert.equal(shouldCaptureMicrophone({ ...base, mode: "voice_activity", documentVisible: false }), false);

  const published = { enabled: true };
  const input = { enabled: false };
  const output = { enabled: true };
  const enhancer = {
    setInputEnabled: enabled => { input.enabled = enabled; },
    setOutputEnabled: enabled => { output.enabled = enabled; },
  };
  const policyRoom = { localParticipant: { audioTrackPublications: new Map([
    ["mic", { source: "microphone", audioTrack: { mediaStreamTrack: published } }],
  ]) } };
  applyMicrophoneTrackPolicy(policyRoom, enhancer, { ...base, mode: "voice_activity" });
  assert.equal(input.enabled, true, "private VAD input must remain readable");
  assert.equal(output.enabled, false, "published output starts closed");
  assert.equal(published.enabled, false, "LiveKit track starts closed");
  applyMicrophoneTrackPolicy(policyRoom, enhancer, { ...base, mode: "voice_activity", vadActive: true });
  assert.equal(input.enabled, true);
  assert.equal(output.enabled, true);
  assert.equal(published.enabled, true);
  assert.match(voice, /setInputTrackRevision\(revision => revision \+ 1\)/);
  assert.match(voice, /const inputTrack = enhancer\?\.inputTrack/);
  assert.match(voice, /new MediaStream\(\[inputTrack\]\)/);
  assert.doesNotMatch(voice, /new MediaStream\(\[publishedTrack\]\)/);
});

test("new raw and enhanced microphone tracks are disabled before LiveKit publish", async () => {
  const events = [];
  const raw = { enabled: true, stop: () => events.push("raw-stop") };
  const output = { enabled: true, stop: () => events.push("output-stop") };
  const captureTrack = { mediaStreamTrack: raw, constraints: { echoCancellation: true }, stop: raw.stop };
  const createAudioEnhancer = () => {
    assert.equal(raw.enabled, false, "raw capture must close before DSP output exists");
    return ({
    inputTrack: raw,
    outputTrack: output,
    setInputEnabled: enabled => { raw.enabled = enabled; events.push(`input:${enabled}`); },
    setOutputEnabled: enabled => { output.enabled = enabled; events.push(`output:${enabled}`); },
    setGain() {},
    destroy() { raw.enabled = false; output.enabled = false; },
    });
  };
  class LocalAudioTrack {
    constructor(mediaStreamTrack, constraints) {
      this.mediaStreamTrack = mediaStreamTrack;
      this.constraints = constraints;
    }
  }
  const lk = {
    createLocalAudioTrack: async () => captureTrack,
    LocalAudioTrack,
    Track: { Source: { Microphone: "microphone" } },
  };
  const room = { localParticipant: {
    audioTrackPublications: new Map(),
    publishTrack: async track => {
      events.push("publish");
      assert.equal(raw.enabled, false, "raw capture must be closed before publish starts");
      assert.equal(track.mediaStreamTrack.enabled, false, "published DSP output must be closed before publish starts");
      return { audioTrack: track, track };
    },
  } };
  const { publishPreMutedMicrophone } = loadFunctions(
    voice,
    ["publishPreMutedMicrophone"],
    { createAudioEnhancer },
  );
  await publishPreMutedMicrophone(lk, room, {}, { micGain: 1, gainOnly: true });
  assert.ok(events.indexOf("input:false") < events.indexOf("publish"));
  assert.ok(events.indexOf("output:false") < events.indexOf("publish"));
  assert.doesNotMatch(voice, /setMicrophoneEnabled\(true/);
});

test("input-device restart keeps old and replacement capture closed across failure and gate races", async () => {
  const { disableRawMicrophoneTracks } = loadFunctions(voice, ["disableRawMicrophoneTracks"]);
  const makePublication = () => ({
    source: "microphone",
    audioTrack: { mediaStreamTrack: { enabled: true } },
  });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  const failedPublication = makePublication();
  const failedRoom = {
    localParticipant: {
      audioTrackPublications: new Map([["mic", failedPublication]]),
      setMicrophoneEnabled: async () => { throw new Error("device lost"); },
    },
    switchActiveDevice: async () => assert.fail("switch must not run after fail-closed stop rejection"),
  };
  const failedManual = { current: false };
  const failedCapture = { current: true };
  let failedMuted = false;
  let failedError = null;
  const failedEffect = loadHookEffect(voice, 'switchActiveDevice("audioinput"', {
    roomRef: { current: failedRoom }, settings: { inputDeviceId: "headset" },
    settingsRef: { current: { micActivationMode: "open" } },
    micCaptureAllowedRef: failedCapture, micManuallyMutedRef: failedManual,
    deafenedRef: { current: false }, pttActiveRef: { current: false },
    vadVoiceActiveRef: { current: false }, documentVisibleRef: { current: true },
    disableRawMicrophoneTracks, setIsMicMuted: value => { failedMuted = value; },
    enhancerRef: { current: null },
    setError: value => { failedError = typeof value === "function" ? value(failedError) : value; },
    applyLocalMicrophoneSettings: async () => assert.fail("failed switch must not reacquire"),
    INPUT_DEVICE_ERROR: "input failed",
  });
  failedEffect();
  assert.equal(failedPublication.audioTrack.mediaStreamTrack.enabled, false);
  await flush();
  assert.equal(failedManual.current, true);
  assert.equal(failedCapture.current, false);
  assert.equal(failedMuted, true);
  assert.equal(failedError, "input failed");

  let releaseSwitch;
  const switchGate = new Promise(resolve => { releaseSwitch = resolve; });
  const racedPublication = makePublication();
  const racedManual = { current: false };
  let reacquired = 0;
  const racedRoom = {
    localParticipant: {
      audioTrackPublications: new Map([["mic", racedPublication]]),
      setMicrophoneEnabled: async () => {},
    },
    switchActiveDevice: async () => switchGate,
  };
  const racedEffect = loadHookEffect(voice, 'switchActiveDevice("audioinput"', {
    roomRef: { current: racedRoom }, settings: { inputDeviceId: "usb" },
    settingsRef: { current: { micActivationMode: "open" } },
    micCaptureAllowedRef: { current: true }, micManuallyMutedRef: racedManual,
    deafenedRef: { current: false }, pttActiveRef: { current: false },
    vadVoiceActiveRef: { current: false }, documentVisibleRef: { current: true },
    disableRawMicrophoneTracks, setIsMicMuted: () => {}, setError: () => {},
    enhancerRef: { current: null },
    applyLocalMicrophoneSettings: async () => { reacquired++; },
    INPUT_DEVICE_ERROR: "input failed",
  });
  racedEffect();
  assert.equal(racedPublication.audioTrack.mediaStreamTrack.enabled, false);
  await flush();
  racedManual.current = true;
  releaseSwitch();
  await flush();
  assert.equal(reacquired, 0);
  assert.equal(racedPublication.audioTrack.mediaStreamTrack.enabled, false);
});

test("deafen disables the raw microphone even when the SDK disable call rejects", async () => {
  const { disableRawMicrophoneTracks } = loadFunctions(voice, ["disableRawMicrophoneTracks"]);
  const publication = {
    source: "microphone",
    audioTrack: { mediaStreamTrack: { enabled: true } },
  };
  const micCaptureAllowedRef = { current: true };
  let muted = false;
  const room = {
    localParticipant: {
      audioTrackPublications: new Map([["mic", publication]]),
      setMicrophoneEnabled: async () => { throw new Error("SDK rejection"); },
    },
  };
  const toggleDeafen = loadHookCallback(voice, "toggleDeafen", {
    isDeafened: false, roomRef: { current: room }, deafenedRef: { current: false },
    micCaptureAllowedRef, micManuallyMutedRef: { current: false },
    pttActiveRef: { current: false }, vadVoiceActiveRef: { current: false },
    remoteTracksRef: { current: new Map() }, applyRemoteAudioState: () => {},
    setIsDeafened: () => {}, setPttActive: () => {},
    setIsMicMuted: value => { muted = value; },
    applyLocalMicrophoneSettings: async () => assert.fail("deafen must not reacquire"),
    setError: () => {}, refreshParticipants: () => {},
    disableRawMicrophoneTracks, console: { warn: () => {} },
    enhancerRef: { current: null },
  });
  await toggleDeafen();
  assert.equal(publication.audioTrack.mediaStreamTrack.enabled, false);
  assert.equal(micCaptureAllowedRef.current, false);
  assert.equal(muted, true);
  assert.match(voice, /catch \(micErr\) \{\s*micManuallyMutedRef\.current = true/);
});

test("settings mic test invalidates late grants, RAF callbacks and error resources", () => {
  assert.match(voiceSettings, /testGenerationRef\.current !== generation/);
  assert.match(voiceSettings, /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(voiceSettings, /analyserRef\.current !== analyser/);
  assert.match(voiceSettings, /catch \(e\) \{[\s\S]*stopTestResources\(\)/);
  assert.doesNotMatch(voiceSettings, /MediaRecorder|apiJson|fetch\(|WebSocket/);
  assert.match(voiceSettings, /role="alert" aria-live="assertive"/);
  assert.match(voiceSettings, /className="ec-voice-settings__mode"/);
  assert.equal(
    voiceSettings.match(/className="ec-voice-settings__mode"/g)?.length,
    2,
    "both noise-suppression and activation segment groups need the mobile touch target",
  );
  const mediaCss = read("apps/web/src/styles/media-workbench.css");
  assert.match(mediaCss, /@media \(max-width: 700px\)[\s\S]*ec-voice-settings \.ec-btn--sm,[\s\S]*ec-voice-settings__mode \{ min-height: 44px !important; \}/);
});

test("autoplay recovery and 320px call controls expose accessible 44px actions", () => {
  assert.match(room, /isAudioPlaybackBlocked/);
  assert.match(room, /onClick=\{\(\) => void v\.resumeAudioPlayback\(\)\}/);
  assert.match(room, /role="status" aria-live="polite"/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /ec-voice-playback-gate button \{[\s\S]*min-width: 44px; min-height: 44px/);
  assert.match(css, /overflow-x: auto !important/);
});

test("join, reconnect, quality and cleanup remain connected to the LiveKit lifecycle", () => {
  assert.match(voice, /\/voice\/join`[\s\S]*method: "POST"/);
  assert.ok(voice.indexOf("await r.connect(data.wsUrl, data.token)") < voice.indexOf("SocketEvents.VoiceJoin"));
  assert.match(voice, /ConnectionState\.Reconnecting/);
  assert.match(voice, /RoomEvent\.ConnectionQualityChanged/);
  assert.match(voice, /RoomEvent\.TrackSubscribed/);
  assert.match(voice, /RoomEvent\.TrackUnsubscribed/);
  assert.match(voice, /track\.detach\(\)/);
  assert.match(voice, /entry\.audioEl\.remove\(\)/);
  assert.match(voice, /remoteTracksRef\.current\.clear\(\)/);
  assert.match(voice, /await r\.disconnect\(\)/);
  assert.match(voice, /return \(\) => \{\s*void leave\(\);/);
});

test("RTC quality diagnostics retain safe numeric units and failure fallback", async () => {
  const remoteTracksRef = { current: new Map() };
  remoteTracksRef.current.set("speaker-track", {
    participantIdentity: "speaker",
    track: {
      getRTCStatsReport: async () => new Map([
        ["inbound", { type: "inbound-rtp", kind: "audio", bytesReceived: 2048, packetsLost: 3, jitter: 0.012 }],
        ["remote", { type: "remote-inbound-rtp", kind: "audio", roundTripTime: 0.08 }],
      ]),
    },
  });
  remoteTracksRef.current.set("unavailable-track", {
    participantIdentity: "unavailable",
    track: { getRTCStatsReport: async () => { throw new Error("stats unavailable"); } },
  });
  const getRemoteStats = loadHookCallback(voice, "getRemoteStats", { remoteTracksRef });
  const stats = JSON.parse(JSON.stringify(await getRemoteStats()));
  assert.deepEqual(stats[0], {
    identity: "speaker",
    bitrate: 2048,
    packetsLost: 3,
    jitter: 12,
    roundTripMs: 80,
  });
  assert.deepEqual(stats[1], {
    identity: "unavailable",
    bitrate: null,
    packetsLost: null,
    jitter: null,
    roundTripMs: null,
  });
});

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
      micManuallyMutedRef: { current: false },
      socketRef: { current: null }, isDeafened: false,
      setError: noOp, setBusy: noOp, setIsMicMuted: noOp, setRoom: noOp, setActiveChannelId: noOp,
      setIsAudioPlaybackBlocked: noOp,
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
