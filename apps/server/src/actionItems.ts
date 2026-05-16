import { Prisma } from "@prisma/client";

export const actionItemInclude = {
  createdBy: {
    select: {
      id: true,
      displayName: true,
      avatar: true,
    },
  },
  assignee: {
    select: {
      id: true,
      displayName: true,
      avatar: true,
    },
  },
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
      user: {
        select: { id: true, displayName: true, avatar: true },
      },
    },
  },
  activities: {
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      user: {
        select: { id: true, displayName: true, avatar: true },
      },
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
    createdBy: {
      id: item.createdBy.id,
      displayName: item.createdBy.displayName,
      avatar: item.createdBy.avatar,
    },
    assignee: item.assignee
      ? {
          id: item.assignee.id,
          displayName: item.assignee.displayName,
          avatar: item.assignee.avatar,
        }
      : null,
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
      user: {
        id: c.user.id,
        displayName: c.user.displayName,
        avatar: c.user.avatar,
      },
    })),
    activities: item.activities.map((a) => ({
      id: a.id,
      type: a.type,
      payload: a.payload,
      createdAt: a.createdAt.toISOString(),
      user: a.user
        ? {
            id: a.user.id,
            displayName: a.user.displayName,
            avatar: a.user.avatar,
          }
        : null,
    })),
  };
}
