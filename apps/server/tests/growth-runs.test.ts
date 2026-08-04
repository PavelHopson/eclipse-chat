import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  parseGrowthIdempotencyKey,
  parseGrowthRunImport,
} from "../src/lib/growthRunContract.js";
import { registerGrowthRunRoutes } from "../src/routes/growthRuns.js";

function validRun() {
  const at = "2026-08-04T10:00:00.000Z";
  return {
    schemaVersion: "growth.run.v1",
    id: "run:growth-release-1",
    status: "approved",
    createdAt: at,
    updatedAt: at,
    input: {
      releaseName: "Eclipse Library release",
      releaseSummary: "Добавлен проверяемый каталог с понятными evidence-ссылками.",
      audience: "Команды, внедряющие AI-инструменты",
      channel: "telegram",
      sourceUrls: [
        "https://library.eclipse-forge.ru/#release",
        "https://library.eclipse-forge.ru/#release",
      ],
      evidenceNotes: "Production build прошёл, а источники проверены редактором.",
    },
    execution: {
      provider: "openai",
      model: "gpt-5",
      maxRequests: 5,
      completedRequests: 5,
      cost: "provider-dependent",
    },
    policy: {
      externalActions: false,
      publishAllowed: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
    },
    artifacts: [
      ["research", "Researcher"],
      ["strategy", "Strategist"],
      ["draft", "Writer"],
      ["claims", "Claim Auditor"],
      ["final", "Editor"],
    ].map(([step, role]) => ({
      step,
      role,
      content: `Проверенный результат шага ${step}, содержащий достаточно символов для review.`.padEnd(80, "."),
      createdAt: at,
    })),
    approval: { approvedAt: at, humanConfirmed: true },
  };
}

describe("growth.run.v1 import boundary", () => {
  it("normalizes safe links and removes the source approval claim", () => {
    const parsed = parseGrowthRunImport(validRun());

    expect(parsed.sourceApprovalClaimed).toBe(true);
    expect(parsed.run.status).toBe("ready_for_approval");
    expect(parsed.run.approval).toBeNull();
    expect(parsed.run.input.sourceUrls).toEqual(["https://library.eclipse-forge.ru/"]);
    expect(parsed.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects credentials, unknown secret fields and reordered roles", () => {
    const credentialUrl = validRun();
    credentialUrl.input.sourceUrls = ["https://user:pass@example.com/source"];
    expect(() => parseGrowthRunImport(credentialUrl)).toThrow(/HTTPS|ссылк/i);

    const withSecret = validRun() as ReturnType<typeof validRun> & { apiKey?: string };
    withSecret.apiKey = "must-not-enter-chat";
    expect(() => parseGrowthRunImport(withSecret)).toThrow(/Unrecognized key/i);

    const reordered = validRun();
    [reordered.artifacts[0], reordered.artifacts[1]] = [
      reordered.artifacts[1],
      reordered.artifacts[0],
    ];
    expect(() => parseGrowthRunImport(reordered)).toThrow(/Ожидается шаг/i);
  });

  it("accepts only bounded stable idempotency keys", () => {
    expect(parseGrowthIdempotencyKey("growth:run:release-1")).toBe("growth:run:release-1");
    expect(parseGrowthIdempotencyKey("short")).toBeNull();
    expect(parseGrowthIdempotencyKey("growth key with spaces")).toBeNull();
  });
});

describe("growth command room route security", () => {
  it("guards every endpoint and bounds imports and review mutations", () => {
    const app = Fastify();
    const routes = new Map<string, { guards: string[]; max?: number }>();
    app.addHook("onRoute", (route) => {
      if (!route.url.includes("growth-runs")) return;
      const guards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      routes.set(`${route.method}:${route.url}`, {
        guards: guards.map((guard) => guard.name),
        max: (route.config?.rateLimit as { max?: number } | undefined)?.max,
      });
    });

    registerGrowthRunRoutes(app);

    expect(routes.get("GET:/api/servers/:id/growth-runs")).toEqual({
      guards: ["requireJwt"],
      max: 60,
    });
    expect(routes.get("POST:/api/servers/:id/growth-runs/import")).toEqual({
      guards: ["requireJwt"],
      max: 10,
    });
    expect(routes.get("PATCH:/api/servers/:id/growth-runs/:runId/review")).toEqual({
      guards: ["requireJwt"],
      max: 30,
    });
  });
});
