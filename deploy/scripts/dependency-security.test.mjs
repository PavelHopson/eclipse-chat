import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const lock = JSON.parse(readFileSync(new URL("package-lock.json", root), "utf8"));
const require = createRequire(new URL("package.json", root));
const semver = require("semver");
const uriPackages = Object.entries(lock.packages).filter(([path]) => path.endsWith("/fast-uri"));

test("all locked URI parsers and Fastify include the security patches", () => {
  assert.ok(semver.gte(lock.packages["node_modules/fastify"].version, "5.12.1"));
  assert.ok(uriPackages.length > 0);
  for (const [path, pkg] of uriPackages) {
    assert.ok(semver.satisfies(pkg.version, "^3.1.6 || ^4.1.3"), `${path}: ${pkg.version}`);
    const actual = require(fileURLToPath(new URL(`${path}/package.json`, root)));
    assert.equal(actual.version, pkg.version, "installed version matches the reviewed lockfile");
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
