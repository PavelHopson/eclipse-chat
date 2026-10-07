import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)(process.env.ECLIPSE_PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  const page = await browser.newPage();
  await page.route("**/qa-audio", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><div id="qa-root"></div>' }));
  await page.goto("http://127.0.0.1:5187/qa-audio");
  const result = await page.evaluate(async () => {
    const { createAudioEnhancer } = await import("/src/lib/audioEnhancer.ts");
    const sourceCtx = new AudioContext({ sampleRate: 48000 }); await sourceCtx.resume();
    const buffer = sourceCtx.createBuffer(1, 48000 * 2, 48000);
    const samples = buffer.getChannelData(0);
    let phase = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / 48000;
      phase += 2 * Math.PI * (120 + 18 * Math.sin(2 * Math.PI * 1.3 * t)) / 48000;
      const envelope = Math.max(0, Math.sin(2 * Math.PI * 3 * t));
      let value = 0;
      for (let h = 1; h < 30; h++) value += Math.sin(phase * h) / h;
      samples[i] = value * envelope * 0.15;
    }
    const osc = sourceCtx.createBufferSource(); osc.buffer = buffer; osc.loop = true;
    const dest = sourceCtx.createMediaStreamDestination(); osc.connect(dest); osc.start();
    const input = dest.stream.getAudioTracks()[0]; input.enabled = false;
    const enhancer = await createAudioEnhancer(input, { micGain: 1, gainOnly: false });
    const initiallyClosed = !input.enabled && !enhancer.outputTrack.enabled;
    enhancer.setInputEnabled(true); enhancer.setOutputEnabled(true);
    const analyser = sourceCtx.createAnalyser(); analyser.fftSize = 2048;
    sourceCtx.createMediaStreamSource(new MediaStream([enhancer.outputTrack])).connect(analyser);
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const data = new Float32Array(2048); analyser.getFloatTimeDomainData(data);
      peak = Math.max(peak, ...data.map(Math.abs));
    }
    enhancer.setOutputEnabled(false); enhancer.setInputEnabled(false);
    const closedOnMute = !input.enabled && !enhancer.outputTrack.enabled;
    enhancer.destroy(); enhancer.destroy(); osc.stop(); await sourceCtx.close();
    return { processing: enhancer.processing, initiallyClosed, closedOnMute, peak,
      inputState: input.readyState, outputState: enhancer.outputTrack.readyState };
  });
  assert.equal(result.processing, "rnnoise");
  assert.equal(result.initiallyClosed, true); assert.equal(result.closedOnMute, true);
  assert.ok(result.peak > 0.001, "actual microphone graph must produce non-silent output");
  assert.equal(result.inputState, "ended"); assert.equal(result.outputState, "ended");
  console.log(JSON.stringify({ kind: "real-enhancer/synthetic-input", ...result }));

  const playback = await page.evaluate(async () => {
    const RefreshRuntime = (await import("/@react-refresh")).default;
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const { attachRemoteAudioElement, requestRemoteAudioPlayback } = await import("/src/hooks/useVoice.ts");
    const { RemoteAudioTrack } = await import("/node_modules/.vite/deps/livekit-client.js");
    const ctx = new AudioContext(); await ctx.resume();
    const osc = ctx.createOscillator(); const dest = ctx.createMediaStreamDestination();
    osc.connect(dest); osc.start();
    const sender = new RTCPeerConnection({ iceServers: [] });
    const receiver = new RTCPeerConnection({ iceServers: [] });
    sender.onicecandidate = e => { if (e.candidate) void receiver.addIceCandidate(e.candidate); };
    receiver.onicecandidate = e => { if (e.candidate) void sender.addIceCandidate(e.candidate); };
    let remote, element;
    const received = new Promise(resolve => { receiver.ontrack = e => resolve(e); });
    try {
      sender.addTrack(dest.stream.getAudioTracks()[0], dest.stream);
      await sender.setLocalDescription(await sender.createOffer());
      await receiver.setRemoteDescription(sender.localDescription);
      await receiver.setLocalDescription(await receiver.createAnswer());
      await sender.setRemoteDescription(receiver.localDescription);
      const event = await Promise.race([received, new Promise((_, reject) => setTimeout(() => reject(new Error("local WebRTC timeout")), 8000))]);
      remote = new RemoteAudioTrack(event.track, "synthetic-screen-audio", event.receiver);
      element = attachRemoteAudioElement(remote, el => { el.muted = true; el.volume = 0.35; });
      const protectedOnAttach = element.muted && element.volume === 0.35 && element.isConnected;
      element.muted = false;
      const playing = await requestRemoteAudioPlayback(element);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
      ctx.createMediaStreamSource(element.srcObject).connect(analyser);
      let peak = 0;
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const data = new Float32Array(2048); analyser.getFloatTimeDomainData(data);
        peak = Math.max(peak, ...data.map(Math.abs));
      }
      return { protectedOnAttach, playing, peak, paused: element.paused, audioTracks: element.srcObject.getAudioTracks().length };
    } finally {
      remote?.detach(); element?.remove(); sender.close(); receiver.close();
      osc.stop(); dest.stream.getTracks().forEach(t => t.stop()); await ctx.close();
    }
  });
  assert.equal(playback.protectedOnAttach, true); assert.equal(playback.playing, true);
  assert.equal(playback.paused, false); assert.equal(playback.audioTracks, 1);
  assert.ok(playback.peak > 0.01, "real SDK attachment receives non-silent local WebRTC audio");
  console.log(JSON.stringify({ kind: "real-LiveKit-track/local-WebRTC/synthetic-audio", ...playback }));

  await page.evaluate(async () => {
    const RefreshRuntime = (await import("/@react-refresh")).default;
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import("/src/index.css"); await import("/src/styles/app.css");
    const React = (await import("/node_modules/.vite/deps/react.js")).default;
    const { createRoot } = (await import("/node_modules/.vite/deps/react-dom_client.js")).default;
    const { VoiceSettingsModal } = await import("/src/components/VoiceSettingsModal.tsx");
    const { ConfirmProvider } = await import("/src/components/ConfirmDialog.tsx");
    document.documentElement.dataset.ecTheme = "obsidian";
    const ctx = new AudioContext({ sampleRate: 48000 }); await ctx.resume();
    const osc = ctx.createOscillator(); const dest = ctx.createMediaStreamDestination(); osc.connect(dest); osc.start();
    navigator.mediaDevices.getUserMedia = async () => new MediaStream([dest.stream.getAudioTracks()[0].clone()]);
    window.qaAudioRoot = createRoot(document.getElementById("qa-root"));
    window.qaAudioRoot.render(React.createElement(ConfirmProvider, null, React.createElement(VoiceSettingsModal, { onClose: () => window.qaAudioRoot.unmount() })));
    window.qaAudioCleanup = async () => { window.qaAudioRoot.unmount(); osc.stop(); dest.stream.getTracks().forEach(t => t.stop()); await ctx.close(); };
  });
  await page.getByRole("button", { name: "Усиленное", exact: false }).click();
  await page.getByRole("button", { name: "Проверить микрофон", exact: true }).click();
  await page.getByText("RNNoise работает локально", { exact: true }).waitFor({ timeout: 12000 });
  mkdirSync(".codex-artifacts/voice-audio", { recursive: true });
  for (const width of [1280, 320, 360, 390, 412]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      dialog: document.querySelector('[role="dialog"]').getBoundingClientRect().width }));
    assert.equal(metrics.overflow, false, `horizontal overflow at ${width}px`);
    await page.getByText("RNNoise работает локально", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.codex-artifacts/voice-audio/settings-${width}.png` });
    console.log(JSON.stringify({ kind: "real-settings/synthetic-mic", width, ...metrics }));
  }
  await page.getByRole("button", { name: "Остановить тест", exact: true }).click();
  await page.evaluate(() => window.qaAudioCleanup());
} finally { await browser.close(); }
