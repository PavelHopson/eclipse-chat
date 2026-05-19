import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  actionItemDetailInclude,
  actionItemInclude,
  serializeActionItem,
  serializeActionItemDetail,
} from "../actionItems.js";
import { AINotConfiguredError, chat } from "../ai/provider.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { serializeUser } from "../lib/userView.js";
import { notifyUser } from "../lib/webPush.js";
import { syncActionToRows } from "../lib/rowActionSync.js";
import { emitTableEvent } from "../realtime.js";
import {
  emitActionItemCommentAdded,
  emitActionItemCommentDeleted,
  emitActionItemCreated,
  emitActionItemDependencyChanged,
  emitActionItemUpdated,
} from "../realtime.js";

const actionTypeSchema = z.enum(["TASK", "DECISION", "FOLLOW_UP"]);
const actionStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "REVIEW", "DONE"]);
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

const requestApprovalBody = z.object({
  approverUserId: z.string().min(1),
  note: z.string().max(500).optional(),
});

const decideApprovalBody = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(500).optional(),
});

const addDependencyBody = z.object({
  dependsOnActionItemId: z.string().min(1),
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
      // v0.84 #27 phase 3: push assignee если назначили нового (не self-assign).
      if (
        parsed.data.assigneeUserId !== undefined &&
        parsed.data.assigneeUserId !== existing.assigneeUserId &&
        parsed.data.assigneeUserId &&
        parsed.data.assigneeUserId !== userId
      ) {
        void notifyUser(
          parsed.data.assigneeUserId,
          "assignment",
          {
            title: `Тебе назначили: ${payload.title}`,
            body: `Задача в Eclipse Chat ждёт реакции.`,
            url: `/eclipse-chat/`,
            tag: `action-${payload.id}`,
            channelId: existing.channelId,
          },
          req.log,
        );
      }
      // v0.94 #10 phase 4b: bidirectional sync — если у action есть
      // linked TableRow'ы, протолкнуть title/status/assignee/dueAt в
      // соответствующие cells. Fire-and-forget. После sync emit
      // table:row:updated event для UI realtime refresh.
      void syncActionToRows(actionId, req.log).then(async () => {
        const linkedRows = await db.tableRow.findMany({
          where: { actionItemId: actionId },
          include: {
            cells: true,
            table: { select: { serverId: true } },
          },
        });
        for (const r of linkedRows) {
          if (!r.table) continue;
          emitTableEvent(r.table.serverId, "table:row:updated", {
            tableId: r.tableId,
            row: {
              id: r.id,
              position: r.position,
              createdAt: r.createdAt.toISOString(),
              updatedAt: r.updatedAt.toISOString(),
              cells: r.cells.map((c) => ({
                fieldId: c.fieldId,
                value: c.value,
              })),
            },
          });
        }
      });
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
        // v0.63: comment.user может быть null после deletion (cascade SetNull),
        // но мы только что создали комментарий — guaranteed non-null. Defensive
        // serializeUser() даёт «Удалённый пользователь» placeholder если null.
        user: serializeUser(comment.user),
      };
      emitActionItemCommentAdded(item.channelId, item.serverId, payload);
      return { comment: payload };
    },
  );

  /**
   * v0.55: POST /api/actions/:id/approval — запрос одобрения. Любой member
   * может назначить approver'а (это не обязательно creator/assignee). Сменяет
   * approvalStatus на PENDING и записывает APPROVAL_REQUESTED в activity-log.
   *
   * Идемпотентность: повторный POST с другим approver'ом — заменит approver
   * (audit log сохраняет всю историю). С тем же — re-request разрешён
   * (нет error, повторное событие в activity).
   */
  app.post(
    "/api/actions/:id/approval",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: actionId } = req.params as { id: string };
      const parsed = requestApprovalBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const item = await db.actionItem.findUnique({
        where: { id: actionId },
        select: { id: true, serverId: true, channelId: true, approvalStatus: true },
      });
      if (!item) return reply.status(404).send({ error: "Action not found" });
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: item.serverId } },
        select: { id: true },
      });
      if (!member) return reply.status(403).send({ error: "Not a member of this server" });
      const approverMember = await db.member.findUnique({
        where: {
          userId_serverId: { userId: parsed.data.approverUserId, serverId: item.serverId },
        },
        select: { id: true },
      });
      if (!approverMember) {
        return reply
          .status(400)
          .send({ error: "Approver is not a member of this server" });
      }
      const updated = await db.$transaction(async (tx) => {
        const result = await tx.actionItem.update({
          where: { id: actionId },
          data: {
            requiresApproval: true,
            approverUserId: parsed.data.approverUserId,
            approvalStatus: "PENDING",
            approvalNote: parsed.data.note ?? null,
            // Re-request обнуляет approvedAt — это снова pending.
            approvedAt: null,
          },
          include: actionItemInclude,
        });
        await tx.actionItemActivity.create({
          data: {
            actionItemId: actionId,
            userId,
            type: "APPROVAL_REQUESTED",
            payload: activityPayload({
              approverUserId: parsed.data.approverUserId,
              note: parsed.data.note ?? null,
            }),
          },
        });
        return result;
      });
      const payload = serializeActionItem(updated);
      emitActionItemUpdated(item.channelId, payload);
      // v0.84 #27 phase 3: push approver (не self).
      if (parsed.data.approverUserId !== userId) {
        void notifyUser(
          parsed.data.approverUserId,
          "approval",
          {
            title: `Требуется одобрение: ${payload.title}`,
            body: parsed.data.note?.trim() || `Кто-то ждёт твоего решения.`,
            url: `/eclipse-chat/`,
            tag: `approval-${payload.id}`,
            channelId: item.channelId,
          },
          req.log,
        );
      }
      return { action: payload };
    },
  );

  /**
   * v0.55: POST /api/actions/:id/approval/decision — approver делает решение.
   * Только user указанный как approverUserId может вызвать. Decision =
   * APPROVED или REJECTED, optional note.
   */
  app.post(
    "/api/actions/:id/approval/decision",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: actionId } = req.params as { id: string };
      const parsed = decideApprovalBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const item = await db.actionItem.findUnique({
        where: { id: actionId },
        select: {
          id: true,
          serverId: true,
          channelId: true,
          approverUserId: true,
          approvalStatus: true,
        },
      });
      if (!item) return reply.status(404).send({ error: "Action not found" });
      if (item.approverUserId !== userId) {
        return reply
          .status(403)
          .send({ error: "Only the designated approver can decide" });
      }
      if (item.approvalStatus !== "PENDING") {
        return reply
          .status(409)
          .send({ error: "Approval is not pending", status: item.approvalStatus });
      }
      const now = new Date();
      const updated = await db.$transaction(async (tx) => {
        const result = await tx.actionItem.update({
          where: { id: actionId },
          data: {
            approvalStatus: parsed.data.decision,
            approvalNote: parsed.data.note ?? null,
            approvedAt: now,
          },
          include: actionItemInclude,
        });
        await tx.actionItemActivity.create({
          data: {
            actionItemId: actionId,
            userId,
            type: parsed.data.decision === "APPROVED"
              ? "APPROVAL_APPROVED"
              : "APPROVAL_REJECTED",
            payload: activityPayload({ note: parsed.data.note ?? null }),
          },
        });
        return result;
      });
      const payload = serializeActionItem(updated);
      emitActionItemUpdated(item.channelId, payload);
      return { action: payload };
    },
  );

  /**
   * v0.73 #20 phase 2: POST /api/actions/:id/dependencies — добавить
   * blocker. Body: `{ dependsOnActionItemId }`. Membership-only.
   *
   * Защиты:
   *   * self-loop отвергается (BD CHECK тоже ловит как defense-in-depth);
   *   * обе задачи должны быть в одном server'е;
   *   * BFS от dependsOnActionItemId по существующим зависимостям —
   *     если граф достижим до :id, был бы цикл (A→B→…→A) → 409;
   *   * P2002 (duplicate edge) → 409.
   */
  app.post(
    "/api/actions/:id/dependencies",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: actionId } = req.params as { id: string };
      const parsed = addDependencyBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const { dependsOnActionItemId: blockerId } = parsed.data;
      if (actionId === blockerId) {
        return reply
          .status(400)
          .send({ error: "Action cannot depend on itself" });
      }
      const [item, blocker] = await Promise.all([
        db.actionItem.findUnique({
          where: { id: actionId },
          select: { id: true, serverId: true, channelId: true },
        }),
        db.actionItem.findUnique({
          where: { id: blockerId },
          select: { id: true, serverId: true, channelId: true },
        }),
      ]);
      if (!item || !blocker) {
        return reply.status(404).send({ error: "Action not found" });
      }
      if (item.serverId !== blocker.serverId) {
        return reply
          .status(400)
          .send({ error: "Dependency must be within the same workspace" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: item.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      // BFS из blockerId по зависимостям: если достигнем actionId — цикл.
      // Берём все edges сервера один раз, чтобы не делать N запросов.
      const allEdges = await db.actionItemDependency.findMany({
        where: { actionItem: { serverId: item.serverId } },
        select: { actionItemId: true, dependsOnActionItemId: true },
      });
      const adj = new Map<string, string[]>();
      for (const e of allEdges) {
        const arr = adj.get(e.actionItemId);
        if (arr) arr.push(e.dependsOnActionItemId);
        else adj.set(e.actionItemId, [e.dependsOnActionItemId]);
      }
      const stack = [blockerId];
      const seen = new Set<string>();
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (node === actionId) {
          return reply
            .status(409)
            .send({ error: "Adding this dependency would create a cycle" });
        }
        if (seen.has(node)) continue;
        seen.add(node);
        const neighbors = adj.get(node);
        if (neighbors) stack.push(...neighbors);
      }

      try {
        await db.$transaction(async (tx) => {
          await tx.actionItemDependency.create({
            data: {
              actionItemId: actionId,
              dependsOnActionItemId: blockerId,
            },
          });
          await tx.actionItemActivity.create({
            data: {
              actionItemId: actionId,
              userId,
              type: "DEPENDENCY_ADDED",
              payload: activityPayload({ blockerId }),
            },
          });
        });
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          return reply
            .status(409)
            .send({ error: "Dependency already exists" });
        }
        throw error;
      }

      // Отдаём обновлённые detail-payload'ы обеих задач, чтобы клиент
      // мог обновить и drawer источника, и карточку блокера.
      const [itemAfter, blockerAfter] = await Promise.all([
        db.actionItem.findUnique({
          where: { id: actionId },
          include: actionItemInclude,
        }),
        db.actionItem.findUnique({
          where: { id: blockerId },
          include: actionItemInclude,
        }),
      ]);
      if (itemAfter) emitActionItemUpdated(item.channelId, serializeActionItem(itemAfter));
      if (blockerAfter)
        emitActionItemUpdated(blocker.channelId, serializeActionItem(blockerAfter));
      emitActionItemDependencyChanged(item.channelId, item.serverId, {
        actionItemId: actionId,
        dependsOnActionItemId: blockerId,
        kind: "added",
      });
      return {
        action: itemAfter ? serializeActionItem(itemAfter) : null,
        blocker: blockerAfter ? serializeActionItem(blockerAfter) : null,
      };
    },
  );

  /**
   * v0.73 #20 phase 2: DELETE /api/actions/:id/dependencies/:depId
   * Удалить blocker. Membership-only. P2025 (edge not found) → 404.
   */
  app.delete(
    "/api/actions/:id/dependencies/:depId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: actionId, depId } = req.params as {
        id: string;
        depId: string;
      };
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
      try {
        await db.$transaction(async (tx) => {
          await tx.actionItemDependency.delete({
            where: {
              actionItemId_dependsOnActionItemId: {
                actionItemId: actionId,
                dependsOnActionItemId: depId,
              },
            },
          });
          await tx.actionItemActivity.create({
            data: {
              actionItemId: actionId,
              userId,
              type: "DEPENDENCY_REMOVED",
              payload: activityPayload({ blockerId: depId }),
            },
          });
        });
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          "code" in error &&
          (error as { code?: string }).code === "P2025"
        ) {
          return reply.status(404).send({ error: "Dependency not found" });
        }
        throw error;
      }
      const blocker = await db.actionItem.findUnique({
        where: { id: depId },
        select: { channelId: true },
      });
      const [itemAfter, blockerAfter] = await Promise.all([
        db.actionItem.findUnique({
          where: { id: actionId },
          include: actionItemInclude,
        }),
        db.actionItem.findUnique({
          where: { id: depId },
          include: actionItemInclude,
        }),
      ]);
      if (itemAfter) emitActionItemUpdated(item.channelId, serializeActionItem(itemAfter));
      if (blockerAfter && blocker)
        emitActionItemUpdated(blocker.channelId, serializeActionItem(blockerAfter));
      emitActionItemDependencyChanged(item.channelId, item.serverId, {
        actionItemId: actionId,
        dependsOnActionItemId: depId,
        kind: "removed",
      });
      return { ok: true };
    },
  );

  /**
   * v0.73 #20 phase 4: POST /api/actions/:id/ai-summary — генерит 2-3
   * строчную сводку по description + последние 30 комментариев. Любой
   * member. Кэш в `aiSummary` + `aiSummaryUpdatedAt`. Activity log
   * AI_SUMMARY_GENERATED.
   *
   * Ошибки:
   *   * 503 если AI не сконфигурирован (AINotConfiguredError).
   *   * 400 если у задачи нечего суммаризовать (no description + 0 comments).
   *   * 502 если все провайдеры упали — клиент покажет «попробовать ещё раз».
   */
  app.post(
    "/api/actions/:id/ai-summary",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: actionId } = req.params as { id: string };
      const item = await db.actionItem.findUnique({
        where: { id: actionId },
        select: {
          id: true,
          serverId: true,
          channelId: true,
          title: true,
          description: true,
          type: true,
          status: true,
        },
      });
      if (!item) return reply.status(404).send({ error: "Action not found" });
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: item.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const comments = await db.actionItemComment.findMany({
        where: { actionItemId: actionId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          content: true,
          createdAt: true,
          user: { select: { displayName: true } },
        },
      });
      const hasDescription = (item.description ?? "").trim().length > 0;
      if (!hasDescription && comments.length === 0) {
        return reply
          .status(400)
          .send({ error: "Nothing to summarize: no description and no comments" });
      }

      // Compose prompt — короткие сводки, не «AI-powered» копирайт. RU,
      // 2-3 предложения максимум. Plain text без markdown.
      const commentLines = comments
        .slice()
        .reverse()
        .map((c) => {
          const who = c.user?.displayName ?? "Удалённый пользователь";
          return `${who}: ${c.content.replace(/\s+/g, " ").trim()}`;
        })
        .join("\n");
      const typeLabel =
        item.type === "DECISION"
          ? "решение"
          : item.type === "FOLLOW_UP"
            ? "follow-up"
            : "задача";

      const system = [
        "Ты — операционный ассистент команды. Резюмируй задачу или решение",
        "в 2-3 коротких предложения на русском. Без markdown, без emoji,",
        "без вводных фраз («Вот резюме…»). Описывай суть + текущее состояние",
        "+ что осталось сделать. Если данных мало — скажи об этом одной фразой.",
      ].join(" ");
      const user = [
        `Тип: ${typeLabel}`,
        `Статус: ${item.status}`,
        `Заголовок: ${item.title}`,
        hasDescription ? `Описание:\n${item.description}` : "Описание: (нет)",
        comments.length > 0
          ? `Последние комментарии:\n${commentLines}`
          : "Комментариев нет.",
      ].join("\n\n");

      let summary: string;
      try {
        const result = await chat(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          { temperature: 0.3, maxTokens: 220 },
        );
        summary = result.text.trim();
      } catch (err) {
        if (err instanceof AINotConfiguredError) {
          return reply
            .status(503)
            .send({ error: "AI is not configured on this server" });
        }
        req.log.warn({ err, actionId }, "AI summary failed");
        return reply
          .status(502)
          .send({ error: "AI provider failed; please try again" });
      }
      if (!summary) {
        return reply
          .status(502)
          .send({ error: "AI returned empty result" });
      }
      // Clamp на всякий случай — Prisma строка без лимита, но нам не нужны
      // огромные блобы.
      if (summary.length > 1500) summary = summary.slice(0, 1500);

      await db.$transaction(async (tx) => {
        await tx.actionItem.update({
          where: { id: actionId },
          data: { aiSummary: summary, aiSummaryUpdatedAt: new Date() },
        });
        await tx.actionItemActivity.create({
          data: {
            actionItemId: actionId,
            userId,
            type: "AI_SUMMARY_GENERATED",
            payload: activityPayload({ length: summary.length }),
          },
        });
      });

      const updated = await db.actionItem.findUnique({
        where: { id: actionId },
        include: actionItemInclude,
      });
      if (updated) {
        emitActionItemUpdated(item.channelId, serializeActionItem(updated));
      }
      return {
        summary,
        updatedAt: new Date().toISOString(),
      };
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
