import { afterEach, describe, expect, it } from "vitest";
import { listAiProviderDiagnostics, listAiRouteDiagnostics } from "./provider.js";

const KEYS = ["MOONSHOT_ENABLED", "MOONSHOT_API_KEY", "MOONSHOT_MODEL", "MOONSHOT_MODELS", "POLLINATIONS_DISABLED"] as const;
const previous = new Map<string, string | undefined>();

function setEnv(values: Record<(typeof KEYS)[number], string | undefined>): void {
  for (const key of KEYS) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
});

describe("Moonshot/Kimi provider", () => {
  it("stays disabled unless the explicit opt-in flag and key are both present", () => {
    setEnv({ MOONSHOT_ENABLED: undefined, MOONSHOT_API_KEY: "synthetic-test-key", MOONSHOT_MODEL: undefined, MOONSHOT_MODELS: undefined, POLLINATIONS_DISABLED: "1" });
    expect(listAiProviderDiagnostics().some((provider) => provider.name === "moonshot")).toBe(false);

    setEnv({ MOONSHOT_ENABLED: "1", MOONSHOT_API_KEY: undefined, MOONSHOT_MODEL: undefined, MOONSHOT_MODELS: undefined, POLLINATIONS_DISABLED: "1" });
    expect(listAiProviderDiagnostics().some((provider) => provider.name === "moonshot")).toBe(false);
  });

  it("exposes only sanitized diagnostics and preserves the configured model order", () => {
    setEnv({ MOONSHOT_ENABLED: "1", MOONSHOT_API_KEY: "synthetic-test-key", MOONSHOT_MODEL: undefined, MOONSHOT_MODELS: "kimi-k3.1-pro-highspeed,kimi-k3.1-pro", POLLINATIONS_DISABLED: "1" });
    const provider = listAiProviderDiagnostics().find((candidate) => candidate.name === "moonshot");
    expect(provider).toMatchObject({
      name: "moonshot",
      kind: "cloud",
      baseHost: "api.moonshot.ai",
      hasAuth: true,
      models: ["kimi-k3.1-pro-highspeed", "kimi-k3.1-pro"],
      dataPolicy: "external",
      costTier: "unknown",
    });
    expect(JSON.stringify(provider)).not.toContain("synthetic-test-key");

    const route = listAiRouteDiagnostics().find((candidate) => candidate.primary === "moonshot" || candidate.fallbacks.includes("moonshot"));
    expect(route).toBeDefined();
  });
});
