import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";

// Uses an existing Playwright installation; never installs a browser/package.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ECLIPSE_PLAYWRIGHT_PATH || "playwright");
const dist = resolve("apps/web/dist");
const worklet = readdirSync(resolve(dist, "assets")).find(name => /^rnnoise\.worklet-.*\.js$/.test(name));
assert.ok(worklet, "build the web workspace before this smoke");
const nginx = readFileSync("deploy/nginx/eclipse-chat.conf", "utf8");
const csp = nginx.match(/add_header Content-Security-Policy "(default-src 'self'[^\n]+)" always;/)[1];
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", csp);
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><title>Eclipse synthetic audio smoke</title><button>Audio test</button>');
  } else if (req.url === "/assets/" + worklet) {
    res.setHeader("Content-Type", "application/javascript");
    res.end(readFileSync(resolve(dist, "assets", worklet)));
  } else { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  const page = await browser.newPage();
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(async worklet => {
    const ctx = new AudioContext({ sampleRate: 48000 });
    await ctx.resume();
    await ctx.audioWorklet.addModule("/assets/" + worklet);
    const node = new AudioWorkletNode(ctx, "eclipse-rnnoise", {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: "explicit",
    });
    const dest = ctx.createMediaStreamDestination();
    node.connect(dest);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("RNNoise init timed out")), 8000);
      node.port.onmessage = ({ data }) => {
        if (data === "ready") { clearTimeout(timeout); resolve(); }
        if (data === "failed") { clearTimeout(timeout); reject(new Error("RNNoise failed")); }
      };
      node.onprocessorerror = () => reject(new Error("processor error"));
    });
    const buffer = ctx.createBuffer(1, 48000 * 2, 48000);
    let seed = 42;
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      data[i] = ((seed / 4294967296) * 2 - 1) * 0.03;
    }
    const input = ctx.createBufferSource(); input.buffer = buffer; input.loop = true;
    const raw = ctx.createAnalyser(); const processed = ctx.createAnalyser();
    raw.fftSize = processed.fftSize = 2048;
    input.connect(raw); input.connect(node); node.connect(processed);
    input.start(); node.port.postMessage({ enabled: true });
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    await sleep(1500);
    const rms = analyser => {
      const samples = new Float32Array(2048); analyser.getFloatTimeDomainData(samples);
      return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
    };
    const rawRms = rms(raw); const processedRms = rms(processed);
    node.port.postMessage({ enabled: false }); await sleep(100);
    const mutedRms = rms(processed);
    node.port.postMessage("destroy"); node.disconnect(); node.port.close(); input.stop();
    dest.stream.getTracks().forEach(track => track.stop()); await ctx.close();
    return { sampleRate: ctx.sampleRate, rawRms, processedRms, mutedRms };
  }, worklet);
  assert.ok(result.rawRms > 0.01, "synthetic source must actually run");
  assert.ok(result.processedRms < result.rawRms * 0.7, "real WASM must attenuate steady synthetic noise");
  assert.ok(result.mutedRms < 0.000001, "mute must silence worklet output");
  console.log(JSON.stringify({ browser: "Chromium", kind: "synthetic-noise-only", ...result }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
