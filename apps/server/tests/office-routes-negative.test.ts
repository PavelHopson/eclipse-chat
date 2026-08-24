import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDb = vi.hoisted(() => ({ member: { findUnique: vi.fn() } }));

vi.mock("../src/db.js", () => ({ db: routeDb }));
vi.mock("../src/security/audit.js", () => ({ recordAudit: vi.fn() }));
vi.mock("../src/auth/requireJwt.js", () => ({
  requireJwt: async () => undefined,
  getUserId: () => "user-1",
}));

import { registerOfficeRoutes } from "../src/routes/office.js";

const repository = {
  appendBatch: vi.fn(),
  list: vi.fn(),
  currentCursor: vi.fn(),
};
const status = vi.fn();
const redrive = vi.fn();

async function createApp() {
  const app = Fastify();
  registerOfficeRoutes(app, { repository, status, redrive });
  await app.ready();
  return app;
}

describe("Office Event API authorization boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.list.mockResolvedValue([]);
    repository.currentCursor.mockResolvedValue(12);
    redrive.mockResolvedValue(0);
    status.mockResolvedValue({
      schemaVersion: "office.status.v1",
      status: "ready",
      cursor: 12,
      outbox: { state: "idle", pending: 0, hasDeadLetters: false },
    });
  });

  it("denies non-members before reading the workspace stream", async () => {
    const app = await createApp();
    routeDb.member.findUnique.mockResolvedValueOnce(null);
    const response = await app.inject({ method: "GET", url: "/api/servers/server-a/office/events" });
    expect(response.statusCode).toBe(403);
    expect(repository.list).not.toHaveBeenCalled();
    await app.close();
  });

  it("protects status by membership and returns no configuration or credentials", async () => {
    const app = await createApp();
    routeDb.member.findUnique.mockResolvedValueOnce(null);
    const denied = await app.inject({ method: "GET", url: "/api/servers/server-a/office/status" });
    expect(denied.statusCode).toBe(403);
    expect(status).not.toHaveBeenCalled();

    routeDb.member.findUnique.mockResolvedValueOnce({ id: "member-a" });
    const allowed = await app.inject({ method: "GET", url: "/api/servers/server-a/office/status" });
    expect(allowed.statusCode).toBe(200);
    expect(status).toHaveBeenCalledWith("server-a");
    expect(allowed.json()).toEqual({
      schemaVersion: "office.status.v1",
      status: "ready",
      cursor: 12,
      outbox: { state: "idle", pending: 0, hasDeadLetters: false },
    });
    expect(JSON.stringify(allowed.json())).not.toMatch(/secret|token|keyId|database|dsn|host/i);
    await app.close();
  });

  it("returns only the requested member workspace and supports a bounded cursor", async () => {
    const app = await createApp();
    repository.list.mockResolvedValueOnce([{
      schemaVersion: "office.event.v1",
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "server-a",
      sequence: 1,
      occurredAt: "2026-08-23T12:00:00.000Z",
      type: "task.created",
      subject: { kind: "task", id: "a-1" },
      summary: "Alpha task",
      metadata: {},
    }]);
    routeDb.member.findUnique.mockResolvedValueOnce({ id: "member-a" });
    const response = await app.inject({ method: "GET", url: "/api/servers/server-a/office/events?after=0&limit=10" });
    expect(response.statusCode).toBe(200);
    expect(repository.list).toHaveBeenCalledWith("server-a", { after: 0, limit: 10 });
    expect(response.json()).toMatchObject({
      schemaVersion: "office.event.v1",
      cursor: 1,
      events: [{ workspaceId: "server-a", sequence: 1, summary: "Alpha task" }],
    });
    await app.close();
  });

  it("returns the authoritative cursor when an empty page is requested past the journal tail", async () => {
    const app = await createApp();
    routeDb.member.findUnique.mockResolvedValueOnce({ id: "member-a" });
    repository.list.mockResolvedValueOnce([]);
    repository.currentCursor.mockResolvedValueOnce(12);

    const response = await app.inject({
      method: "GET",
      url: "/api/servers/server-a/office/events?after=100&limit=10",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ events: [], cursor: 12 });
    expect(repository.currentCursor).toHaveBeenCalledWith("server-a");
    await app.close();
  });
  it("does not advance an empty page past an event committed after the cursor snapshot", async () => {
    const app = await createApp();
    routeDb.member.findUnique.mockResolvedValueOnce({ id: "member-a" });
    let journalTail = 12;
    repository.currentCursor.mockImplementationOnce(async () => journalTail);
    repository.list.mockImplementationOnce(async () => {
      journalTail = 13;
      return [];
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/servers/server-a/office/events?after=12&limit=10",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ events: [], cursor: 12 });
    expect(repository.currentCursor.mock.invocationCallOrder[0]).toBeLessThan(
      repository.list.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    await app.close();
  });
  it("rejects malformed, oversized, or unsafe cursor input before reading the journal", async () => {
    const app = await createApp();
    routeDb.member.findUnique
      .mockResolvedValueOnce({ id: "member-a" })
      .mockResolvedValueOnce({ id: "member-a" });
    const malformed = await app.inject({
      method: "GET",
      url: "/api/servers/server-a/office/events?after=-1&limit=1000",
    });
    const unsafe = await app.inject({
      method: "GET",
      url: "/api/servers/server-a/office/events?after=9007199254740992&limit=10",
    });
    expect(malformed.statusCode).toBe(400);
    expect(unsafe.statusCode).toBe(400);
    expect(repository.list).not.toHaveBeenCalled();
    await app.close();
  });

  it("redrives dead letters only for an authorized member with explicit confirmation", async () => {
    const app = await createApp();

    routeDb.member.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    const denied = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/outbox/redrive",
      payload: { humanConfirmed: true, reason: "Operator approved replay after root-cause review" },
    });
    expect(denied.statusCode).toBe(403);
    expect(redrive).not.toHaveBeenCalled();

    routeDb.member.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    const unconfirmed = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/outbox/redrive",
      payload: { humanConfirmed: false, reason: "Operator approved replay after root-cause review" },
    });
    expect(unconfirmed.statusCode).toBe(400);
    expect(redrive).not.toHaveBeenCalled();

    redrive.mockResolvedValueOnce(2);
    routeDb.member.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    const accepted = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/outbox/redrive",
      payload: { humanConfirmed: true, reason: "Database outage resolved and payload verified", limit: 2 },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ redriven: 2 });
    expect(redrive).toHaveBeenCalledWith("server-a", {
      actorUserId: "user-1",
      reason: "Database outage resolved and payload verified",
      limit: 2,
    });
    await app.close();
  });
});