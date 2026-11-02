import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("../auth/requireJwt.js", () => ({
  getUserId: (request: FastifyRequest) => request.headers["x-test-user"] ?? null,
  requireJwt: async (request: FastifyRequest, reply: FastifyReply) => { if (!request.headers["x-test-user"]) return reply.code(401).send({ error: "Unauthorized" }); },
}));
import { db, dbBase } from "../db.js";
import { registerPersonalPlanRoutes } from "./personalPlan.js";
const enabled = process.env.PERSONAL_PLAN_TEST_DB === "1";
const endpoint = process.env.DATABASE_URL ?? "";
const suffix = randomUUID();
const app = Fastify({ logger: false });
let alice: string, bob: string, serverId: string, externalId: string, internalId: string;
const call = (method: "GET" | "PUT" | "DELETE", url: string, user: string, payload?: Record<string, unknown>) => app.inject({ method, url, headers: { "x-test-user": user }, ...(payload === undefined ? {} : { payload }) });
describe.skipIf(!enabled)("personal plan on isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (!endpoint.startsWith("postgresql://postgres@127.0.0.1:55439/")) throw new Error("Integration tests require the isolated local database");
    await registerPersonalPlanRoutes(app);
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
  afterAll(async () => { await app.close(); await dbBase.$disconnect(); });
  it("persists per-user plans without changing deadlines, blocks hidden rooms and respects revoked access", async () => {
    const url = `/api/actions/${externalId}/personal-plan`, body = { day: "2026-11-01", plannedMinutes: 30 };
    expect((await call("PUT", url, alice, body)).statusCode).toBe(200);
    expect((await call("PUT", url, alice, { ...body, plannedMinutes: 45 })).statusCode).toBe(200);
    expect(await db.personalActionPlan.count({ where: { userId: alice, actionItemId: externalId } })).toBe(1);
    expect((await db.actionItem.findUniqueOrThrow({ where: { id: externalId } })).dueAt?.toISOString()).toBe("2030-01-01T12:00:00.000Z");
    const list = `/api/servers/${serverId}/personal-plan?day=2026-11-01`;
    expect((await call("GET", list, alice)).json().plans[0].plannedMinutes).toBe(45);
    expect((await call("GET", list, bob)).json().plans).toEqual([]);
    await db.personalActionPlan.create({ data: { userId: bob, actionItemId: internalId, day: new Date("2026-11-01T00:00:00Z"), plannedMinutes: 10 } });
    expect((await call("GET", list, bob)).json().plans).toEqual([]);
    expect((await call("PUT", `/api/actions/${internalId}/personal-plan`, bob, body)).statusCode).toBe(404);
    expect((await call("PUT", url, bob, body)).statusCode).toBe(200);
    await db.server.update({ where: { id: serverId }, data: { suspendedAt: new Date() } });
    expect((await call("PUT", url, bob, body)).statusCode).toBe(403);
    await db.server.update({ where: { id: serverId }, data: { suspendedAt: null } });
    await db.member.delete({ where: { userId_serverId: { userId: bob, serverId } } });
    expect((await call("GET", list, bob)).statusCode).toBe(403);
    expect((await call("PUT", url, bob, body)).statusCode).toBe(404);
    expect((await call("DELETE", `${url}?day=2026-11-01`, bob)).statusCode).toBe(200);
    expect(await db.personalActionPlan.count({ where: { userId: alice, actionItemId: externalId } })).toBe(1);
    await db.actionItem.delete({ where: { id: externalId } });
    expect(await db.personalActionPlan.count({ where: { actionItemId: externalId } })).toBe(0);
  }, 30000);
});
