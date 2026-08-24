import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCreativeJob, serializeCreativeJob } from "../src/lib/creativeJobContract.js";

const routeDb = vi.hoisted(() => ({
  member: { findUnique: vi.fn() },
  creativeJob: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../src/db.js", () => ({ db: routeDb }));
vi.mock("../src/auth/requireJwt.js", () => ({
  requireJwt: async () => undefined,
  getUserId: () => "user-1",
}));
vi.mock("../src/lib/permissions.js", () => ({ hasPermission: () => true }));
vi.mock("../src/lib/serverGating.js", () => ({ ensureServerActive: async () => true }));
vi.mock("../src/security/audit.js", () => ({ recordAudit: vi.fn() }));
vi.mock("../src/office/outbox.js", () => ({
  dispatchOfficeEventOutboxBestEffort: vi.fn(),
  enqueueOfficeEventOutboxWithClient: vi.fn(),
}));

import { registerCreativeJobRoutes } from "../src/routes/creativeJobs.js";

const validInput = {
  title: "Вертикальный продуктовый ролик",
  objective: "Показать новую функцию в реальной ситуации и объяснить пользу без преувеличений.",
  mediaType: "video",
  aspectRatio: "9:16",
  durationSeconds: 10,
  outputCount: 1,
  styleNotes: "Спокойная камера, естественный свет и чистая композиция.",
  avoid: "Без текста и водяных знаков.",
  sourceUrls: ["https://example.com/product"],
  providerMode: "preview",
};

async function app() {
  const instance = Fastify();
  registerCreativeJobRoutes(instance);
  await instance.ready();
  return instance;
}

describe("Creative Studio authorization and execution boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeDb.creativeJob.findMany.mockResolvedValue([]);
    routeDb.creativeJob.count.mockResolvedValue(0);
    routeDb.creativeJob.findUnique.mockResolvedValue(null);
  });

  it("denies a non-member before reading tenant jobs", async () => {
    const instance = await app();
    routeDb.member.findUnique.mockResolvedValueOnce(null);
    const response = await instance.inject({ method: "GET", url: "/api/servers/server-a/creative-jobs" });
    expect(response.statusCode).toBe(403);
    expect(routeDb.creativeJob.findMany).not.toHaveBeenCalled();
    await instance.close();
  });

  it("rejects unsafe or mass-assigned input before any database mutation", async () => {
    const instance = await app();
    routeDb.member.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    const response = await instance.inject({
      method: "POST",
      url: "/api/servers/server-a/creative-jobs",
      headers: { "idempotency-key": "creative-create:11111111-1111-4111-8111-111111111111" },
      payload: {
        input: {
          ...validInput,
          sourceUrls: ["https://user:password@example.com/reference"],
          status: "ready",
        },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(routeDb.$transaction).not.toHaveBeenCalled();
    expect(routeDb.creativeJob.findUnique).not.toHaveBeenCalled();
    expect(response.body).not.toContain("password");
    await instance.close();
  });

  it("fails closed for a Higgsfield job without making an external or database call", async () => {
    const instance = await app();
    const job = createCreativeJob({ ...validInput, providerMode: "higgsfield" } as never);
    const stored = serializeCreativeJob(job);
    routeDb.member.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    routeDb.creativeJob.findFirst.mockResolvedValueOnce({
      id: "creative-a",
      sourceJobId: job.id,
      serverId: "server-a",
      createdByUserId: "user-1",
      schemaVersion: job.schemaVersion,
      ...stored,
      idempotencyKey: "creative-create:a",
      lastExecutionKey: null,
      status: job.status,
      version: 1,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
    });
    const response = await instance.inject({
      method: "POST",
      url: "/api/servers/server-a/creative-jobs/creative-a/execute",
      headers: { "idempotency-key": "creative-execute:creative-a:1" },
      payload: { version: 1 },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "higgsfield_not_configured" });
    expect(routeDb.$transaction).not.toHaveBeenCalled();
    await instance.close();
  });

  it("keeps tenant and ready predicates in the artifact lookup", async () => {
    const instance = await app();
    routeDb.member.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    routeDb.creativeJob.findFirst.mockResolvedValueOnce(null);
    const response = await instance.inject({ method: "GET", url: "/api/servers/server-a/creative-jobs/guessed-id/artifact" });
    expect(response.statusCode).toBe(404);
    expect(routeDb.creativeJob.findFirst).toHaveBeenCalledWith({
      where: { id: "guessed-id", serverId: "server-a", status: "ready" },
    });
    await instance.close();
  });
});
