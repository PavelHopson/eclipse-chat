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

export type ActionItemWithRelations = Prisma.ActionItemGetPayload<{
  include: typeof actionItemInclude;
}>;

export function serializeActionItem(item: ActionItemWithRelations) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
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
