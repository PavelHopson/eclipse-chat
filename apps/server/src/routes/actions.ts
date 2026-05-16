import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  actionItemDetailInclude,
  actionItemInclude,
  serializeActionItem,
  serializeActionItemDetail,
} from "../actionItems.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  emitActionItemCommentAdded,
  emitActionItemCommentDeleted,
  emitActionItemCreated,
  emitActionItemUpdated,
} from "../realtime.js";

const actionTypeSchema = z.enum(["TASK", "DECISION", "FOLLOW_UP"]);
const actionStatusSchema = z.enum(["OPEN", "DONE"]);
const actionPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

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
    description: z.string().max(4000).nullable().optional(),
    priority: actionPrioritySchema.optional(),
    assigneeUserId: z.string().nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

const createCommentBody = z.object({
  content: z.string().trim().min(1).max(2000),
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

/**
 * Activity payload serializer. Хранит compact diff e.g. for STATUS_CHANGED:
 * `{ "from": "OPEN", "to": "DONE" }`. Schema-less — frontend парсит per-type.
 */
function activityPayload(data: Record<string, unknown>): string {
  return JSON.stringify(data);
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

  /**
   * v0.54: GET /api/actions/:id — detail с comments + activity. Used by
   * ActionItemDrawer на frontend. Membership-only check (любой member
   * server'а может видеть detail).
   */
  app.get(
    "/api/actions/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id } = req.params as { id: string };
      const item = await db.actionItem.findUnique({
        where: { id },
        include: actionItemDetailInclude,
      });
      if (!item) {
        return reply.status(404).send({ error: "Action not found" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: item.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      return { action: serializeActionItemDetail(item) };
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
            activities: {
              create: {
                userId,
                type: "CREATED",
                payload: activityPayload({ source: "message", type: parsed.data.type }),
              },
            },
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
          status: true,
          title: true,
          description: true,
          priority: true,
          assigneeUserId: true,
          dueAt: true,
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

      // Build update + activity log in one transaction.
      const activityEntries: Array<{
        type:
          | "STATUS_CHANGED"
          | "ASSIGNEE_CHANGED"
          | "DUE_CHANGED"
          | "PRIORITY_CHANGED"
          | "TITLE_CHANGED"
          | "DESCRIPTION_CHANGED";
        payload: string;
      }> = [];

      if (parsed.data.status && parsed.data.status !== existing.status) {
        activityEntries.push({
          type: "STATUS_CHANGED",
          payload: activityPayload({ from: existing.status, to: parsed.data.status }),
        });
      }
      if (parsed.data.title && parsed.data.title !== existing.title) {
        activityEntries.push({
          type: "TITLE_CHANGED",
          payload: activityPayload({ from: existing.title, to: parsed.data.title }),
        });
      }
      if (
        parsed.data.description !== undefined &&
        (parsed.data.description ?? null) !== (existing.description ?? null)
      ) {
        activityEntries.push({
          type: "DESCRIPTION_CHANGED",
          payload: activityPayload({
            hadValue: existing.description !== null,
            hasValue: parsed.data.description !== null,
          }),
        });
      }
      if (parsed.data.priority && parsed.data.priority !== existing.priority) {
        activityEntries.push({
          type: "PRIORITY_CHANGED",
          payload: activityPayload({ from: existing.priority, to: parsed.data.priority }),
        });
      }
      if (
        parsed.data.assigneeUserId !== undefined &&
        parsed.data.assigneeUserId !== existing.assigneeUserId
      ) {
        activityEntries.push({
          type: "ASSIGNEE_CHANGED",
          payload: activityPayload({
            from: existing.assigneeUserId,
            to: parsed.data.assigneeUserId,
          }),
        });
      }
      const incomingDueAt =
        parsed.data.dueAt !== undefined
          ? parsed.data.dueAt
            ? new Date(parsed.data.dueAt)
            : null
          : undefined;
      if (
        incomingDueAt !== undefined &&
        (incomingDueAt?.toISOString() ?? null) !== (existing.dueAt?.toISOString() ?? null)
      ) {
        activityEntries.push({
          type: "DUE_CHANGED",
          payload: activityPayload({
            from: existing.dueAt?.toISOString() ?? null,
            to: incomingDueAt?.toISOString() ?? null,
          }),
        });
      }

      const updated = await db.$transaction(async (tx) => {
        const result = await tx.actionItem.update({
          where: { id: actionId },
          data: {
            ...(parsed.data.status ? { status: parsed.data.status } : {}),
            ...(parsed.data.title ? { title: parsed.data.title } : {}),
            ...(parsed.data.description !== undefined
              ? { description: parsed.data.description }
              : {}),
            ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
            ...(parsed.data.assigneeUserId !== undefined
              ? { assigneeUserId: parsed.data.assigneeUserId }
              : {}),
            ...(incomingDueAt !== undefined ? { dueAt: incomingDueAt } : {}),
          },
          include: actionItemInclude,
        });
        if (activityEntries.length > 0) {
          await tx.actionItemActivity.createMany({
            data: activityEntries.map((entry) => ({
              actionItemId: actionId,
              userId,
              type: entry.type,
              payload: entry.payload,
            })),
          });
        }
        return result;
      });

      const payload = serializeActionItem(updated);
      emitActionItemUpdated(existing.channelId, payload);
      return { action: payload };
    },
  );

  /**
   * v0.54: POST /api/actions/:id/comments — добавить comment.
   * Activity log пишется автоматически (COMMENT_ADDED).
   */
  app.post(
    "/api/actions/:id/comments",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id: actionId } = req.params as { id: string };
      const parsed = createCommentBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const item = await db.actionItem.findUnique({
        where: { id: actionId },
        select: { id: true, serverId: true, channelId: true },
      });
      if (!item) {
        return reply.status(404).send({ error: "Action not found" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: item.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const { comment } = await db.$transaction(async (tx) => {
        const created = await tx.actionItemComment.create({
          data: {
            actionItemId: actionId,
            userId,
            content: parsed.data.content,
          },
          include: {
            user: { select: { id: true, displayName: true, avatar: true } },
          },
        });
        await tx.actionItemActivity.create({
          data: {
            actionItemId: actionId,
            userId,
            type: "COMMENT_ADDED",
            payload: activityPayload({ commentId: created.id }),
          },
        });
        return { comment: created };
      });

      const payload = {
        id: comment.id,
        actionItemId: actionId,
        serverId: item.serverId,
        channelId: item.channelId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        editedAt: comment.editedAt?.toISOString() ?? null,
        user: {
          id: comment.user.id,
          displayName: comment.user.displayName,
          avatar: comment.user.avatar,
        },
      };
      emitActionItemCommentAdded(item.channelId, item.serverId, payload);
      return { comment: payload };
    },
  );

  /**
   * v0.54: DELETE /api/actions/:id/comments/:commentId — author only.
   * Activity log COMMENT_DELETED. Hard delete (нет soft-delete для comments).
   */
  app.delete(
    "/api/actions/:id/comments/:commentId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id: actionId, commentId } = req.params as {
        id: string;
        commentId: string;
      };
      const comment = await db.actionItemComment.findUnique({
        where: { id: commentId },
        select: {
          id: true,
          userId: true,
          actionItemId: true,
          actionItem: { select: { serverId: true, channelId: true } },
        },
      });
      if (!comment || comment.actionItemId !== actionId) {
        return reply.status(404).send({ error: "Comment not found" });
      }
      if (comment.userId !== userId) {
        return reply.status(403).send({ error: "Only comment author can delete" });
      }
      await db.$transaction(async (tx) => {
        await tx.actionItemComment.delete({ where: { id: commentId } });
        await tx.actionItemActivity.create({
          data: {
            actionItemId: actionId,
            userId,
            type: "COMMENT_DELETED",
            payload: activityPayload({ commentId }),
          },
        });
      });
      emitActionItemCommentDeleted(
        comment.actionItem.channelId,
        comment.actionItem.serverId,
        { commentId, actionItemId: actionId },
      );
      return { ok: true };
    },
  );
}
