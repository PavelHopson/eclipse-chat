import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { hasPermission } from "../lib/permissions.js";
import { ensureServerActive } from "../lib/serverGating.js";

export const planDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "2000-01-01" && value <= "2100-12-31";
});
const planQuery = z.object({ day: planDay }).strict();
const planBody = z.object({ day: planDay, plannedMinutes: z.number().int().min(1).max(1440).nullable() }).strict();
const options = { onRequest: [requireJwt], config: { rateLimit: { max: 60, timeWindow: 60_000 } } };
const dateFor = (day: string) => new Date(`${day}T00:00:00.000Z`);

async function memberFor(userId: string, serverId: string) {
  return db.member.findUnique({ where: { userId_serverId: { userId, serverId } }, select: { role: true, server: { select: { mode: true } } } });
}

export async function registerPersonalPlanRoutes(app: FastifyInstance) {
  app.get("/api/servers/:id/personal-plan", options, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const { id: serverId } = req.params as { id: string };
    const query = planQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid day" });
    const member = await memberFor(userId, serverId);
    if (!member) return reply.code(403).send({ error: "Not a member of this server" });
    const hideInternal = member.server.mode === "CLIENT" && !hasPermission(member.role, "ROOM_VIEW_INTERNAL");
    const plans = await db.personalActionPlan.findMany({
      where: { userId, day: dateFor(query.data.day), actionItem: { serverId, ...(hideInternal ? { channel: { internal: false } } : {}) } },
      select: { id: true, plannedMinutes: true, actionItem: { select: { id: true, title: true, status: true, channelId: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 201,
    });
    reply.header("Cache-Control", "private, no-store");
    return { plans: plans.slice(0, 200), truncated: plans.length > 200 };
  });

  app.put("/api/actions/:id/personal-plan", { ...options, bodyLimit: 1024 }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const { id: actionItemId } = req.params as { id: string };
    const input = planBody.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "Invalid plan" });
    const action = await db.actionItem.findUnique({ where: { id: actionItemId }, select: { serverId: true, channel: { select: { internal: true } } } });
    if (!action) return reply.code(404).send({ error: "Action not found" });
    const member = await memberFor(userId, action.serverId);
    if (!member || (member.server.mode === "CLIENT" && action.channel.internal && !hasPermission(member.role, "ROOM_VIEW_INTERNAL"))) return reply.code(404).send({ error: "Action not found" });
    if (!await ensureServerActive(action.serverId, reply)) return;
    const day = dateFor(input.data.day);
    await db.personalActionPlan.upsert({ where: { userId_actionItemId_day: { userId, actionItemId, day } }, create: { userId, actionItemId, day, plannedMinutes: input.data.plannedMinutes }, update: { plannedMinutes: input.data.plannedMinutes } });
    reply.header("Cache-Control", "private, no-store");
    return { ok: true };
  });

  app.delete("/api/actions/:id/personal-plan", options, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const { id: actionItemId } = req.params as { id: string };
    const query = planQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid day" });
    // Delete only the caller's record. Access revocation must not prevent removing one's own plan.
    await db.personalActionPlan.deleteMany({ where: { userId, actionItemId, day: dateFor(query.data.day) } });
    reply.header("Cache-Control", "private, no-store");
    return { ok: true };
  });
}
