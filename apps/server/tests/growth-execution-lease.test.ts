import { createHash } from "node:crypto";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDb = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  member: { findUnique: vi.fn() },
  growthRun: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  officeEventOutbox: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const budgetMocks = vi.hoisted(() => ({
  consumeGrowthBudgetOnceWithClient: vi.fn(),
  getGrowthBudget: vi.fn(),
}));

const hubMocks = vi.hoisted(() => ({
  executeGrowthHubStep: vi.fn(),
}));

vi.mock("../src/db.js", () => ({ db: routeDb }));
vi.mock("../src/auth/requireJwt.js", () => ({
  requireJwt: async () => undefined,
  getUserId: () => "user-1",
}));
vi.mock("../src/lib/serverGating.js", () => ({ ensureServerActive: async () => true }));
vi.mock("../src/security/audit.js", () => ({ recordAudit: vi.fn() }));
vi.mock("../src/lib/growthBudget.js", () => budgetMocks);
vi.mock("../src/ai/growthHub.js", () => ({
  GrowthHubError: class GrowthHubError extends Error {},
  getGrowthHubPolicy: () => ({ configured: true, model: "test-model", dailyRequestLimit: 25 }),
  executeGrowthHubStep: hubMocks.executeGrowthHubStep,
}));

import { createGrowthRunPayload } from "../src/lib/growthRunContract.js";
import { registerGrowthRunRoutes } from "../src/routes/growthRuns.js";

const input = {
  releaseName: "Distributed lease release",
  releaseSummary: "A concurrency regression fixture for the Growth execution provider boundary.",
  audience: "Eclipse operators",
  channel: "blog" as const,
  sourceUrls: ["https://eclipse-forge.ru/"],
  evidenceNotes: "The test proves only one replica can cross the paid provider boundary.",
};

function initialRow() {
  const run = createGrowthRunPayload(input, "chat:lease-source", {
    provider: "eclipse-ai-hub",
    model: "test-model",
  });
  return {
    id: "growth-run-lease",
    sourceRunId: run.id,
    serverId: "server-a",
    schemaVersion: run.schemaVersion,
    payload: JSON.stringify(run),
    payloadHash: "a".repeat(64),
    idempotencyKey: "growth:create-lease",
    lastExecutionKey: null,
    lastExecutedStep: null,
    executionLeaseId: null,
    executionLeaseUserId: null,
    executionLeaseStep: null,
    executionLeaseUntil: null,
    executionCancelRequestedAt: null,
    reviewStatus: "PENDING",
    reviewNote: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewedBy: null,
    importedByUserId: "user-1",
    importedBy: { id: "user-1", displayName: "Operator", avatar: null },
    version: 1,
    createdAt: new Date("2026-08-23T12:00:00.000Z"),
    updatedAt: new Date("2026-08-23T12:00:00.000Z"),
  };
}

async function createApp() {
  const app = Fastify({ logger: false });
  registerGrowthRunRoutes(app);
  await app.ready();
  return app;
}

describe("Growth distributed execution lease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeDb.member.findUnique.mockResolvedValue({ role: "OWNER" });
    routeDb.$transaction.mockImplementation(async (callback) => callback(routeDb));
    routeDb.$queryRaw.mockResolvedValue([{ now: new Date("2026-08-23T12:00:00.000Z") }]);
    routeDb.officeEventOutbox.create.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    routeDb.officeEventOutbox.findMany.mockResolvedValue([]);
    routeDb.officeEventOutbox.updateMany.mockResolvedValue({ count: 1 });
    budgetMocks.consumeGrowthBudgetOnceWithClient.mockResolvedValue({
      day: "2026-08-23",
      limit: 25,
      used: 1,
      remaining: 24,
    });
    budgetMocks.getGrowthBudget.mockResolvedValue({
      day: "2026-08-23",
      limit: 25,
      used: 0,
      remaining: 25,
    });
  });

  it("permits only one replica to consume budget and call the provider", async () => {
    let current = initialRow();
    let leased = false;
    let finishProvider!: (value: {
      schemaVersion: "growth.execute.result.v1";
      step: "research";
      role: "Researcher";
      content: string;
      provider: "eclipse-ai-hub";
      model: string;
      usage: { promptTokens: number; completionTokens: number };
    }) => void;
    const providerGate = new Promise<Parameters<typeof finishProvider>[0]>((resolve) => {
      finishProvider = resolve;
    });

    routeDb.growthRun.findFirst.mockImplementation(async () => current);
    routeDb.growthRun.updateMany.mockImplementation(async (args) => {
      if (typeof args.data.executionLeaseId === "string") {
        if (leased) return { count: 0 };
        leased = true;
        current = {
          ...current,
          executionLeaseId: args.data.executionLeaseId,
          executionLeaseUserId: args.data.executionLeaseUserId,
          executionLeaseStep: args.data.executionLeaseStep,
          executionLeaseUntil: args.data.executionLeaseUntil,
          executionCancelRequestedAt: null,
        };
        return { count: 1 };
      }
      if (args.data.lastExecutionKey) {
        if (!leased || args.where.executionLeaseId !== current.executionLeaseId) return { count: 0 };
        leased = false;
        current = {
          ...current,
          payload: args.data.payload,
          payloadHash: args.data.payloadHash,
          lastExecutionKey: args.data.lastExecutionKey,
          lastExecutedStep: args.data.lastExecutedStep,
          executionLeaseId: null,
          executionLeaseUserId: null,
          executionLeaseStep: null,
          executionLeaseUntil: null,
          executionCancelRequestedAt: null,
          version: current.version + 1,
        };
        return { count: 1 };
      }
      if (args.data.executionLeaseUntil instanceof Date && args.where.executionLeaseId) {
        return { count: leased ? 1 : 0 };
      }
      if (args.data.executionLeaseId === null && args.where.executionLeaseId) {
        if (current.executionLeaseId !== args.where.executionLeaseId) return { count: 0 };
        leased = false;
        return { count: 1 };
      }
      return { count: 0 };
    });
    hubMocks.executeGrowthHubStep.mockImplementation(async () => providerGate);

    const app = await createApp();
    const first = app.inject({
      method: "POST",
      url: "/api/servers/server-a/growth-runs/growth-run-lease/steps",
      headers: { "idempotency-key": "growth:execute-lease" },
      payload: { version: 1 },
    });
    await vi.waitFor(() => expect(hubMocks.executeGrowthHubStep).toHaveBeenCalledTimes(1));
    const expectedExecutionId = createHash("sha256")
      .update(JSON.stringify(["growth-run-lease", "research", 1]))
      .digest("hex");
    expect(budgetMocks.consumeGrowthBudgetOnceWithClient).toHaveBeenCalledWith(
      routeDb,
      "user-1",
      25,
      expectedExecutionId,
      expect.any(Date),
    );
    expect(hubMocks.executeGrowthHubStep).toHaveBeenCalledWith(
      expect.anything(),
      "research",
      expect.objectContaining({ requestId: expectedExecutionId }),
    );

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/growth-runs/growth-run-lease/steps",
      headers: { "idempotency-key": "growth:execute-other" },
      payload: { version: 1 },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(budgetMocks.consumeGrowthBudgetOnceWithClient).toHaveBeenCalledTimes(1);
    expect(hubMocks.executeGrowthHubStep).toHaveBeenCalledTimes(1);

    finishProvider({
      schemaVersion: "growth.execute.result.v1",
      step: "research",
      role: "Researcher",
      content: JSON.stringify({
        schemaVersion: "growth.research.v1",
        findings: ["The database lease prevents duplicate paid work across server replicas."],
      }),
      provider: "eclipse-ai-hub",
      model: "test-model",
      usage: { promptTokens: 100, completionTokens: 20 },
    });
    const completed = await first;
    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toMatchObject({ idempotent: false, budget: { remaining: 24 } });
    expect(routeDb.officeEventOutbox.create).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it("persists cross-replica cancellation and its Office event in one transaction", async () => {
    const activeRow = {
      ...initialRow(),
      executionLeaseId: "lease-on-replica-b",
      executionLeaseUserId: "user-2",
      executionLeaseStep: "research",
      executionLeaseUntil: new Date(Date.now() + 60_000),
      executionCancelRequestedAt: null,
    };
    routeDb.growthRun.findFirst.mockResolvedValue(activeRow);
    routeDb.growthRun.updateMany.mockResolvedValue({ count: 1 });

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/growth-runs/growth-run-lease/cancel",
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ cancelled: true, idempotent: false });
    expect(routeDb.growthRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "growth-run-lease",
        serverId: "server-a",
        executionLeaseId: "lease-on-replica-b",
      }),
      data: { executionCancelRequestedAt: expect.any(Date) },
    }));
    expect(routeDb.officeEventOutbox.create).toHaveBeenCalledTimes(1);
    expect(routeDb.$transaction).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("does not charge budget when cancellation wins before the provider boundary", async () => {
    const current = initialRow();
    routeDb.growthRun.findFirst.mockResolvedValue(current);
    routeDb.growthRun.updateMany.mockImplementation(async (args) => {
      if (typeof args.data.executionLeaseId === "string") return { count: 1 };
      if (args.data.executionLeaseUntil instanceof Date && args.where.executionLeaseId) return { count: 0 };
      return { count: 1 };
    });

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/growth-runs/growth-run-lease/steps",
      headers: { "idempotency-key": "growth:cancel-wins" },
      payload: { version: 1 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "Запуск был отменён до обращения к AI Hub" });
    expect(budgetMocks.consumeGrowthBudgetOnceWithClient).not.toHaveBeenCalled();
    expect(hubMocks.executeGrowthHubStep).not.toHaveBeenCalled();
    expect(routeDb.officeEventOutbox.create).not.toHaveBeenCalled();
    await app.close();
  });
});