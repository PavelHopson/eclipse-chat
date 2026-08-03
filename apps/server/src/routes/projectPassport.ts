import type { FastifyInstance } from "fastify";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { parseGitHubIntegrationConfig } from "../lib/integrations/config.js";
import {
  deriveProjectPassportHealth,
  filterProjectPassportChannels,
  firstSafeExternalUrl,
  isPassportDocument,
  parsePassportTags,
  parseVerifiedGitHubEvent,
  passportExcerpt,
  selectProjectPassportNextAction,
  type PassportActionSignal,
} from "../lib/projectPassport.js";
import type { MemberRole } from "./servers.js";

const READ_RATE_LIMIT = { max: 60, timeWindow: 60 * 1000 };
const RESPONSIBLE_ROLES = ["OWNER", "ADMIN", "ARCHITECT", "OPERATOR"] as const;
const ROLE_ORDER: Record<string, number> = {
  OWNER: 0,
  ADMIN: 1,
  ARCHITECT: 2,
  OPERATOR: 3,
};
const PRIORITY_ORDER: Record<PassportActionSignal["priority"], number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function actionRank(action: PassportActionSignal, now: Date): number {
  const overdue = action.dueAt && action.dueAt < now ? -20 : 0;
  const escalated = action.escalatedAt ? -40 : 0;
  const risk = action.type === "RISK" ? -10 : 0;
  return escalated + overdue + risk + PRIORITY_ORDER[action.priority];
}

export function registerProjectPassportRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/project-passport",
    {
      onRequest: [requireJwt],
      config: { rateLimit: READ_RATE_LIMIT },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const serverId = (req.params as { id: string }).id;

      const membership = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: {
          role: true,
          server: {
            select: {
              id: true,
              name: true,
              description: true,
              icon: true,
              banner: true,
              mode: true,
              createdAt: true,
              channels: {
                orderBy: [{ position: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  name: true,
                  type: true,
                  description: true,
                  internal: true,
                  createdAt: true,
                  messages: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { createdAt: true },
                  },
                },
              },
              members: {
                where: { role: { in: [...RESPONSIBLE_ROLES] } },
                orderBy: { joinedAt: "asc" },
                take: 12,
                select: {
                  role: true,
                  user: {
                    select: { id: true, displayName: true, avatar: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!membership) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const generatedAt = new Date();
      const server = membership.server;
      const visibleChannels = filterProjectPassportChannels(
        server.mode,
        membership.role as MemberRole,
        server.channels,
      );
      const visibleChannelIds = visibleChannels.map((channel) => channel.id);
      const visibleChannelIdSet = new Set(visibleChannelIds);
      const channelById = new Map(
        visibleChannels.map((channel) => [channel.id, channel]),
      );

      const [actionRows, integrationRows, eventRows, memoryRows] =
        visibleChannelIds.length > 0
          ? await Promise.all([
              db.actionItem.findMany({
                where: {
                  serverId,
                  channelId: { in: visibleChannelIds },
                  OR: [{ status: { not: "DONE" } }, { type: "DECISION" }],
                },
                orderBy: { updatedAt: "desc" },
                take: 150,
                select: {
                  id: true,
                  title: true,
                  type: true,
                  status: true,
                  priority: true,
                  dueAt: true,
                  updatedAt: true,
                  channelId: true,
                  sourceMessageId: true,
                  approvalStatus: true,
                  escalatedAt: true,
                  assignee: {
                    select: { id: true, displayName: true, avatar: true },
                  },
                  channel: { select: { name: true } },
                },
              }),
              db.integration.findMany({
                where: {
                  serverId,
                  type: "GITHUB_WEBHOOK",
                  channelId: { in: visibleChannelIds },
                },
                orderBy: { updatedAt: "desc" },
                take: 20,
                select: {
                  id: true,
                  name: true,
                  config: true,
                  channelId: true,
                  enabled: true,
                  lastEventAt: true,
                  eventCount: true,
                },
              }),
              db.message.findMany({
                where: {
                  channelId: { in: visibleChannelIds },
                  deletedAt: null,
                  externalIntegrationId: { not: null },
                },
                orderBy: { createdAt: "desc" },
                take: 60,
                select: {
                  id: true,
                  channelId: true,
                  createdAt: true,
                  externalEvent: true,
                },
              }),
              db.memoryEntry.findMany({
                where: {
                  serverId,
                  archivedAt: null,
                  OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: generatedAt } },
                  ],
                  AND: [
                    {
                      OR: [
                        { channelId: null },
                        { channelId: { in: visibleChannelIds } },
                      ],
                    },
                  ],
                },
                orderBy: { updatedAt: "desc" },
                take: 80,
                select: {
                  id: true,
                  title: true,
                  content: true,
                  tags: true,
                  kind: true,
                  visibility: true,
                  channelId: true,
                  sourceMessageId: true,
                  actionItemId: true,
                  reviewDueAt: true,
                  updatedAt: true,
                  owner: {
                    select: { id: true, displayName: true, avatar: true },
                  },
                  channel: { select: { name: true } },
                },
              }),
            ])
          : [[], [], [], []];

      const actions = actionRows
        .map((action) => ({
          id: action.id,
          title: passportExcerpt(action.title, 180),
          type: action.type,
          status: action.status,
          priority: action.priority,
          dueAt: action.dueAt?.toISOString() ?? null,
          updatedAt: action.updatedAt.toISOString(),
          channelId: action.channelId,
          channelName: action.channel.name,
          sourceMessageId: action.sourceMessageId,
          approvalStatus: action.approvalStatus,
          escalatedAt: action.escalatedAt?.toISOString() ?? null,
          assignee: action.assignee
            ? {
                id: action.assignee.id,
                displayName: action.assignee.displayName,
                avatar: action.assignee.avatar,
              }
            : null,
        }))
        .sort((a, b) =>
          actionRank(
            {
              ...a,
              dueAt: a.dueAt ? new Date(a.dueAt) : null,
              escalatedAt: a.escalatedAt ? new Date(a.escalatedAt) : null,
            },
            generatedAt,
          ) -
          actionRank(
            {
              ...b,
              dueAt: b.dueAt ? new Date(b.dueAt) : null,
              escalatedAt: b.escalatedAt ? new Date(b.escalatedAt) : null,
            },
            generatedAt,
          ),
        );
      const actionSignals: PassportActionSignal[] = actions.map((action) => ({
        id: action.id,
        type: action.type,
        status: action.status,
        priority: action.priority,
        dueAt: action.dueAt ? new Date(action.dueAt) : null,
        escalatedAt: action.escalatedAt ? new Date(action.escalatedAt) : null,
        channelId: action.channelId,
      }));

      const deploys = eventRows.flatMap((message) => {
        if (!message.channelId || !visibleChannelIdSet.has(message.channelId)) return [];
        const event = parseVerifiedGitHubEvent(message.externalEvent);
        if (!event || (event.kind !== "workflow" && event.kind !== "release" && event.kind !== "deployment")) {
          return [];
        }
        const channel = channelById.get(message.channelId);
        if (!channel) return [];
        return [
          {
            messageId: message.id,
            channelId: message.channelId,
            channelName: channel.name,
            repository: event.repository,
            kind: event.kind,
            title: event.title,
            summary: event.summary,
            status: event.status,
            sourceUrl: event.sourceUrl,
            ref: event.ref,
            actor: event.actor,
            occurredAt: event.occurredAt ?? message.createdAt.toISOString(),
          },
        ];
      }).slice(0, 10);

      const repositories = integrationRows.flatMap((integration) => {
        if (!integration.channelId || !visibleChannelIdSet.has(integration.channelId)) return [];
        const repository = parseGitHubIntegrationConfig(integration.config).repository;
        const channel = channelById.get(integration.channelId);
        if (!repository || !channel) return [];
        return [
          {
            integrationId: integration.id,
            name: passportExcerpt(integration.name, 120),
            repository,
            sourceUrl: `https://github.com/${repository}`,
            channelId: integration.channelId,
            channelName: channel.name,
            enabled: integration.enabled,
            lastEventAt: integration.lastEventAt?.toISOString() ?? null,
            eventCount: integration.eventCount,
          },
        ];
      });

      const documents = memoryRows.flatMap((entry) => {
        const tags = parsePassportTags(entry.tags);
        if (!isPassportDocument(entry.kind, tags)) return [];
        return [
          {
            id: entry.id,
            title: passportExcerpt(entry.title, 160),
            summary: passportExcerpt(entry.content, 220) || null,
            sourceUrl: firstSafeExternalUrl(entry.content),
            kind: entry.kind,
            visibility: entry.visibility,
            tags,
            channelId: entry.channelId,
            channelName: entry.channel?.name ?? null,
            sourceMessageId: entry.sourceMessageId,
            actionItemId: entry.actionItemId,
            reviewDue: Boolean(
              entry.reviewDueAt && entry.reviewDueAt <= generatedAt,
            ),
            updatedAt: entry.updatedAt.toISOString(),
            owner: entry.owner
              ? {
                  id: entry.owner.id,
                  displayName: entry.owner.displayName,
                  avatar: entry.owner.avatar,
                }
              : null,
          },
        ];
      }).slice(0, 12);

      const openWork = actions.filter(
        (action) =>
          action.status !== "DONE" &&
          action.type !== "DECISION" &&
          action.type !== "RISK",
      );
      const decisions = actions
        .filter((action) => action.type === "DECISION")
        .slice(0, 8);
      const risks = actions
        .filter((action) => action.type === "RISK" && action.status !== "DONE")
        .slice(0, 8);
      const health = deriveProjectPassportHealth(actionSignals, deploys, generatedAt);
      const nextAction = selectProjectPassportNextAction(
        actionSignals,
        deploys,
        visibleChannels.map((channel) => channel.id),
      );

      const activeCountByChannel = new Map<string, number>();
      const riskCountByChannel = new Map<string, number>();
      for (const action of actions) {
        if (action.status === "DONE") continue;
        activeCountByChannel.set(
          action.channelId,
          (activeCountByChannel.get(action.channelId) ?? 0) + 1,
        );
        if (action.type === "RISK") {
          riskCountByChannel.set(
            action.channelId,
            (riskCountByChannel.get(action.channelId) ?? 0) + 1,
          );
        }
      }

      return {
        generatedAt: generatedAt.toISOString(),
        project: {
          id: server.id,
          name: server.name,
          description: passportExcerpt(server.description, 320) || null,
          icon: server.icon,
          banner: server.banner,
          mode: server.mode,
          createdAt: server.createdAt.toISOString(),
          health,
        },
        counts: {
          rooms: visibleChannels.length,
          openWork: openWork.length,
          decisions: decisions.length,
          activeRisks: risks.length,
          repositories: repositories.length,
          documents: documents.length,
        },
        responsibles: server.members
          .map((member) => ({
            id: member.user.id,
            displayName: member.user.displayName,
            avatar: member.user.avatar,
            role: member.role,
          }))
          .sort(
            (a, b) =>
              (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99),
          )
          .slice(0, 8),
        repositories,
        deploys,
        rooms: visibleChannels.map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          description: passportExcerpt(channel.description, 140) || null,
          internal: channel.internal,
          activeWork: activeCountByChannel.get(channel.id) ?? 0,
          activeRisks: riskCountByChannel.get(channel.id) ?? 0,
          lastActivityAt: channel.messages[0]?.createdAt.toISOString() ?? null,
        })),
        decisions,
        work: openWork.slice(0, 10),
        risks,
        documents,
        nextAction,
      };
    },
  );
}
