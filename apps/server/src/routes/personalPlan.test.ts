import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ member: { findUnique: vi.fn() }, server: { findUnique: vi.fn() }, actionItem: { findUnique: vi.fn() }, personalActionPlan: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() } }));
vi.mock("../db.js", () => ({ db: mocks }));
vi.mock("../auth/requireJwt.js", () => ({
  getUserId: (request: FastifyRequest) => request.headers["x-test-user"] ?? null,
  requireJwt: async (request: FastifyRequest, reply: FastifyReply) => { if (!request.headers["x-test-user"]) return reply.code(401).send({ error: "Unauthorized" }); },
}));
import { planDay, registerPersonalPlanRoutes } from "./personalPlan.js";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.findUnique.mockResolvedValue({ role: "MEMBER", server: { mode: "TEAM" } });
  mocks.server.findUnique.mockResolvedValue({ suspendedAt: null, suspendedReason: null });
  mocks.actionItem.findUnique.mockResolvedValue({ serverId: "server-1", channel: { internal: false } });
  mocks.personalActionPlan.findMany.mockResolvedValue([]);
  mocks.personalActionPlan.upsert.mockResolvedValue({});
  mocks.personalActionPlan.deleteMany.mockResolvedValue({ count: 0 });
});
async function request(method: "GET" | "PUT" | "DELETE", url: string, body?: unknown, user: string | null = "alice") {
  const app = Fastify({ logger: false }); await registerPersonalPlanRoutes(app);
  try { return await app.inject({ method, url, headers: { ...(user ? { "x-test-user": user } : {}), ...(method === "PUT" ? { "content-type": "application/json" } : {}) }, ...(method === "PUT" ? { payload: JSON.stringify(body) } : {}) }); }
  finally { await app.close(); }
}
const list = "/api/servers/server-1/personal-plan?day=2026-11-01";
const action = "/api/actions/action-1/personal-plan";
describe("personal plan", () => {
  it.each(["2026-02-29", "2026-13-01", "1999-12-31", "2101-01-01", "2026-1-01", "x"]) ("rejects invalid day %s", value => expect(planDay.safeParse(value).success).toBe(false));
  it("accepts a real leap day", () => expect(planDay.safeParse("2028-02-29").success).toBe(true));
  it.each(["GET", "PUT", "DELETE"] as const)("requires auth for %s", async method => {
    expect((await request(method, method === "GET" ? list : action + (method === "DELETE" ? "?day=2026-11-01" : ""), { day: "2026-11-01", plannedMinutes: 30 }, null)).statusCode).toBe(401);
  });
  it("scopes reads to the JWT user and server and disables caching", async () => {
    const res = await request("GET", list);
    expect(res.statusCode).toBe(200); expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(mocks.personalActionPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "alice", day: new Date("2026-11-01T00:00:00Z"), actionItem: { serverId: "server-1" } } }));
  });
  it("denies reads if membership has been revoked", async () => {
    mocks.member.findUnique.mockResolvedValue(null); expect((await request("GET", list)).statusCode).toBe(403); expect(mocks.personalActionPlan.findMany).not.toHaveBeenCalled();
  });
  it("hides internal rooms from client guests", async () => {
    mocks.member.findUnique.mockResolvedValue({ role: "GUEST", server: { mode: "CLIENT" } });
    await request("GET", list);
    expect(mocks.personalActionPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ actionItem: { serverId: "server-1", channel: { internal: false } } }) }));
    mocks.actionItem.findUnique.mockResolvedValue({ serverId: "server-1", channel: { internal: true } });
    expect((await request("PUT", action, { day: "2026-11-01", plannedMinutes: 30 })).statusCode).toBe(404); expect(mocks.personalActionPlan.upsert).not.toHaveBeenCalled();
  });
  it("denies planning a task in another server", async () => {
    mocks.member.findUnique.mockResolvedValue(null); expect((await request("PUT", action, { day: "2026-11-01", plannedMinutes: null })).statusCode).toBe(404); expect(mocks.personalActionPlan.upsert).not.toHaveBeenCalled();
  });
  it("does not write to a suspended server", async () => {
    mocks.server.findUnique.mockResolvedValue({ suspendedAt: new Date(), suspendedReason: null });
    expect((await request("PUT", action, { day: "2026-11-01", plannedMinutes: 30 })).statusCode).toBe(403);
    expect(mocks.personalActionPlan.upsert).not.toHaveBeenCalled();
  });
  it.each([{ day: "2026-11-01", plannedMinutes: 0 }, { day: "2026-11-01", plannedMinutes: 1441 }, { day: "2026-11-01", plannedMinutes: 1.5 }, { day: "2026-11-01", plannedMinutes: 30, userId: "bob" }, { day: "2026-02-29", plannedMinutes: null }])("rejects invalid or foreign fields", async body => {
    expect((await request("PUT", action, body)).statusCode).toBe(400); expect(mocks.personalActionPlan.upsert).not.toHaveBeenCalled();
  });
  it("upserts for the signed-in user without touching the task deadline", async () => {
    expect((await request("PUT", action, { day: "2026-11-01", plannedMinutes: 30 })).statusCode).toBe(200);
    expect(mocks.personalActionPlan.upsert).toHaveBeenCalledWith({ where: { userId_actionItemId_day: { userId: "alice", actionItemId: "action-1", day: new Date("2026-11-01T00:00:00Z") } }, create: { userId: "alice", actionItemId: "action-1", day: new Date("2026-11-01T00:00:00Z"), plannedMinutes: 30 }, update: { plannedMinutes: 30 } });
  });
  it("allows removing only one's own record even after access is revoked", async () => {
    expect((await request("DELETE", `${action}?day=2026-11-01`)).statusCode).toBe(200);
    expect(mocks.personalActionPlan.deleteMany).toHaveBeenCalledWith({ where: { userId: "alice", actionItemId: "action-1", day: new Date("2026-11-01T00:00:00Z") } });
  });
});
