import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

let insideTransaction = false;

const routeDb = vi.hoisted(() => ({
  $transaction: vi.fn(),
  member: { findUnique: vi.fn() },
  growthRun: {
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  officeEventOutbox: {
    create: vi.fn(),
    findMany: vi.fn(),
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
vi.mock("../src/ai/growthHub.js", () => ({
  GrowthHubError: class GrowthHubError extends Error {},
  getGrowthHubPolicy: () => ({ configured: false, model: "disabled", dailyRequestLimit: 25 }),
  executeGrowthHubStep: vi.fn(),
}));

import { createGrowthRunPayload } from "../src/lib/growthRunContract.js";
import { registerGrowthRunRoutes } from "../src/routes/growthRuns.js";

const input = {
  releaseName: "Atomic Growth release",
  releaseSummary: "A transaction-bound Growth run with a durable Office projection.",
  audience: "Eclipse operators",
  channel: "blog" as const,
  sourceUrls: ["https://eclipse-forge.ru/"],
  evidenceNotes: "This fixture verifies the database transaction boundary only.",
};

function createdRow() {
  const run = createGrowthRunPayload(input, "chat:source-1", {
    provider: "eclipse-ai-hub",
    model: "disabled",
  });
  return {
    id: "growth-row-1",
    sourceRunId: run.id,
    serverId: "server-a",
    schemaVersion: run.schemaVersion,
    payload: JSON.stringify(run),
    payloadHash: "a".repeat(64),
    idempotencyKey: "growth:atomic-create",
    lastExecutionKey: null,
    lastExecutedStep: null,
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

describe("Growth transactional Office outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insideTransaction = false;
    routeDb.member.findUnique.mockResolvedValue({ role: "OWNER" });
    routeDb.growthRun.findUnique.mockResolvedValue(null);
    routeDb.growthRun.count.mockResolvedValue(0);
    routeDb.growthRun.create.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return createdRow();
    });
    routeDb.officeEventOutbox.create.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { id: "11111111-1111-4111-8111-111111111111" };
    });
    routeDb.officeEventOutbox.findMany.mockResolvedValue([]);
    routeDb.officeEventOutbox.updateMany.mockResolvedValue({ count: 1 });
    routeDb.$transaction.mockImplementation(async (callback) => {
      insideTransaction = true;
      try {
        return await callback(routeDb);
      } finally {
        insideTransaction = false;
      }
    });
  });

  it("commits the Growth row and Office projection through the same transaction client", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/growth-runs",
      headers: { "idempotency-key": "growth:atomic-create" },
      payload: { input },
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(routeDb.$transaction).toHaveBeenCalledTimes(1);
    expect(routeDb.growthRun.create).toHaveBeenCalledTimes(1);
    expect(routeDb.officeEventOutbox.create).toHaveBeenCalledTimes(1);
    const outboxData = routeDb.officeEventOutbox.create.mock.calls[0]?.[0]?.data;
    expect(outboxData).toMatchObject({
      serverId: "server-a",
      producerId: "growth-command-room",
    });
    expect(outboxData.requestDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(outboxData.payload).not.toMatch(/secret|token|password|credential/i);
  });
});