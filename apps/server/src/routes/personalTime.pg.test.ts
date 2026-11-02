import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("../auth/requireJwt.js", () => ({
  getUserId: (request: FastifyRequest) => request.headers["x-test-user"] ?? null,
  requireJwt: async (request: FastifyRequest, reply: FastifyReply) => { if (!request.headers["x-test-user"]) return reply.code(401).send({ error: "Unauthorized" }); },
}));
import { db, dbBase } from "../db.js";
import { registerPersonalTimeRoutes } from "./personalTime.js";
const enabled = process.env.PERSONAL_PLAN_TEST_DB === "1";
const endpoint = process.env.DATABASE_URL ?? "";
const suffix = randomUUID();
const app = Fastify({ logger: false });
let alice: string, bob: string, serverId: string, externalId: string, internalId: string;
const call = (method: "GET" | "POST" | "PATCH", url: string, user: string, payload?: Record<string, unknown>) => app.inject({ method, url, headers: { "x-test-user": user }, ...(payload === undefined ? {} : { payload }) });
describe.skipIf(!enabled)("personal time on isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (!endpoint.startsWith("postgresql://postgres@127.0.0.1:55439/")) throw new Error("Integration tests require the isolated local database");
    await registerPersonalTimeRoutes(app);
    const a = await db.user.create({ data: { email: `alice-${suffix}@example.invalid`, passwordHash: "test", displayName: "Alice" } });
    const b = await db.user.create({ data: { email: `bob-${suffix}@example.invalid`, passwordHash: "test", displayName: "Bob" } }); alice = a.id; bob = b.id;
    const server = await db.server.create({ data: { name: "Test", ownerId: alice, mode: "CLIENT" } }); serverId = server.id;
    await db.member.createMany({ data: [{ userId: alice, serverId, role: "OWNER" }, { userId: bob, serverId, role: "GUEST" }] });
    const open = await db.channel.create({ data: { name: "open", slug: `open-${suffix}`, serverId, internal: false } });
    const privateChannel = await db.channel.create({ data: { name: "private", slug: `private-${suffix}`, serverId, internal: true } });
    const openMessage = await db.message.create({ data: { content: "Test", channelId: open.id, userId: alice } });
    const privateMessage = await db.message.create({ data: { content: "Test", channelId: privateChannel.id, userId: alice } });
    const external = await db.actionItem.create({ data: { title: "Visible", type: "TASK", serverId, channelId: open.id, sourceMessageId: openMessage.id, createdByUserId: alice, dueAt: new Date("2030-01-01T12:00:00Z") } }); externalId = external.id;
    const internal = await db.actionItem.create({ data: { title: "Private", type: "TASK", serverId, channelId: privateChannel.id, sourceMessageId: privateMessage.id, createdByUserId: alice } }); internalId = internal.id;
  }, 30000);
  beforeEach(async () => {
    await db.personalActionTime.deleteMany({ where: { userId: { in: [alice, bob] } } });
    await db.server.update({ where: { id: serverId }, data: { suspendedAt: null } });
    await db.member.upsert({ where: { userId_serverId: { userId: bob, serverId } }, create: { userId: bob, serverId, role: "GUEST" }, update: { role: "GUEST" } });
  });
  afterAll(async () => { await app.close(); await db.server.delete({ where: { id: serverId } }); await db.user.deleteMany({ where: { id: { in: [alice, bob] } } }); await dbBase.$disconnect(); });
  const start = (user: string, actionItemId = externalId, requestId = randomUUID()) => call("POST", "/api/personal-time/start", user, { actionItemId, requestId });
  const closed = (startedAt: string, endedAt: string, userId = alice, actionItemId = externalId) => db.personalActionTime.create({ data: { userId, actionItemId, requestId: randomUUID(), startedAt: new Date(startedAt), endedAt: new Date(endedAt), lastHeartbeatAt: new Date(endedAt), interrupted: true } });
  const report = (from: string, to: string, user = alice) => call("GET", `/api/servers/${serverId}/personal-time-report?${new URLSearchParams({ from, to })}`, user);
  it("requires authentication and validates payload without accepting another user", async () => {
    expect((await call("GET", "/api/personal-time", "")).statusCode).toBe(401);
    expect((await call("POST", "/api/personal-time/start", alice, { actionItemId: externalId, requestId: "bad" })).statusCode).toBe(400);
    expect((await call("POST", "/api/personal-time/start", alice, { actionItemId: externalId, requestId: randomUUID(), userId: bob })).statusCode).toBe(400);
  });
  it("serializes concurrent starts and restores the active interval", async () => {
    const results = await Promise.all([start(alice), start(alice)]);
    expect(results.map(row => row.statusCode).sort()).toEqual([200, 409]);
    expect(await db.personalActionTime.count({ where: { userId: alice, endedAt: null } })).toBe(1);
    const current = await call("GET", "/api/personal-time", alice);
    expect(current.headers["cache-control"]).toBe("private, no-store");
    expect(current.json().entries[0].endedAt).toBeNull();
    expect((await call("GET", "/api/personal-time", bob)).json().entries).toEqual([]);
  });
  it("replays start and stop without duplicate time, and refuses foreign intervals", async () => {
    const key = randomUUID();
    const initial = (await start(alice, externalId, key)).json().entry;
    expect((await start(alice, externalId, key)).json().entry.id).toBe(initial.id);
    expect((await start(alice, internalId, key)).statusCode).toBe(409);
    expect((await call("POST", `/api/personal-time/${initial.id}/stop`, bob)).statusCode).toBe(404);
    const pulse = (await call("POST", `/api/personal-time/${initial.id}/pulse`, alice)).json().entry;
    expect(pulse.durationMs).toBeGreaterThanOrEqual(0);
    const stopped = (await call("POST", `/api/personal-time/${initial.id}/stop`, alice)).json().entry;
    expect(stopped.endedAt).not.toBeNull();
    expect((await call("POST", `/api/personal-time/${initial.id}/stop`, alice)).json().entry).toEqual(stopped);
    expect((await start(alice, externalId, key)).json().entry).toEqual(stopped);
    expect(await db.personalActionTime.count({ where: { userId: alice } })).toBe(1);
  });
  it("closes stale intervals at the last confirmation, without counting offline time", async () => {
    const entry = (await start(alice)).json().entry;
    const startedAt = new Date(Date.now() - 120_000), lastHeartbeatAt = new Date(+startedAt + 10_000);
    await db.personalActionTime.update({ where: { id: entry.id }, data: { startedAt, lastHeartbeatAt } });
    const recovered = (await call("POST", `/api/personal-time/${entry.id}/pulse`, alice)).json().entry;
    expect(recovered.endedAt).toBe(lastHeartbeatAt.toISOString());
    expect(recovered.durationMs).toBe(10_000);
    expect(recovered.interrupted).toBe(true);
    expect((await start(alice)).statusCode).toBe(200);
  });
  it("hides internal tasks, blocks revoked access and permits stopping one's own interval", async () => {
    expect((await start(bob, internalId)).statusCode).toBe(404);
    const entry = (await start(bob)).json().entry;
    await db.member.delete({ where: { userId_serverId: { userId: bob, serverId } } });
    expect((await start(bob)).statusCode).toBe(404);
    const stopped = (await call("POST", `/api/personal-time/${entry.id}/stop`, bob)).json().entry;
    expect(stopped.action).toBeNull(); expect(stopped.interrupted).toBe(true);
    expect((await call("GET", "/api/personal-time", bob)).json().entries[0].action).toBeNull();
  });
  it("blocks suspended servers and enforces the unique active DB constraint", async () => {
    const entry = (await start(alice)).json().entry;
    await expect(db.personalActionTime.create({ data: { userId: alice, actionItemId: externalId, requestId: randomUUID(), startedAt: new Date(), lastHeartbeatAt: new Date() } })).rejects.toThrow();
    await db.server.update({ where: { id: serverId }, data: { suspendedAt: new Date() } });
    expect((await start(alice)).statusCode).toBe(404);
    expect((await call("POST", `/api/personal-time/${entry.id}/pulse`, alice)).json().entry.interrupted).toBe(true);
  });
  it("serializes concurrent corrections and reports stale versions without lost updates", async () => {
    const row = await closed("2026-10-01T10:00:00Z", "2026-10-01T10:10:00Z");
    const body = { startedAt: "2026-10-01T10:00:00Z", endedAt: "2026-10-01T10:20:00Z", version: 0 };
    const responses = await Promise.all([call("PATCH", `/api/personal-time/${row.id}`, alice, body), call("PATCH", `/api/personal-time/${row.id}`, alice, body)]);
    expect(responses.map(res => res.statusCode).sort()).toEqual([200, 409]);
    expect(responses.find(res => res.statusCode === 409)?.json().error).toBe("Interval changed");
    const entry = responses.find(res => res.statusCode === 200)!.json().entry;
    expect(entry.version).toBe(1); expect(entry.interrupted).toBe(false); expect(entry.durationMs).toBe(20 * 60_000);
    expect((await call("GET", "/api/personal-time", alice)).json().entries[0].version).toBe(1);
  });
  it("refuses overlaps with stopped and active intervals, permitting adjacent boundaries", async () => {
    const row = await closed("2026-10-01T10:00:00Z", "2026-10-01T10:10:00Z");
    await closed("2026-10-01T10:20:00Z", "2026-10-01T10:30:00Z", alice, internalId);
    const patch = (startedAt: string, endedAt: string, version = 0) => call("PATCH", `/api/personal-time/${row.id}`, alice, { startedAt, endedAt, version });
    const overlap = await patch("2026-10-01T10:00:00Z", "2026-10-01T10:25:00Z");
    expect(overlap.statusCode).toBe(409); expect(overlap.json().error).toBe("Interval overlaps");
    expect((await patch("2026-10-01T10:00:00Z", "2026-10-01T10:20:00Z")).statusCode).toBe(200);
    const now = Date.now();
    await db.personalActionTime.create({ data: { userId: alice, actionItemId: externalId, requestId: randomUUID(), startedAt: new Date(now - 20_000), lastHeartbeatAt: new Date(now) } });
    expect((await patch(new Date(now - 25_000).toISOString(), new Date(now - 15_000).toISOString(), 1)).statusCode).toBe(409);
  });
  it("requires own completed accessible interval and refuses future, malformed or excessive edits", async () => {
    const row = await closed("2026-10-01T10:00:00Z", "2026-10-01T10:10:00Z");
    const body = { startedAt: "2026-10-01T10:00:00Z", endedAt: "2026-10-01T10:20:00Z", version: 0 };
    const url = `/api/personal-time/${row.id}`;
    expect((await call("PATCH", url, "", body)).statusCode).toBe(401);
    expect((await call("PATCH", url, bob, body)).statusCode).toBe(404);
    for (const invalid of [{ ...body, version: -1 }, { ...body, version: 0.5 }, { ...body, startedAt: "2026-02-30T12:00:00Z" }, { ...body, endedAt: body.startedAt }, { ...body, endedAt: "2026-10-03T10:00:00Z" }, { ...body, userId: bob }]) {
      expect((await call("PATCH", url, alice, invalid)).statusCode).toBe(400);
    }
    const tomorrow = Date.now() + 86_400_000;
    expect((await call("PATCH", url, alice, { startedAt: new Date(tomorrow).toISOString(), endedAt: new Date(tomorrow + 60_000).toISOString(), version: 0 })).statusCode).toBe(400);
    const active = (await start(alice)).json().entry;
    expect((await call("PATCH", `/api/personal-time/${active.id}`, alice, body)).json().error).toBe("Timer is active");
    const hidden = await closed(body.startedAt, body.endedAt, bob, internalId);
    expect((await call("PATCH", `/api/personal-time/${hidden.id}`, bob, body)).statusCode).toBe(404);
    const own = await closed(body.startedAt, body.endedAt, bob);
    await db.member.delete({ where: { userId_serverId: { userId: bob, serverId } } });
    expect((await call("PATCH", `/api/personal-time/${own.id}`, bob, body)).statusCode).toBe(404);
    expect((await db.personalActionTime.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(0);
  });
  it("clips report intervals on exclusive day boundaries and omits another user's data", async () => {
    const from = "2026-10-02T00:00:00Z", to = "2026-10-02T01:00:00Z";
    await closed("2026-10-01T23:50:00Z", "2026-10-02T00:20:00Z");
    await closed("2026-10-02T00:40:00Z", "2026-10-02T01:20:00Z");
    await closed("2026-10-01T23:40:00Z", from);
    await closed(to, "2026-10-02T01:30:00Z");
    await closed(from, to, bob);
    const res = await report(from, to);
    expect(res.statusCode).toBe(200); expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.json().entries).toHaveLength(2);
    expect(res.json().entries.map((entry: { clippedDurationMs: number }) => entry.clippedDurationMs)).toEqual([20 * 60_000, 20 * 60_000]);
    expect(res.json().totalDurationMs).toBe(40 * 60_000);
    expect(res.json().from).toBe(new Date(from).toISOString()); expect(res.json().to).toBe(new Date(to).toISOString());
  });
  it("reports only confirmed active time and protects internal, revoked and suspended access", async () => {
    const now = Date.now(), from = new Date(now - 10_000).toISOString(), to = new Date(now + 10_000).toISOString();
    await db.personalActionTime.create({ data: { userId: bob, actionItemId: externalId, requestId: randomUUID(), startedAt: new Date(now - 20_000), lastHeartbeatAt: new Date(now - 5_000) } });
    await closed(from, to, bob, internalId);
    const res = await report(from, to, bob);
    expect(res.json().entries).toHaveLength(1); expect(res.json().totalDurationMs).toBe(5_000);
    expect((await report(from, to, "")).statusCode).toBe(401);
    await db.server.update({ where: { id: serverId }, data: { suspendedAt: new Date() } });
    expect((await report(from, to, bob)).statusCode).toBe(403);
    await db.server.update({ where: { id: serverId }, data: { suspendedAt: null } });
    await db.member.delete({ where: { userId_serverId: { userId: bob, serverId } } });
    expect((await report(from, to, bob)).statusCode).toBe(403);
  });
  it("rejects invalid ranges and returns 413 instead of a truncated total", async () => {
    const from = "2026-10-01T00:00:00Z", to = "2026-10-02T00:00:00Z";
    expect((await report(from, from)).statusCode).toBe(400);
    expect((await report(from, "2026-10-10T00:00:00Z")).statusCode).toBe(400);
    expect((await report("2026-10-01", to)).statusCode).toBe(400);
    await db.personalActionTime.createMany({ data: Array.from({ length: 1001 }, (_, index) => ({ id: randomUUID(), userId: alice, actionItemId: externalId, requestId: randomUUID(), startedAt: new Date(+new Date(from) + index * 2000), endedAt: new Date(+new Date(from) + index * 2000 + 1000), lastHeartbeatAt: new Date(+new Date(from) + index * 2000 + 1000) })) });
    const res = await report(from, to);
    expect(res.statusCode).toBe(413); expect(res.json()).toEqual({ error: "Too many intervals" });
  });
});
