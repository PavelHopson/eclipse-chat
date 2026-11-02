import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { dbBase } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { hasPermission } from "../lib/permissions.js";

const startBody = z.object({ actionItemId: z.string().min(1).max(128), requestId: z.uuid() }).strict();
const options = { onRequest: [requireJwt], config: { rateLimit: { max: 60, timeWindow: 60_000 } } };
export const TIME_GRACE_MS = 30_000;
const MAX_INTERVAL_MS = 86_400_000;
const timestamp = z.iso.datetime({ offset: true }).refine(value => Number.isFinite(+new Date(value)));
const editBody = z.object({ startedAt: timestamp, endedAt: timestamp, version: z.number().int().min(0).max(2_147_483_646) }).strict()
  .refine(value => +new Date(value.endedAt) > +new Date(value.startedAt) && +new Date(value.endedAt) - +new Date(value.startedAt) <= MAX_INTERVAL_MS);
const reportQuery = z.object({ from: timestamp, to: timestamp }).strict()
  .refine(value => +new Date(value.to) > +new Date(value.from) && +new Date(value.to) - +new Date(value.from) <= 8 * MAX_INTERVAL_MS);
type Tx = Prisma.TransactionClient;
async function accessible(tx: Tx, actionItemId: string, userId: string) {
  const action = await tx.actionItem.findUnique({ where: { id: actionItemId }, select: { id: true, title: true, serverId: true, channel: { select: { internal: true } } } });
  if (!action) return null;
  const member = await tx.member.findUnique({ where: { userId_serverId: { userId, serverId: action.serverId } }, select: { role: true, server: { select: { mode: true, suspendedAt: true } } } });
  if (!member || member.server.suspendedAt || (member.server.mode === "CLIENT" && action.channel.internal && !hasPermission(member.role, "ROOM_VIEW_INTERNAL"))) return null;
  return { id: action.id, title: action.title, serverId: action.serverId };
}
async function locked<T>(userId: string, work: (tx: Tx, now: Date) => Promise<T>) {
  return dbBase.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    const active = await tx.personalActionTime.findFirst({ where: { userId, endedAt: null } });
    if (active && (+now - +active.lastHeartbeatAt > TIME_GRACE_MS || +now - +active.startedAt >= MAX_INTERVAL_MS || !await accessible(tx, active.actionItemId, userId))) {
      await tx.personalActionTime.update({ where: { id: active.id }, data: { endedAt: active.lastHeartbeatAt, interrupted: true } });
    }
    return work(tx, now);
  });
}
type TimeRow = { id: string; actionItemId: string; startedAt: Date; endedAt: Date | null; lastHeartbeatAt: Date; interrupted: boolean; version: number };
function timeFields(row: TimeRow) {
  return { id: row.id, startedAt: row.startedAt, endedAt: row.endedAt, confirmedThrough: row.endedAt ?? row.lastHeartbeatAt, interrupted: row.interrupted, version: row.version,
    durationMs: Math.max(0, +(row.endedAt ?? row.lastHeartbeatAt) - +row.startedAt) };
}
async function view(tx: Tx, row: TimeRow, userId: string) {
  return { ...timeFields(row), action: await accessible(tx, row.actionItemId, userId) };
}
export async function registerPersonalTimeRoutes(app: FastifyInstance) {
  app.patch("/api/personal-time/:id", { ...options, bodyLimit: 1024 }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const body = editBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid interval" });
    const { id } = req.params as { id: string };
    const { version } = body.data;
    const startedAt = new Date(body.data.startedAt), endedAt = new Date(body.data.endedAt);
    const result = await locked(userId, async (tx, now) => {
      const row = await tx.personalActionTime.findFirst({ where: { id, userId } });
      if (!row || !await accessible(tx, row.actionItemId, userId)) return { error: "Timer unavailable", status: 404 };
      if (!row.endedAt) return { error: "Timer is active", status: 409 };
      if (row.version !== version) return { error: "Interval changed", status: 409 };
      if (+endedAt > +now) return { error: "Interval is in the future", status: 400 };
      const overlap = await tx.personalActionTime.findFirst({ where: { userId, id: { not: id }, startedAt: { lt: endedAt }, OR: [{ endedAt: { gt: startedAt } }, { endedAt: null }] }, select: { id: true } });
      if (overlap) return { error: "Interval overlaps", status: 409 };
      const updated = await tx.personalActionTime.update({ where: { id }, data: { startedAt, endedAt, lastHeartbeatAt: endedAt, interrupted: false, version: { increment: 1 } } });
      return { entry: await view(tx, updated, userId) };
    });
    reply.header("Cache-Control", "private, no-store");
    return "error" in result ? reply.code(result.status!).send({ error: result.error }) : result;
  });
  app.get("/api/servers/:id/personal-time-report", options, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const query = reportQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid range" });
    const { id: serverId } = req.params as { id: string };
    const from = new Date(query.data.from), to = new Date(query.data.to);
    const result = await locked(userId, async tx => {
      const member = await tx.member.findUnique({ where: { userId_serverId: { userId, serverId } }, select: { role: true, server: { select: { mode: true, suspendedAt: true } } } });
      if (!member || member.server.suspendedAt) return { error: "Server unavailable", status: 403 };
      const hideInternal = member.server.mode === "CLIENT" && !hasPermission(member.role, "ROOM_VIEW_INTERNAL");
      const rows = await tx.personalActionTime.findMany({
        where: { userId, startedAt: { lt: to }, OR: [{ endedAt: { gt: from } }, { endedAt: null, lastHeartbeatAt: { gt: from } }], actionItem: { serverId, ...(hideInternal ? { channel: { internal: false } } : {}) } },
        include: { actionItem: { select: { id: true, title: true, serverId: true } } }, orderBy: [{ startedAt: "desc" }, { id: "asc" }], take: 1001,
      });
      if (rows.length > 1000) return { error: "Too many intervals", status: 413 };
      const entries = rows.map(row => ({ ...timeFields(row), action: row.actionItem, clippedDurationMs: Math.max(0, Math.min(+(row.endedAt ?? row.lastHeartbeatAt), +to) - Math.max(+row.startedAt, +from)) }));
      return { entries, totalDurationMs: entries.reduce((sum, entry) => sum + entry.clippedDurationMs, 0), from, to };
    });
    reply.header("Cache-Control", "private, no-store");
    return "error" in result ? reply.code(result.status!).send({ error: result.error }) : result;
  });
  app.get("/api/personal-time", options, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    reply.header("Cache-Control", "private, no-store");
    return locked(userId, async (tx, now) => {
      const rows = await tx.personalActionTime.findMany({ where: { userId }, orderBy: [{ startedAt: "desc" }, { id: "asc" }], take: 101 });
      return { entries: await Promise.all(rows.slice(0, 100).map(row => view(tx, row, userId))), truncated: rows.length > 100, now };
    });
  });
  app.post("/api/personal-time/start", { ...options, bodyLimit: 1024 }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const body = startBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid timer" });
    const result = await locked(userId, async (tx, now) => {
      const existing = await tx.personalActionTime.findUnique({ where: { userId_requestId: { userId, requestId: body.data.requestId } } });
      if (existing) return existing.actionItemId === body.data.actionItemId ? { entry: await view(tx, existing, userId) } : { error: "Attempt belongs to another task", status: 409 };
      if (!await accessible(tx, body.data.actionItemId, userId)) return { error: "Action unavailable", status: 404 };
      if (await tx.personalActionTime.findFirst({ where: { userId, endedAt: null } })) return { error: "Timer already running", status: 409 };
      const row = await tx.personalActionTime.create({ data: { ...body.data, userId, startedAt: now, lastHeartbeatAt: now } });
      return { entry: await view(tx, row, userId) };
    });
    reply.header("Cache-Control", "private, no-store");
    if ("error" in result) return reply.code(result.status!).send({ error: result.error });
    return result;
  });
  for (const operation of ["pulse", "stop"] as const) app.post(`/api/personal-time/:id/${operation}`, { ...options, bodyLimit: 1024 }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = req.params as { id: string };
    const result = await locked(userId, async (tx, now) => {
      const row = await tx.personalActionTime.findFirst({ where: { id, userId } });
      if (!row) return null;
      const timestamp = new Date(Math.max(+now, +row.lastHeartbeatAt));
      const updated = row.endedAt ? row : await tx.personalActionTime.update({ where: { id }, data: { lastHeartbeatAt: timestamp, ...(operation === "stop" ? { endedAt: timestamp } : {}) } });
      return view(tx, updated, userId);
    });
    reply.header("Cache-Control", "private, no-store");
    return result ? { entry: result } : reply.code(404).send({ error: "Timer unavailable" });
  });
}
