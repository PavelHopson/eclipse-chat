import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptPath = new URL("./sync-ai-gateway.sh", import.meta.url);
const deployPath = new URL("./deploy.sh", import.meta.url);

const readScript = async () => (await readFile(scriptPath, "utf8")).replaceAll("\r\n", "\n");

test("AI gateway deploy keeps pinned source, permissions and baseline smoke as hard gates", async () => {
  const script = await readScript();

  assert.match(script, /AI_HUB_COMMIT="[0-9a-f]{40}"/);
  assert.match(script, /rev-parse HEAD\)" != "\$AI_HUB_COMMIT"/);
  assert.match(script, /install -o root -g www-data -m 0640/);
  assert.match(
    script,
    /AI_GATEWAY_SMOKE_COMPLETION=0[\s\\]+node gateway\/scripts\/smoke\.mjs/,
  );
});

test("optional live completion failure forces the effective Chat canary to zero", async () => {
  const [script, deploy] = await Promise.all([
    readScript(),
    readFile(deployPath, "utf8"),
  ]);

  assert.match(script, /REQUIRE_LIVE_COMPLETION="\$\{AI_GATEWAY_REQUIRE_LIVE_COMPLETION:-0\}"/);
  assert.match(script, /if AI_GATEWAY_SMOKE_BASE_URL=[\s\S]*AI_GATEWAY_SMOKE_COMPLETION=1[\s\S]*node gateway\/scripts\/smoke\.mjs; then/);
  assert.match(script, /else\n  EFFECTIVE_CANARY_PERCENT=0/);
  assert.match(
    script,
    /upsert_env_value "ECLIPSE_AI_HUB_CANARY_PERCENT" "\$EFFECTIVE_CANARY_PERCENT"/,
  );
  assert.doesNotMatch(
    script,
    /upsert_env_value "ECLIPSE_AI_HUB_CANARY_PERCENT" "\$CANARY_PERCENT"/,
  );
  // Gateway provisioning remains available only as a separately scoped operation.
  assert.doesNotMatch(deploy, /bash .*sync-ai-gateway\.sh|node .*configure-office-ingest\.mjs/);
});

test("strict live completion mode is validated and remains fatal", async () => {
  const script = await readScript();

  assert.match(script, /\[\[ ! "\$REQUIRE_LIVE_COMPLETION" =~ \^\(0\|1\)\$ \]\]/);
  assert.match(script, /elif \[\[ "\$REQUIRE_LIVE_COMPLETION" == "1" \]\]; then\n  echo [^\n]+ >&2\n  exit 1/);
});

test("Growth scoped authorization remains a hard deploy gate", async () => {
  const script = await readScript();

  assert.match(script, /GROWTH_AUTH_STATUS="\$\(/);
  assert.match(script, /http:\/\/127\.0\.0\.1:8810\/v1\/growth\/execute/);
  assert.match(script, /if \[\[ "\$GROWTH_AUTH_STATUS" != "400" \]\]; then[\s\S]*exit 1\nfi/);
});

test("deploy status messages never interpolate gateway credentials", async () => {
  const script = await readScript();
  const logStatements = script
    .split("\n")
    .filter((line) => /\becho\b/.test(line))
    .join("\n");

  assert.doesNotMatch(
    logStatements,
    /\$(?:OMNIROUTE_API_KEY|SERVICE_TOKEN|GROWTH_SERVICE_TOKEN|SERVICE_CLIENTS)/,
  );
  assert.match(script, /umask 077/);
  assert.match(script, /} > "\$GROWTH_CURL_CONFIG"/);
  assert.match(script, /curl --config "\$GROWTH_CURL_CONFIG"/);
});
