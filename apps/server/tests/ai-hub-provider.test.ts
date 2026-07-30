import { afterEach, describe, expect, it } from "vitest";
import { isAiHubCanaryRequest, listAiProviderDiagnostics } from "../src/ai/provider.js";

const ENV_KEYS = [
  "ECLIPSE_AI_HUB_BASE_URL",
  "ECLIPSE_AI_HUB_SERVICE_TOKEN",
  "ECLIPSE_AI_HUB_MODEL",
  "ECLIPSE_AI_HUB_MODELS",
  "ECLIPSE_AI_HUB_CANARY_PERCENT",
  "POLLINATIONS_DISABLED",
] as const;

const original = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Eclipse AI Hub provider", () => {
  it("is opt-in and exposes only sanitized diagnostics", () => {
    process.env.POLLINATIONS_DISABLED = "1";
    process.env.ECLIPSE_AI_HUB_BASE_URL = "http://127.0.0.1:8810/v1";
    process.env.ECLIPSE_AI_HUB_SERVICE_TOKEN = "a-secret-value-that-must-not-appear-in-diagnostics";
    process.env.ECLIPSE_AI_HUB_MODELS = "auto/best-chat,fast-chat";
    process.env.ECLIPSE_AI_HUB_CANARY_PERCENT = "10";

    const diagnostic = listAiProviderDiagnostics().find(
      (provider) => provider.name === "eclipse-ai-hub",
    );
    expect(diagnostic).toMatchObject({
      name: "eclipse-ai-hub",
      kind: "gateway",
      baseHost: "127.0.0.1:8810",
      hasAuth: true,
      modelCount: 2,
      models: ["auto/best-chat", "fast-chat"],
      trafficPercent: 10,
    });
    expect(JSON.stringify(listAiProviderDiagnostics())).not.toContain(
      process.env.ECLIPSE_AI_HUB_SERVICE_TOKEN,
    );
  });

  it("does not enable a partial or insecure remote configuration", () => {
    process.env.POLLINATIONS_DISABLED = "1";
    process.env.ECLIPSE_AI_HUB_BASE_URL = "http://gateway.example.com/v1";
    process.env.ECLIPSE_AI_HUB_SERVICE_TOKEN = "a-secret-value-that-must-not-travel-over-http";
    process.env.ECLIPSE_AI_HUB_CANARY_PERCENT = "100";
    expect(listAiProviderDiagnostics().some((provider) => provider.name === "eclipse-ai-hub")).toBe(false);

    process.env.ECLIPSE_AI_HUB_BASE_URL = "https://gateway.example.com/v1";
    delete process.env.ECLIPSE_AI_HUB_SERVICE_TOKEN;
    expect(listAiProviderDiagnostics().some((provider) => provider.name === "eclipse-ai-hub")).toBe(false);
  });

  it("uses an explicit bounded percentage for request-level canary routing", () => {
    expect(isAiHubCanaryRequest(undefined, 0)).toBe(false);
    expect(isAiHubCanaryRequest("invalid", 0)).toBe(false);
    expect(isAiHubCanaryRequest("0", 0)).toBe(false);
    expect(isAiHubCanaryRequest("10", 0.099)).toBe(true);
    expect(isAiHubCanaryRequest("10", 0.1)).toBe(false);
    expect(isAiHubCanaryRequest("100", 0.999)).toBe(true);
    expect(isAiHubCanaryRequest("101", 0)).toBe(false);
  });
});
