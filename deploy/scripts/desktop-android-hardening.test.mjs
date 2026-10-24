import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("desktop default capability has no broad shell open permission", () => {
  const capability = read("apps/desktop/src-tauri/capabilities/default.json");
  assert.doesNotMatch(capability, /shell:allow-open/);
  assert.match(capability, /updater:default/);
});

test("desktop external media keeps its narrow custom bridge", () => {
  const capability = read("apps/desktop/src-tauri/capabilities/remote-external-media.json");
  const bridge = read("apps/desktop/src-tauri/src/lib.rs");
  assert.match(capability, /https:\/\/app\.star-crm\.ru\/eclipse-chat\/\*/);
  assert.match(capability, /allow-open-external-media/);
  assert.match(bridge, /parsed\.scheme\(\) != "https"/);
  assert.match(bridge, /allowed_host/);
});

test("android downloads are HTTPS-only and scoped to Eclipse Chat", () => {
  const activity = read("apps/android/native/MainActivity.java");
  assert.match(activity, /APP_HOST = "app\.star-crm\.ru"/);
  assert.ok(activity.includes('APP_PATH_PREFIX = "/eclipse-chat/"'));
  assert.match(activity, /"https"\.equalsIgnoreCase\(parsed\.getScheme\(\)\)/);
  assert.match(activity, /parsed\.getPath\(\)\.startsWith\(APP_PATH_PREFIX\)/);
  assert.match(activity, /if \(!isTrustedDownloadUrl\(url\)\) \{/);
});
