import { describe, expect, it, vi } from "vitest";
import {
  getAiGatewayTelemetryDiagnostic,
  sanitizeAiGatewayTelemetry,
} from "../src/ai/gatewayTelemetry.js";

function telemetryPayload() {
  const window = {
    requests: 12,
    successes: 11,
    clientErrors: 0,
    serviceErrors: 1,
    availabilityPercent: 91.667,
    averageLatencyMs: 420,
    p95LatencyMs: 1_000,
    maxLatencyMs: 900,
    costUsd: 0.0042,
    promptTokens: 800,
    completionTokens: 200,
    topErrors: [{ code: "upstream_timeout", count: 1 }],
    slo: { status: "breached", availabilityMet: false, latencyMet: true },
  };
  return {
    generatedAt: "2026-07-30T12:30:00.000Z",
    retentionHours: 168,
    persistence: "file",
    privacy: { aggregation: "hourly", contentStored: false, identifiersStored: false },
    targets: { availabilityPercent: 99, p95LatencyMs: 15_000 },
    windows: { "1h": window, "24h": window, "7d": window },
    prompt: "must-not-pass-through",
    serviceToken: "must-not-pass-through",
  };
}

describe("AI gateway telemetry diagnostics", () => {
  it("keeps only the bounded aggregate contract", () => {
    const sanitized = sanitizeAiGatewayTelemetry(telemetryPayload());
    expect(sanitized).toMatchObject({
      state: "ready",
      persistence: "file",
      targets: { availabilityPercent: 99, p95LatencyMs: 15_000 },
      windows: {
        "24h": {
          requests: 12,
          availabilityPercent: 91.667,
          p95LatencyMs: 1_000,
          slo: { status: "breached" },
        },
      },
    });
    expect(JSON.stringify(sanitized)).not.toMatch(/must-not-pass-through|"prompt":|serviceToken/);
    expect(sanitizeAiGatewayTelemetry({
      ...telemetryPayload(),
      privacy: { aggregation: "hourly", contentStored: true, identifiersStored: false },
    })).toBeNull();
  });

  it("uses service auth server-side and returns a generic unavailable state", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toEqual({ Authorization: "Bearer private-service-token" });
      return new Response(JSON.stringify(telemetryPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const result = await getAiGatewayTelemetryDiagnostic({
      fetchImpl: fetchImpl as typeof fetch,
      env: {
        ECLIPSE_AI_HUB_BASE_URL: "http://127.0.0.1:8810/v1",
        ECLIPSE_AI_HUB_SERVICE_TOKEN: "private-service-token",
      },
    });
    expect(result.state).toBe("ready");

    const unavailable = await getAiGatewayTelemetryDiagnostic({
      fetchImpl: vi.fn(async () => new Response("private upstream error", { status: 500 })) as typeof fetch,
      env: {
        ECLIPSE_AI_HUB_BASE_URL: "http://127.0.0.1:8810/v1",
        ECLIPSE_AI_HUB_SERVICE_TOKEN: "private-service-token",
      },
    });
    expect(unavailable).toEqual({ state: "unavailable" });
  });
});
