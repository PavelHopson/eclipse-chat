import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { actionItemInclude, serializeActionItem } from "../actionItems.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { emitActionItemCreated, emitActionItemUpdated } from "../realtime.js";

const actionTypeSchema = z.enum(["TASK", "DECISION", "FOLLOW_UP"]);
const actionStatusSchema = z.enum(["OPEN", "DONE"]);

const actionQuerySchema = z.object({
  status: actionStatusSchema.optional(),
});

const createActionBody = z.object({
  type: actionTypeSchema,
  title: z.string().trim().min(1).max(160).optional(),
});

const updateActionBody = z
  .object({
    status: actionStatusSchema.optional(),
    title: z.string().trim().min(1).max(160).optional(),
    assigneeUserId: z.string().nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

function deriveActionTitle(type: z.infer<typeof actionTypeSchema>, content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length > 0) {
    return compact.slice(0, 160);
  }

  if (type === "DECISION") return "Decision captured from message";
  if (type === "FOLLOW_UP") return "Follow-up captured from message";
  return "Task captured from message";
}

async function requireChannelMember(userId: string, channelId: string) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, serverId: true },
  });
  if (!channel) {
    return { error: "Channel not found" as const };
  }

  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId: channel.serverId } },
    select: { id: true },
  });
  if (!member) {
    return { error: "Not a member of this server" as const };
  }

  return { channel };
}

export async function registerActionRoutes(app: FastifyInstance) {
  app.get(
    "/api/channels/:id/actions",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id: channelId } = req.params as { id: string };
      const parsed = actionQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query" });
      }

      const membership = await requireChannelMember(userId, channelId);
      if ("error" in membership) {
        return reply.status(membership.error === "Channel not found" ? 404 : 403).send({
          error: membership.error,
        });
      }

      const actions = await db.actionItem.findMany({
        where: {
          channelId,
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
        },
        include: actionItemInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 60,
      });

      return {
        actions: actions.map(serializeActionItem),
      };
    },
  );

  /**
   * GET /api/servers/:id/actions — все action items сервера (across channels)
   * для Status Board. Membership-only. status-фильтр опционален.
   */
  app.get(
    "/api/servers/:id/actions",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id: serverId } = req.params as { id: string };
      const parsed = actionQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const actions = await db.actionItem.findMany({
        where: {
          serverId,
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
        },
        include: actionItemInclude,
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        take: 200,
      });
      return { actions: actions.map(serializeActionItem) };
    },
  );

  app.post(
    "/api/messages/:id/actions",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id: messageId } = req.params as { id: string };
      const parsed = createActionBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const message = await db.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          content: true,
          deletedAt: true,
          channelId: true,
          channel: {
            select: {
              serverId: true,
            },
          },
        },
      });

      if (!message) {
        return reply.status(404).send({ error: "Message not found" });
      }
      if (!message.channelId || !message.channel) {
        return reply.status(400).send({ error: "Actions are available only for server messages" });
      }
      if (message.deletedAt) {
        return reply.status(410).send({ error: "Cannot create action from deleted message" });
      }

      const member = await db.member.findUnique({
        where: {
          userId_serverId: {
            userId,
            serverId: message.channel.serverId,
          },
        },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      const title = parsed.data.title?.trim() || deriveActionTitle(parsed.data.type, message.content);

      try {
        const created = await db.actionItem.create({
          data: {
            title,
            type: parsed.data.type,
            serverId: message.channel.serverId,
            channelId: message.channelId,
            sourceMessageId: message.id,
            createdByUserId: userId,
          },
          include: actionItemInclude,
        });

        const payload = serializeActionItem(created);
        emitActionItemCreated(message.channelId, payload);
        return { action: payload };
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          return reply.status(409).send({ error: "Action of this type already exists for this message" });
        }
        throw error;
      }
    },
  );

  app.patch(
    "/api/actions/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id: actionId } = req.params as { id: string };
      const parsed = updateActionBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const existing = await db.actionItem.findUnique({
        where: { id: actionId },
        select: {
          id: true,
          channelId: true,
          serverId: true,
        },
      });
      if (!existing) {
        return reply.status(404).send({ error: "Action not found" });
      }

      const member = await db.member.findUnique({
        where: {
          userId_serverId: {
            userId,
            serverId: existing.serverId,
          },
        },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      if (parsed.data.assigneeUserId) {
        const assignee = await db.member.findUnique({
          where: {
            userId_serverId: {
              userId: parsed.data.assigneeUserId,
              serverId: existing.serverId,
            },
          },
          select: { id: true },
        });
        if (!assignee) {
          return reply.status(400).send({ error: "Assignee is not a member of this server" });
        }
      }

      const updated = await db.actionItem.update({
        where: { id: actionId },
        data: {
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          ...(parsed.data.title ? { title: parsed.data.title } : {}),
          ...(parsed.data.assigneeUserId !== undefined
            ? { assigneeUserId: parsed.data.assigneeUserId }
            : {}),
          ...(parsed.data.dueAt !== undefined
            ? { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null }
            : {}),
        },
        include: actionItemInclude,
      });

      const payload = serializeActionItem(updated);
      emitActionItemUpdated(existing.channelId, payload);
      return { action: payload };
    },
  );
}
