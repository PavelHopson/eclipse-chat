import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const workflow = read(".github/workflows/deploy-prod.yml");
const deploy = read("deploy/scripts/deploy.sh");
const livekitExample = read("deploy/livekit/livekit.yaml.example");

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

test("v1.7.74 skips migration only after verifying the exact previous production diff", () => {
  assert.match(workflow, /envs: ECLIPSE_RELEASE_SHA,ECLIPSE_SKIP_DB_MIGRATION/);
  assert.match(workflow, /ECLIPSE_SKIP_DB_MIGRATION: "1"/);
  assert.match(deploy, /JSON\.parse\(fs\.readFileSync\("release\.json", "utf8"\)\)\.commit/);
  assert.match(deploy, /git merge-base --is-ancestor "\$PREVIOUS_RELEASE_SHA" "\$ECLIPSE_RELEASE_SHA"/);
  assert.match(deploy, /git diff --quiet "\$PREVIOUS_RELEASE_SHA" "\$ECLIPSE_RELEASE_SHA" -- \\\n+        apps\/server\/prisma\/schema\.prisma apps\/server\/prisma\/migrations/);
  assert.ok(deploy.indexOf("Refusing migration skip") < deploy.indexOf("Skipping prisma migrate deploy"));
  assert.match(deploy, /ECLIPSE_SKIP_DB_MIGRATION must be 0 or 1/);
});

test("failed deployments preserve the last successful release SHA for the next migration gate", () => {
  const previousRead = deploy.indexOf('fs.readFileSync("release.json", "utf8")');
  const migration = deploy.indexOf("npx prisma migrate deploy");
  const smoke = deploy.indexOf('SMOKE_EXPECTED_VERSION="$EXPECTED_VERSION"');
  const metadataWrite = deploy.indexOf('cat > "$RELEASE_METADATA_NEXT"');
  const metadataCommit = deploy.indexOf('mv -f -- "$RELEASE_METADATA_NEXT" "$DEPLOY_PATH/release.json"');
  const activationCommitted = deploy.indexOf("BUILD_ACTIVATED=0", metadataCommit);
  assert.ok(previousRead >= 0 && previousRead < migration);
  assert.ok(migration < smoke && smoke < metadataWrite);
  assert.ok(metadataWrite < metadataCommit && metadataCommit < activationCommitted);
  assert.match(deploy, /trap finish_deploy EXIT/);
  assert.match(deploy, /rm -f -- "\$RELEASE_METADATA_NEXT"/);
  assert.equal((deploy.match(/> "\$RELEASE_METADATA_NEXT"/g) ?? []).length, 1);
});

test("release enables signed LiveKit ACL webhooks transactionally", () => {
  const webhookUrl = "https://app.star-crm.ru/eclipse-chat/api/webhooks/livekit";
  const webhookActivation = deploy.indexOf("configure and verify signed LiveKit webhooks");
  const signedSmoke = deploy.indexOf('const response = await fetch("' + webhookUrl);
  const metadataCommit = deploy.indexOf('mv -f -- "$RELEASE_METADATA_NEXT" "$DEPLOY_PATH/release.json"');
  assert.match(livekitExample, /webhook:\n  api_key: APIxxxxxxxxxxxxxxxxx\n  urls:\n    - https:\/\/app\.star-crm\.ru\/eclipse-chat\/api\/webhooks\/livekit/);
  assert.match(deploy, /rollback_livekit_webhook/);
  assert.match(deploy, /LIVEKIT_CONFIG_CHANGED=1/);
  assert.match(deploy, /docker compose -f docker-compose\.livekit\.yml up -d --force-recreate livekit/);
  assert.match(deploy, /event: "participant_joined"/);
  assert.match(deploy, /sha256: createHash\("sha256"\)\.update\(body\)\.digest\("base64"\)/);
  assert.match(deploy, /response\.status !== 200 \|\| \(await response\.json\(\)\)\.action !== "removed"/);
  assert.ok(webhookActivation >= 0 && webhookActivation < signedSmoke);
  assert.ok(signedSmoke < metadataCommit);
  assert.ok(deploy.indexOf('rollback_livekit_webhook "$exit_code"') < deploy.indexOf('rollback_activated_build "$exit_code"'));
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
