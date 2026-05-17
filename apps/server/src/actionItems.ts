import { Prisma } from "@prisma/client";
import { serializeUser } from "./lib/userView.js";

const userSelectForView = {
  id: true,
  displayName: true,
  avatar: true,
  email: true,
  botProfile: { select: { id: true, role: true } },
} satisfies Prisma.UserSelect;

/**
 * v0.73 #20 phase 2: dependencies — lightweight select для bulk fetch'а
 * (Status Board возвращает до 200 items, тяжёлый include не пойдёт).
 * Возвращаем только id+title+status+type — этого хватает для chip badge
 * «🚧 Blocked by N: Title 1, Title 2…» в карточке и drawer'е.
 */
const depRowSelect = {
  dependsOnActionItem: {
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
    },
  },
} satisfies Prisma.ActionItemDependencySelect;

const blockRowSelect = {
  actionItem: {
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
    },
  },
} satisfies Prisma.ActionItemDependencySelect;

export const actionItemInclude = {
  createdBy: { select: userSelectForView },
  assignee: { select: userSelectForView },
  approver: { select: userSelectForView },
  dependencies: { select: depRowSelect },
  blocks: { select: blockRowSelect },
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

export type ActionItemDependencyRef = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
  type: "TASK" | "DECISION" | "FOLLOW_UP";
};

export function serializeActionItem(item: ActionItemWithRelations) {
  const dependencies: ActionItemDependencyRef[] = item.dependencies.map(
    (d) => ({
      id: d.dependsOnActionItem.id,
      title: d.dependsOnActionItem.title,
      status: d.dependsOnActionItem.status,
      type: d.dependsOnActionItem.type,
    }),
  );
  const blocks: ActionItemDependencyRef[] = item.blocks.map((d) => ({
    id: d.actionItem.id,
    title: d.actionItem.title,
    status: d.actionItem.status,
    type: d.actionItem.type,
  }));
  // Сколько blockers'ов ещё не закрыты — UI badge "🚧 Blocked by N".
  const blockedByOpen = dependencies.filter((d) => d.status !== "DONE").length;
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
    dependencies,
    blocks,
    blockedByOpen,
    /// v0.73 phase 3/4 — escalation + AI summary metadata.
    escalatedAt: item.escalatedAt?.toISOString() ?? null,
    aiSummary: item.aiSummary,
    aiSummaryUpdatedAt: item.aiSummaryUpdatedAt?.toISOString() ?? null,
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
