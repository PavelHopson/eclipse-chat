import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDb = vi.hoisted(() => ({
  $transaction: vi.fn(),
  member: { findUnique: vi.fn() },
  growthRun: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../src/db.js", () => ({ db: routeDb }));
vi.mock("../src/auth/requireJwt.js", () => ({
  requireJwt: async () => undefined,
  getUserId: () => "user-1",
}));
vi.mock("../src/lib/serverGating.js", () => ({ ensureServerActive: async () => true }));
vi.mock("../src/security/audit.js", () => ({ recordAudit: vi.fn() }));
vi.mock("../src/lib/growthBudget.js", () => ({
  getGrowthBudget: vi.fn(async () => ({ day: "2026-08-13", limit: 25, used: 0, remaining: 25 })),
  consumeGrowthBudgetOnce: vi.fn(async () => ({ day: "2026-08-13", limit: 25, used: 1, remaining: 24, charged: true, idempotent: false })),
}));
vi.mock("../src/ai/growthHub.js", () => ({
  GrowthHubError: class GrowthHubError extends Error {},
  getGrowthHubPolicy: () => ({ configured: false, model: "disabled", dailyRequestLimit: 25 }),
  executeGrowthHubStep: vi.fn(),
}));

import {
  appendGrowthArtifact,
  createGrowthRunPayload,
  GROWTH_STEP_DEFINITIONS,
} from "../src/lib/growthRunContract.js";
import { registerGrowthRunRoutes } from "../src/routes/growthRuns.js";

function readyPayload() {
  let run = createGrowthRunPayload({
    releaseName: "Growth security proof",
    releaseSummary: "A bounded internal run used only for negative route verification.",
    audience: "Eclipse Forge operators",
    channel: "blog",
    sourceUrls: ["https://eclipse-forge.ru/"],
    evidenceNotes: "The fixture proves authorization behavior, not a market or revenue claim.",
  }, "chat:security-proof", { provider: "eclipse-ai-hub", model: "disabled" });
  for (const step of GROWTH_STEP_DEFINITIONS) {
    run = appendGrowthArtifact(run, {
      step: step.step,
      role: step.role,
      content: JSON.stringify({
        schemaVersion: `growth.${step.step}.v1`,
        content: "A bounded typed artifact used only to reach the human review boundary.",
      }),
      provider: "eclipse-ai-hub",
      model: "disabled",
    });
  }
  return run;
}

async function createApp() {
  const app = Fastify();
  registerGrowthRunRoutes(app);
  await app.ready();
  return app;
}

describe("Growth route negative authorization boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeDb.$transaction.mockImplementation(async (callback) => callback(routeDb));
  });

  it("denies non-members and scopes mutation lookups to the requested workspace", async () => {
    const app = await createApp();
    routeDb.member.findUnique.mockResolvedValueOnce(null);
    const denied = await app.inject({ method: "GET", url: "/api/servers/server-a/growth-runs" });
    expect(denied.statusCode).toBe(403);

    routeDb.member.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    routeDb.growthRun.findFirst.mockResolvedValueOnce(null);
    const crossWorkspace = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/growth-runs/run-from-server-b/steps",
      headers: { "idempotency-key": "growth:cross-workspace" },
      payload: { version: 1 },
    });
    expect(crossWorkspace.statusCode).toBe(404);
    expect(routeDb.growthRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-from-server-b", serverId: "server-a" },
    }));
    await app.close();
  });

  it("requires approval permission, human confirmation and the current version", async () => {
    const app = await createApp();
    routeDb.member.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    const noPermission = await app.inject({
      method: "PATCH",
      url: "/api/servers/server-a/growth-runs/run-1/review",
      payload: { version: 1, decision: "APPROVE", humanConfirmed: true },
    });
    expect(noPermission.statusCode).toBe(403);

    routeDb.member.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    const noConfirmation = await app.inject({
      method: "PATCH",
      url: "/api/servers/server-a/growth-runs/run-1/review",
      payload: { version: 1, decision: "APPROVE" },
    });
    expect(noConfirmation.statusCode).toBe(400);
    expect(routeDb.growthRun.updateMany).not.toHaveBeenCalled();

    const current = {
      id: "run-1",
      serverId: "server-a",
      version: 2,
      reviewStatus: "PENDING",
      payload: JSON.stringify(readyPayload()),
    };
    routeDb.member.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    routeDb.growthRun.findFirst.mockResolvedValueOnce(current).mockResolvedValueOnce(current);
    routeDb.growthRun.updateMany.mockResolvedValueOnce({ count: 0 });
    const stale = await app.inject({
      method: "PATCH",
      url: "/api/servers/server-a/growth-runs/run-1/review",
      payload: { version: 1, decision: "APPROVE", humanConfirmed: true },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ currentVersion: 2, currentStatus: "PENDING" });
    expect(routeDb.growthRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "run-1", serverId: "server-a", version: 1, reviewStatus: "PENDING" }),
    }));
    await app.close();
  });
});
