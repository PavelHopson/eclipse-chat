import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const gatewaySync = readFileSync(
  fileURLToPath(new URL("../../../deploy/scripts/sync-ai-gateway.sh", import.meta.url)),
  "utf8",
);
const deployOrchestrator = readFileSync(
  fileURLToPath(new URL("../../../deploy/scripts/deploy.sh", import.meta.url)),
  "utf8",
);
const canaryScript = readFileSync(
  fileURLToPath(new URL("../../../deploy/scripts/set-ai-canary.sh", import.meta.url)),
  "utf8",
);
const rotationScript = readFileSync(
  fileURLToPath(new URL("../../../deploy/scripts/rotate-ai-gateway-token.sh", import.meta.url)),
  "utf8",
);

describe("AI gateway production deployment", () => {
  it("pins the upstream repository and protects generated credentials", () => {
    expect(gatewaySync).toMatch(/AI_HUB_COMMIT="[0-9a-f]{40}"/);
    expect(gatewaySync).toContain("checkout --quiet --detach --force");
    expect(gatewaySync).toContain("install -o root -g www-data -m 0640");
    expect(gatewaySync).toContain('AI_GATEWAY_SERVICE_CLIENTS');
    expect(gatewaySync).toContain('CLIENT_ID="eclipse-chat"');
    expect(gatewaySync).toContain('CLIENT_SCOPES="models:read,telemetry:read,chat:write"');
    expect(gatewaySync).toContain('CLIENT_ID="eclipse-chat-growth"');
    expect(gatewaySync).toContain('CLIENT_SCOPES="growth:execute"');
    expect(gatewaySync).toContain('ECLIPSE_GROWTH_HUB_SERVICE_TOKEN');
    expect(gatewaySync).toContain('curl --config "$GROWTH_CURL_CONFIG"');
    expect(gatewaySync).not.toContain('--header "Authorization: Bearer $GROWTH_SERVICE_TOKEN"');
    expect(gatewaySync).toContain("primary-token-if-present");
    expect(gatewaySync).toContain('read_exported_env_value "AI_GATEWAY_SERVICE_CLIENTS"');
    expect(gatewaySync).not.toContain('write_env_line "AI_GATEWAY_SERVICE_TOKEN"');
    expect(gatewaySync).not.toContain("set -x");
  });

  it("routine Chat releases preserve gateway configuration without redeploying it", () => {
    expect(deployOrchestrator).not.toContain("CHAT_ENV_PREVIOUS=");
    expect(deployOrchestrator).not.toContain("sync-ai-gateway.sh");
    expect(deployOrchestrator).not.toMatch(/(?:cp|chown|chmod).*\$CHAT_ENV/u);
    expect(deployOrchestrator).toContain("trap rollback_activated_build EXIT");
  });

  it("supports a bounded canary rollback with deterministic provider smoke", () => {
    expect(canaryScript).toContain('^(0|10|25|50|100)$');
    expect(canaryScript).toContain('AI_SMOKE_EXPECT_PROVIDER=omniroute');
    expect(canaryScript).toContain('AI_SMOKE_EXPECT_PROVIDER=eclipse-ai-hub');
    expect(canaryScript).toContain('cp -p -- "$CHAT_ENV_PREVIOUS" "$CHAT_ENV"');
    expect(canaryScript).not.toContain("set -x");
  });

  it("rotates only the Chat client through a dual-token grace window with rollback", () => {
    expect(rotationScript).toContain('AI_GATEWAY_SERVICE_CLIENTS');
    expect(rotationScript).toContain('CLIENT_ID="eclipse-chat"');
    expect(rotationScript).toContain('CLIENT_TOKENS="$NEW_TOKEN,$OLD_GATEWAY_TOKEN"');
    expect(rotationScript).toContain('CLIENT_TOKENS="$NEW_TOKEN"');
    expect(rotationScript).toContain('CLIENT_SCOPES="models:read,telemetry:read,chat:write"');
    expect(rotationScript).toContain('read_exported_env_value "AI_GATEWAY_SERVICE_CLIENTS"');
    expect(rotationScript).toContain('OLD_TOKEN_STATUS=');
    expect(rotationScript).toContain('OLD_TOKEN_STATUS" != "401"');
    expect(rotationScript).toContain('cp -p -- "$GATEWAY_BACKUP" "$GATEWAY_ENV"');
    expect(rotationScript).toContain('cp -p -- "$CHAT_BACKUP" "$CHAT_ENV"');
    expect(rotationScript).toContain('AI_SMOKE_EXPECT_PROVIDER=eclipse-ai-hub');
    expect(rotationScript).not.toContain("set -x");
    expect(rotationScript).not.toMatch(/echo.*NEW_TOKEN/);
  });
});
