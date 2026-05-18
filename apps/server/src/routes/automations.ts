import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";

/**
 * v0.80 #26 phase 1: Automation rules CRUD.
 *
 * Endpoints:
 *   GET    /api/servers/:id/automations
 *   POST   /api/servers/:id/automations
 *   PATCH  /api/automations/:id
 *   DELETE /api/automations/:id
 *
 * Permissions: только OWNER + ADMIN могут CRUD'ить правила. (MODERATOR /
 * OPERATOR — phase 2 если bottleneck.)
 *
 * Validation: trigger/action discriminators узкие в phase 1. Backend
 * параситит JSON в engine, frontend получает sanitized version обратно.
 */

const triggerSchema = z.object({
  type: z.literal("MESSAGE_NEW"),
  keyword: z.string().max(200).optional(),
  channelId: z.string().min(1).nullable().optional(),
  caseInsensitive: z.boolean().optional(),
  /** v0.82 #19 phase 1: regex pattern. Validate compileability на save. */
  regex: z
    .string()
    .max(500)
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        try {
          new RegExp(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid regex pattern" },
    ),
});

const actionPostMessageSchema = z.object({
  type: z.literal("POST_MESSAGE"),
  channelId: z.string().min(1),
  template: z.string().min(1).max(2000),
});

const actionCreateTaskSchema = z.object({
  type: z.literal("CREATE_TASK"),
  taskType: z.enum(["TASK", "DECISION", "FOLLOW_UP"]),
  titleTemplate: z.string().min(1).max(300),
});

const actionSendWebhookSchema = z.object({
  type: z.literal("SEND_WEBHOOK"),
  url: z
    .string()
    .min(1)
    .max(400)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL must start with https://"),
  secret: z.string().min(8).max(200).optional(),
});

const actionSchema = z.discriminatedUnion("type", [
  actionPostMessageSchema,
  actionCreateTaskSchema,
  actionSendWebhookSchema,
]);

const createBody = z.object({
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional(),
  trigger: triggerSchema,
  action: actionSchema,
});

const patchBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  trigger: triggerSchema.optional(),
  action: actionSchema.optional(),
});

function serializeRule(r: {
  id: string;
  serverId: string;
  name: string;
  enabled: boolean;
  trigger: string;
  action: string;
  createdByUserId: string | null;
  createdAt: Date;
  lastFiredAt: Date | null;
  fireCount: number;
}) {
  let trigger: unknown = null;
  let action: unknown = null;
  try {
    trigger = JSON.parse(r.trigger);
  } catch {
    /* */
  }
  try {
    action = JSON.parse(r.action);
  } catch {
    /* */
  }
  return {
    id: r.id,
    serverId: r.serverId,
    name: r.name,
    enabled: r.enabled,
    trigger,
    action,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt.toISOString(),
    lastFiredAt: r.lastFiredAt?.toISOString() ?? null,
    fireCount: r.fireCount,
  };
}

export async function registerAutomationRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/automations",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const rules = await db.automationRule.findMany({
        where: { serverId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { rules: rules.map(serializeRule) };
    },
  );

  app.post(
    "/api/servers/:id/automations",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      if (member.role !== "OWNER" && member.role !== "ADMIN") {
        return reply
          .status(403)
          .send({ error: "Только OWNER / ADMIN могут создавать правила" });
      }
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      // POST_MESSAGE требует target channel в том же сервере. Для
      // CREATE_TASK / SEND_WEBHOOK target — это исходный канал или внешний
      // URL, validate отдельно.
      if (parsed.data.action.type === "POST_MESSAGE") {
        const targetChannel = await db.channel.findUnique({
          where: { id: parsed.data.action.channelId },
          select: { serverId: true, type: true },
        });
        if (!targetChannel || targetChannel.serverId !== serverId) {
          return reply
            .status(400)
            .send({ error: "Action targets a channel not in this workspace" });
        }
        if (
          targetChannel.type !== "TEXT" &&
          targetChannel.type !== "BROADCAST"
        ) {
          return reply
            .status(400)
            .send({ error: "Action target must be TEXT / BROADCAST channel" });
        }
      }
      if (parsed.data.trigger.channelId) {
        const srcChannel = await db.channel.findUnique({
          where: { id: parsed.data.trigger.channelId },
          select: { serverId: true },
        });
        if (!srcChannel || srcChannel.serverId !== serverId) {
          return reply
            .status(400)
            .send({ error: "Trigger channel is not in this workspace" });
        }
      }
      const created = await db.automationRule.create({
        data: {
          serverId,
          name: parsed.data.name,
          enabled: parsed.data.enabled ?? true,
          trigger: JSON.stringify(parsed.data.trigger),
          action: JSON.stringify(parsed.data.action),
          createdByUserId: userId,
        },
      });
      return { rule: serializeRule(created) };
    },
  );

  app.patch(
    "/api/automations/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id } = req.params as { id: string };
      const parsed = patchBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const rule = await db.automationRule.findUnique({
        where: { id },
        select: { id: true, serverId: true },
      });
      if (!rule) return reply.status(404).send({ error: "Rule not found" });
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: rule.serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      if (member.role !== "OWNER" && member.role !== "ADMIN") {
        return reply
          .status(403)
          .send({ error: "Только OWNER / ADMIN могут редактировать правила" });
      }
      const data: {
        name?: string;
        enabled?: boolean;
        trigger?: string;
        action?: string;
      } = {};
      if (parsed.data.name !== undefined) data.name = parsed.data.name;
      if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
      if (parsed.data.trigger)
        data.trigger = JSON.stringify(parsed.data.trigger);
      if (parsed.data.action)
        data.action = JSON.stringify(parsed.data.action);
      const updated = await db.automationRule.update({ where: { id }, data });
      return { rule: serializeRule(updated) };
    },
  );

  app.delete(
    "/api/automations/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id } = req.params as { id: string };
      const rule = await db.automationRule.findUnique({
        where: { id },
        select: { id: true, serverId: true },
      });
      if (!rule) return reply.status(404).send({ error: "Rule not found" });
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: rule.serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      if (member.role !== "OWNER" && member.role !== "ADMIN") {
        return reply
          .status(403)
          .send({ error: "Только OWNER / ADMIN могут удалять правила" });
      }
      await db.automationRule.delete({ where: { id } });
      return { ok: true };
    },
  );
}
