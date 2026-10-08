import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const lock = JSON.parse(readFileSync(new URL("package-lock.json", root), "utf8"));
const require = createRequire(new URL("package.json", root));
const semver = require("semver");
const uriPackages = Object.entries(lock.packages).filter(([path]) => path.endsWith("/fast-uri"));

test("all locked security-sensitive packages include the reviewed patches", () => {
  const floors = {
    fastify: "5.12.5", sharp: "0.35.5", "engine.io": "6.6.10",
    "brace-expansion": "5.0.12", "source-map-js": "1.2.2",
    vitest: "4.1.11", "@vitest/mocker": "4.1.11",
  };
  for (const [name, floor] of Object.entries(floors)) {
    const packages = Object.entries(lock.packages).filter(([path]) => path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`);
    assert.ok(packages.length > 0, name);
    for (const [path, pkg] of packages) {
      assert.ok(semver.gte(pkg.version, floor), `${path}: ${pkg.version} < ${floor}`);
      assert.equal(require(fileURLToPath(new URL(`${path}/package.json`, root))).version, pkg.version);
    }
  }
  assert.ok(uriPackages.length > 0);
  for (const [path, pkg] of uriPackages) {
    assert.ok(semver.satisfies(pkg.version, "^3.1.8 || ^4.1.5"), `${path}: ${pkg.version}`);
    const actual = require(fileURLToPath(new URL(`${path}/package.json`, root)));
    assert.equal(actual.version, pkg.version, "installed version matches the reviewed lockfile");
  }
});

// The parser checks use only small synthetic local input. A separate process
// bounds CPU/memory even if a future dependency regression hangs synchronously.
function boundedParserCheck(source) {
  const result = spawnSync(process.execPath, ["--max-old-space-size=128", "-e", source], {
    cwd: fileURLToPath(root), timeout: 5000, encoding: "utf8", maxBuffer: 8192,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
}

test("brace expansion bounds nesting and comma parsing without breaking normal patterns", () => {
  boundedParserCheck(`
    const assert = require('node:assert/strict');
    const { expand } = require('brace-expansion');
    assert.deepEqual(expand('file-{a,b}.txt'), ['file-a.txt', 'file-b.txt']);
    const nested = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
    const alternatives = '{a,'.repeat(4000) + 'z' + '}'.repeat(4000);
    for (const input of [nested, alternatives]) {
      const output = expand(input, { max: 8, maxLength: 50000 });
      assert.ok(output.length > 0 && output.length <= 8);
    }
    const commaGroups = '{' + Array(3000).fill('{x}').join(',') + '}';
    assert.ok(expand(commaGroups, { max: 8 }).length <= 8);
  `);
});

test("indexed source maps reject invalid and excessive offsets before amplification", () => {
  boundedParserCheck(`
    const assert = require('node:assert/strict');
    const { SourceMapConsumer } = require('source-map-js');
    const basic = { version: 3, sources: ['fixture.js'], names: [], mappings: 'AAAA' };
    const indexed = offset => ({ version: 3, sections: [{ offset, map: basic }] });
    for (const line of [1e8, -1, Infinity, NaN, 0.5, '1']) {
      assert.throws(() => new SourceMapConsumer(indexed({ line, column: 0 })));
    }
    for (const column of [-1, Infinity, 0.5, '1']) {
      assert.throws(() => new SourceMapConsumer(indexed({ line: 0, column })));
    }
    const valid = new SourceMapConsumer(indexed({ line: 0, column: 0 }));
    assert.deepEqual(valid.sources, ['fixture.js']);
    assert.equal(valid.originalPositionFor({ line: 1, column: 1 }).source, 'fixture.js');
  `);
});

test("sharp uses patched librsvg and safely decodes normal/malformed image fixtures", async () => {
  const sharp = require("sharp");
  assert.ok(semver.gte(sharp.versions.rsvg, "2.63.2"), `runtime librsvg ${sharp.versions.rsvg}`);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>');
  const output = await sharp(svg, { limitInputPixels: 64 }).webp().toBuffer();
  assert.equal((await sharp(output).metadata()).format, "webp");
  await assert.rejects(sharp(Buffer.from('<svg><invalid>'), { limitInputPixels: 64 }).webp().toBuffer());
  await assert.rejects(sharp(svg, { limitInputPixels: 16 }).webp().toBuffer(), /pixel limit/i);
});

test("Socket.IO rejects missing/mismatched EIO on follow-up and WebSocket upgrades", { timeout: 15000 }, async () => {
  const { Server } = require("socket.io");
  const WebSocket = require("ws");
  const http = createServer();
  // Same transport defaults and path as the runtime; isolated loopback fixture,
  // not application authentication or a request to a production service.
  const io = new Server(http, { path: "/socket.io" });
  const peers = [];
  try {
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const origin = `http://127.0.0.1:${http.address().port}`;
    const response = await fetch(`${origin}/socket.io/?EIO=4&transport=polling`, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200);
    const { sid } = JSON.parse((await response.text()).slice(1));
    assert.ok(sid);
    for (const revision of ["EIO=3&", ""]) {
      const followup = await fetch(`${origin}/socket.io/?${revision}transport=polling&sid=${sid}`, { signal: AbortSignal.timeout(3000) });
      assert.equal(followup.status, 400);
      const peer = new WebSocket(`${origin.replace('http:', 'ws:')}/socket.io/?${revision}transport=websocket&sid=${sid}`);
      peers.push(peer);
      const rejected = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("upgrade rejection timed out")), 3000);
        peer.on("unexpected-response", (_request, res) => { clearTimeout(timer); res.resume(); resolve(res.statusCode); });
        peer.on("error", () => {}); // rejected handshake is expected
        peer.on("open", () => { clearTimeout(timer); reject(new Error("protocol mismatch accepted")); });
      });
      assert.equal(rejected, 400);
    }
    const peer = new WebSocket(`${origin.replace('http:', 'ws:')}/socket.io/?EIO=4&transport=websocket&sid=${sid}`);
    peers.push(peer);
    await once(peer, "open", { signal: AbortSignal.timeout(3000) });
    const pong = once(peer, "message", { signal: AbortSignal.timeout(3000) });
    peer.send("2probe");
    assert.equal(String((await pong)[0]), "3probe");
    assert.equal(io.engine.clients[sid].protocol, 4);
  } finally {
    for (const peer of peers) peer.terminate();
    io.close();
    http.closeAllConnections();
    http.close();
  }
});

test("every installed URI parser rejects malformed IPv6 instead of normalizing it to a private host", () => {
  for (const [path] of uriPackages) {
    const uri = require(fileURLToPath(new URL(`${path}/`, root)));
    for (const host of ["::not-valid", "fc00::not-hex", "fe80::not-hex"]) {
      assert.ok(uri.parse(`http://[${host}]/private`).error, `${path}: ${host}`);
    }
    assert.equal(uri.parse("https://example.com/video").error, undefined);
  }
});
