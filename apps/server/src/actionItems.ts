import { Prisma } from "@prisma/client";
import { serializeUser } from "./lib/userView.js";

const userSelectForView = {
  id: true,
  displayName: true,
  avatar: true,
  email: true,
  botProfile: { select: { id: true, role: true } },
} satisfies Prisma.UserSelect;

export const actionItemInclude = {
  createdBy: { select: userSelectForView },
  assignee: { select: userSelectForView },
  approver: { select: userSelectForView },
} satisfies Prisma.ActionItemInclude;

/**
 * Detail include для v0.54 drawer. Возвращает item + comments + activity feed.
 * Comments отсортированы по createdAt asc (хронология). Activities — desc
 * (последние сверху).
 */
export const actionItemDetailInclude = {
  ...actionItemInclude,
  comments: {
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: userSelectForView },
    },
  },
  activities: {
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      user: { select: userSelectForView },
    },
  },
} satisfies Prisma.ActionItemInclude;

export type ActionItemWithRelations = Prisma.ActionItemGetPayload<{
  include: typeof actionItemInclude;
}>;

export type ActionItemDetailWithRelations = Prisma.ActionItemGetPayload<{
  include: typeof actionItemDetailInclude;
}>;

export function serializeActionItem(item: ActionItemWithRelations) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    type: item.type,
    status: item.status,
    priority: item.priority,
    serverId: item.serverId,
    channelId: item.channelId,
    sourceMessageId: item.sourceMessageId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    dueAt: item.dueAt?.toISOString() ?? null,
    createdBy: serializeUser(item.createdBy),
    assignee: item.assignee ? serializeUser(item.assignee) : null,
    requiresApproval: item.requiresApproval,
    approvalStatus: item.approvalStatus,
    approvalNote: item.approvalNote,
    approvedAt: item.approvedAt?.toISOString() ?? null,
    approver: item.approver ? serializeUser(item.approver) : null,
  };
}

export function serializeActionItemDetail(item: ActionItemDetailWithRelations) {
  return {
    ...serializeActionItem(item),
    comments: item.comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt?.toISOString() ?? null,
      // v0.63: comment author может быть null после user deletion (cascade
      // policy B). serializeUser возвращает «Удалённый пользователь» placeholder.
      user: serializeUser(c.user),
    })),
    activities: item.activities.map((a) => ({
      id: a.id,
      type: a.type,
      payload: a.payload,
      createdAt: a.createdAt.toISOString(),
      user: a.user ? serializeUser(a.user) : null,
    })),
  };
}
