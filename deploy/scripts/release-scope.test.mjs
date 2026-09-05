import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const workflow = read(".github/workflows/deploy-prod.yml");
const deploy = read("deploy/scripts/deploy.sh");

test("routine release keeps approval, verified backup and exact-SHA gates without other products", () => {
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /pg_restore --list/);
  assert.match(workflow, /test .*database_bytes/);
  assert.match(workflow, /for database in eclipse_chat; do/);
  assert.doesNotMatch(workflow, /star_crm|star-crm-backup|app\.star-crm\.ru\/backend|OFFICE_INGEST_SENTINEL/);
  assert.ok(workflow.indexOf("pg_restore --list") < workflow.lastIndexOf('git reset --hard "$ECLIPSE_RELEASE_SHA"'));
  assert.match(deploy, /prisma migrate deploy/);
  assert.match(deploy, /rollback_activated_build/);
  assert.match(deploy, /SMOKE_EXPECTED_VERSION/);
  assert.doesNotMatch(deploy, /sync-ai-gateway|configure-office-ingest|OFFICE_INGEST_SENTINEL|ch(?:mod|own).*CHAT_ENV|cp .*CHAT_ENV/);
});

test("configuration sync can update only explicit Chat-owned targets and preserves backups", () => {
  const nginx = read("deploy/scripts/sync-nginx.sh");
  const supervisor = read("deploy/scripts/sync-supervisor.sh");
  assert.match(nginx, /for name in eclipse-chat\.conf eclipse-chat-livekit\.conf; do/);
  assert.match(nginx, /nginx -t/);
  assert.doesNotMatch(nginx, /find .*delete/);
  assert.match(supervisor, /for name in eclipse-chat-server\.conf; do/);
  assert.match(supervisor, /sudo supervisorctl update eclipse-chat-server/);
  assert.doesNotMatch(supervisor, /sudo supervisorctl update\s*\n/);
});

test("database preflight accepts only the configured local Chat database and never logs credentials", async () => {
  const marker = "node --input-type=module <<'ECLIPSE_VERIFY_DATABASE'\n";
  const inline = workflow.slice(workflow.indexOf(marker) + marker.length).split("\n            ECLIPSE_VERIFY_DATABASE")[0]
    .replace(/^\s*import .*;\n/gm, "");
  for (const [value, success] of [
    ["postgresql://fixture-user:fixture-pass@127.0.0.1:5432/eclipse_chat?schema=public", true],
    ["postgres://fixture-user:fixture-pass@localhost/eclipse_chat", true],
    ["postgresql://fixture-user:fixture-pass@example.com/eclipse_chat", false],
    ["postgresql://fixture-user:fixture-pass@localhost/another_product", false],
    ["postgresql://fixture-user:fixture-pass@localhost:5433/eclipse_chat", false],
    ["https://localhost/eclipse_chat", false], ["invalid-private-value", false],
  ]) {
    const logs = [], process = { exitCode: 0 };
    await runInNewContext(`(async () => { ${inline} })()`, {
      URL, process, decodeURIComponent,
      createRequire: () => () => ({ parse: () => ({ DATABASE_URL: value }) }),
      readManagedEnvironment: async () => ({ original: "test fixture only" }),
      console: { log: line => logs.push(line), error: line => logs.push(line) },
    });
    assert.equal(process.exitCode, success ? 0 : 1);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(logs.join(""), /fixture-pass|fixture-user|invalid-private-value/);
  }
});

test("CI and deployment execute appearance and release regression suites", () => {
  for (const text of [workflow, read(".github/workflows/ci.yml")]) {
    for (const name of ["appearance", "dependency-security", "release-scope"]) assert.ok(text.includes(`deploy/scripts/${name}.test.mjs`));
  }
});
