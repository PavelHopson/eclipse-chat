import { afterEach, describe, expect, it } from "vitest";
import {
  buildAiRouteDiagnostics,
  getAiProviderHealth,
  parseSensitiveProviderAllowlist,
  rankAiProviderCandidates,
  recordAiProviderFailure,
  recordAiProviderSuccess,
  resetAiProviderHealth,
  type AiProviderCandidate,
} from "../src/ai/routing.js";

const candidates: AiProviderCandidate[] = [
  { name: "ollama", kind: "local", legacyPriority: 1 },
  { name: "eclipse-ai-hub", kind: "gateway", legacyPriority: 2 },
  { name: "omniroute", kind: "gateway", legacyPriority: 3 },
  { name: "groq", kind: "cloud", legacyPriority: 4 },
  { name: "pollinations", kind: "keyless", legacyPriority: 5 },
];

afterEach(() => {
  resetAiProviderHealth();
});

describe("task-based AI routing", () => {
  it("keeps sensitive workspace data on local or controlled providers", () => {
    const ranked = rankAiProviderCandidates(candidates, {
      task: "conversation",
      objective: "balanced",
      sensitivity: "sensitive",
    });

    expect(ranked.map((provider) => provider.name)).toEqual([
      "eclipse-ai-hub",
      "omniroute",
      "ollama",
    ]);
  });

  it("allows an external provider only through the explicit sensitive allowlist", () => {
    const ranked = rankAiProviderCandidates(
      [...candidates, { name: "openai", kind: "cloud", legacyPriority: 6 }],
      { task: "code", objective: "quality", sensitivity: "sensitive" },
      { sensitiveAllowlist: parseSensitiveProviderAllowlist(" OPENAI ") },
    );

    expect(ranked.some((provider) => provider.name === "openai")).toBe(true);
    expect(ranked.some((provider) => provider.name === "groq")).toBe(false);
  });

  it("never sends sensitive data to a public provider, even when allowlisted", () => {
    const ranked = rankAiProviderCandidates(
      candidates,
      { task: "conversation", objective: "speed", sensitivity: "sensitive" },
      { sensitiveAllowlist: parseSensitiveProviderAllowlist("pollinations") },
    );

    expect(ranked.some((provider) => provider.name === "pollinations")).toBe(false);
  });

  it("selects the local economical route for sensitive summaries", () => {
    const ranked = rankAiProviderCandidates(candidates, {
      task: "summarization",
      objective: "economy",
      sensitivity: "sensitive",
    });

    expect(ranked[0]?.name).toBe("ollama");
  });

  it("moves a repeatedly failing provider behind healthy fallbacks", () => {
    recordAiProviderFailure("eclipse-ai-hub", 1_000);
    recordAiProviderFailure("eclipse-ai-hub", 2_000);

    const ranked = rankAiProviderCandidates(candidates, {
      task: "structured_extract",
      objective: "quality",
      sensitivity: "sensitive",
    }, { now: 2_001 });

    expect(getAiProviderHealth("eclipse-ai-hub", 2_001).state).toBe("cooldown");
    expect(ranked[0]?.name).toBe("omniroute");
    expect(ranked.at(-1)?.name).toBe("eclipse-ai-hub");
  });

  it("keeps only aggregate latency in health diagnostics", () => {
    recordAiProviderSuccess("omniroute", 120, 1_000);
    recordAiProviderSuccess("omniroute", 220, 2_000);

    expect(getAiProviderHealth("omniroute", 2_001)).toEqual({
      state: "healthy",
      consecutiveFailures: 0,
      averageLatencyMs: 150,
      cooldownRemainingMs: 0,
    });
  });

  it("reports sensitive routes as unavailable when only a public provider exists", () => {
    const routes = buildAiRouteDiagnostics([
      { name: "pollinations", kind: "keyless", legacyPriority: 1 },
    ]);

    expect(routes.find((route) => route.task === "conversation")).toMatchObject({
      status: "unavailable",
      primary: null,
      fallbacks: [],
      reason: "privacy_first",
    });
    expect(routes.find((route) => route.task === "code")).toMatchObject({
      status: "ready",
      primary: "pollinations",
    });
  });
});
