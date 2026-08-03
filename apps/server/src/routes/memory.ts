import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { chat } from "../ai/provider.js";
import {
  actionItemMemorySuggestionPrompt,
  memorySuggestionPrompt,
  parseMemorySuggestion,
} from "../ai/memorySuggestion.js";
import { db } from "../db.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { hasPermission } from "../lib/permissions.js";
import {
  canManageMemoryEntry,
  getMemoryLifecycle,
} from "../lib/memoryGovernance.js";
import { serializeUser, type RawUserView } from "../lib/userView.js";
import { emitMemoryUpdated } from "../realtime.js";
import type { MemberRole } from "./servers.js";

const memoryKindSchema = z.enum(["NOTE", "DECISION", "RISK", "FACT", "LINK", "ACTION"]);
const memoryVisibilitySchema = z.enum(["ROOM", "WORKSPACE"]);
const governanceDateSchema = z.string().datetime().nullable();
const DEFAULT_REVIEW_DAYS = 90;

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(8)
  .optional();

const listMemoryQuery = z.object({
  includeServer: z.enum(["true", "false"]).optional(),
  state: z.enum(["active", "archived", "all"]).default("active"),
}).strict();

const createMemoryBody = z
  .object({
    kind: memoryKindSchema.default("NOTE"),
    title: z.string().trim().min(1).max(180),
    content: z.string().trim().max(4000).nullable().optional(),
    tags: tagsSchema,
    visibility: memoryVisibilitySchema.default("ROOM"),
    ownerUserId: z.string().trim().min(1).optional(),
    reviewDueAt: governanceDateSchema.optional(),
    expiresAt: governanceDateSchema.optional(),
    sourceMessageId: z.string().trim().min(1).optional(),
    actionItemId: z.string().trim().min(1).optional(),
  })
  .strict();

const suggestMemoryBody = z.union([
  z.object({ messageId: z.string().trim().min(1) }).strict(),
  z.object({ actionItemId: z.string().trim().min(1) }).strict(),
]);

const updateMemoryBody = z
  .object({
    kind: memoryKindSchema.optional(),
    title: z.string().trim().min(1).max(180).optional(),
    content: z.string().trim().max(4000).nullable().optional(),
    tags: tagsSchema,
    visibility: memoryVisibilitySchema.optional(),
    ownerUserId: z.string().trim().min(1).optional(),
    reviewDueAt: governanceDateSchema.optional(),
    expiresAt: governanceDateSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

const reviewMemoryBody = z
  .object({ reviewDueAt: governanceDateSchema.optional() })
  .strict();

const memoryEntryInclude = {
  createdBy: {
    select: {
      id: true,
      displayName: true,
      avatar: true,
      email: true,
      botProfile: { select: { id: true, role: true } },
    },
  },
  owner: {
    select: {
      id: true,
      displayName: true,
      avatar: true,
      email: true,
      botProfile: { select: { id: true, role: true } },
    },
  },
  lastReviewedBy: {
    select: {
      id: true,
      displayName: true,
      avatar: true,
      email: true,
      botProfile: { select: { id: true, role: true } },
    },
  },
  archivedBy: {
    select: {
      id: true,
      displayName: true,
      avatar: true,
      email: true,
      botProfile: { select: { id: true, role: true } },
    },
  },
  channel: {
    select: {
      id: true,
      name: true,
      internal: true,
      server: { select: { mode: true } },
    },
  },
  actionItem: { select: { id: true, title: true, type: true } },
};

type MemoryEntryRow = {
  id: string;
  serverId: string;
  channelId: string | null;
  kind: string;
  visibility: "ROOM" | "WORKSPACE";
  title: string;
  content: string | null;
  tags: string | null;
  sourceMessageId: string | null;
  actionItemId: string | null;
  createdByUserId: string | null;
  ownerUserId: string | null;
  reviewDueAt: Date | null;
  lastReviewedAt: Date | null;
  expiresAt: Date | null;
  archivedAt: Date | null;
  archivedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: RawUserView;
  owner: RawUserView;
  lastReviewedBy: RawUserView;
  archivedBy: RawUserView;
  channel: {
    id: string;
    name: string;
    internal: boolean;
    server: { mode: string };
  } | null;
  actionItem: { id: string; title: string; type: string } | null;
};

function normalizeTags(tags: string[] | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  const unique = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  return unique.length > 0 ? JSON.stringify(unique.slice(0, 8)) : null;
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

function serializeMemoryEntry(entry: MemoryEntryRow, viewerId: string, viewerRole: MemberRole) {
  const lifecycle = getMemoryLifecycle(entry);
  const canEdit = canManageMemoryEntry(viewerId, viewerRole, entry);
  return {
    id: entry.id,
    serverId: entry.serverId,
    channelId: entry.channelId,
    channel: entry.channel
      ? { id: entry.channel.id, name: entry.channel.name, internal: entry.channel.internal }
      : null,
    kind: entry.kind,
    visibility: entry.visibility,
    title: entry.title,
    content: entry.content,
    tags: parseTags(entry.tags),
    sourceMessageId: entry.sourceMessageId,
    actionItemId: entry.actionItemId,
    actionItem: entry.actionItem,
    owner: serializeUser(entry.owner),
    reviewDueAt: entry.reviewDueAt?.toISOString() ?? null,
    lastReviewedAt: entry.lastReviewedAt?.toISOString() ?? null,
    lastReviewedBy: serializeUser(entry.lastReviewedBy),
    expiresAt: entry.expiresAt?.toISOString() ?? null,
    archivedAt: entry.archivedAt?.toISOString() ?? null,
    archivedBy: entry.archivedAt ? serializeUser(entry.archivedBy) : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    createdBy: serializeUser(entry.createdBy),
    lifecycle: {
      status: lifecycle.status,
      contextEligible: lifecycle.contextEligible,
      contextReason: lifecycle.contextReason,
    },
    permissions: {
      canEdit,
      canArchive: canEdit && !entry.archivedAt,
      canRestore: canEdit && Boolean(entry.archivedAt),
      canReview: canEdit && !entry.archivedAt,
      canReassign: hasPermission(viewerRole, "MEMORY_MANAGE"),
    },
  };
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseGovernanceDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

async function ensureMemoryOwner(serverId: string, ownerUserId: string) {
  return db.member.findUnique({
    where: { userId_serverId: { userId: ownerUserId, serverId } },
    select: { userId: true },
  });
}

async function requireChannelMember(userId: string, channelId: string) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      serverId: true,
      internal: true,
      server: { select: { mode: true } },
    },
  });
  if (!channel) {
    return { ok: false as const, error: "Channel not found" as const, status: 404 as const };
  }

  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId: channel.serverId } },
    select: { id: true, role: true },
  });
  if (!member) {
    return { ok: false as const, error: "Not a member of this server" as const, status: 403 as const };
  }
  if (
    channel.server.mode === "CLIENT" &&
    channel.internal &&
    !hasPermission(member.role, "ROOM_VIEW_INTERNAL")
  ) {
    return { ok: false as const, error: "Channel not found" as const, status: 404 as const };
  }

  return { ok: true as const, channel, member };
}

async function requireMemoryMember(userId: string, memoryId: string) {
  const entry = await db.memoryEntry.findUnique({
    where: { id: memoryId },
    include: memoryEntryInclude,
  });
  if (!entry) {
    return { ok: false as const, error: "Memory entry not found" as const, status: 404 as const };
  }

  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId: entry.serverId } },
    select: { id: true, role: true },
  });
  if (!member) {
    return { ok: false as const, error: "Not a member of this server" as const, status: 403 as const };
  }
  if (
    entry.channel?.server.mode === "CLIENT" &&
    entry.channel.internal &&
    !hasPermission(member.role, "ROOM_VIEW_INTERNAL")
  ) {
    return { ok: false as const, error: "Memory entry not found" as const, status: 404 as const };
  }

  return { ok: true as const, entry, member };
}

export async function registerMemoryRoutes(app: FastifyInstance) {
  app.get(
    "/api/channels/:id/memory",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id: channelId } = req.params as { id: string };
      const parsedQuery = listMemoryQuery.safeParse(req.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({ error: "Invalid query" });
      }

      const membership = await requireChannelMember(userId, channelId);
      if (!membership.ok) {
        return reply.status(membership.status).send({
          error: membership.error,
        });
      }

      const includeServer = parsedQuery.data.includeServer !== "false";
      const state = parsedQuery.data.state;
      const archiveWhere =
        state === "active"
          ? { archivedAt: null }
          : state === "archived"
            ? { archivedAt: { not: null } }
            : {};
      const scopeWhere = includeServer
        ? {
            OR: [
              { channelId },
              { visibility: "WORKSPACE" as const },
              // Backward compatibility for legacy server-level rows.
              { channelId: null },
            ],
          }
        : { channelId };
      const canViewInternal = hasPermission(
        membership.member.role,
        "ROOM_VIEW_INTERNAL",
      );
      const entries = await db.memoryEntry.findMany({
        where: {
          serverId: membership.channel.serverId,
          ...archiveWhere,
          AND: [
            scopeWhere,
            ...(canViewInternal
              ? []
              : [{ OR: [{ channelId: null }, { channel: { internal: false } }] }]),
          ],
        },
        include: memoryEntryInclude,
        orderBy: { updatedAt: "desc" },
        take: 80,
      });

      return {
        entries: entries.map((entry) =>
          serializeMemoryEntry(entry, userId, membership.member.role)
        ),
        state,
      };
    },
  );

  app.post(
    "/api/channels/:id/memory/suggest",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 20, timeWindow: 15 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id: channelId } = req.params as { id: string };
      const parsed = suggestMemoryBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const membership = await requireChannelMember(userId, channelId);
      if (!membership.ok) {
        return reply.status(membership.status).send({
          error: membership.error,
        });
      }
      const active = await ensureServerActive(membership.channel.serverId, reply);
      if (!active) return;

      let prompt: ReturnType<typeof memorySuggestionPrompt>;
      if ("messageId" in parsed.data) {
        const sourceMessage = await db.message.findFirst({
          where: {
            id: parsed.data.messageId,
            channelId,
            deletedAt: null,
          },
          select: {
            content: true,
            createdAt: true,
            user: { select: { displayName: true } },
          },
        });
        if (!sourceMessage) {
          return reply.status(404).send({ error: "Source message not found in this channel" });
        }
        if (!sourceMessage.content.trim()) {
          return reply.status(400).send({ error: "Source message has no text to analyze" });
        }

        prompt = memorySuggestionPrompt({
          author: sourceMessage.user?.displayName ?? "Неизвестный автор",
          createdAt: sourceMessage.createdAt.toISOString(),
          content: sourceMessage.content,
        });
      } else {
        const actionItem = await db.actionItem.findFirst({
          where: {
            id: parsed.data.actionItemId,
            channelId,
            serverId: membership.channel.serverId,
          },
          select: {
            type: true,
            status: true,
            priority: true,
            title: true,
            description: true,
            approvalStatus: true,
            approvalNote: true,
            dueAt: true,
          },
        });
        if (!actionItem) {
          return reply.status(404).send({ error: "Action item not found in this channel" });
        }
        prompt = actionItemMemorySuggestionPrompt({
          ...actionItem,
          dueAt: actionItem.dueAt?.toISOString() ?? null,
        });
      }

      try {
        const result = await chat(
          [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          {
            temperature: 0.1,
            maxTokens: 700,
            route: {
              task: "structured_extract",
              objective: "quality",
              sensitivity: "sensitive",
            },
          },
        );
        return { suggestion: parseMemorySuggestion(result.text) };
      } catch (error) {
        req.log.warn(
          {
            event: "memory_suggestion_failed",
            errorName: error instanceof Error ? error.name : "UnknownError",
          },
          "AI memory suggestion failed",
        );
        return reply.status(503).send({
          error: "AI could not prepare a memory draft. You can still edit and save the local draft.",
        });
      }
    },
  );

  app.post(
    "/api/channels/:id/memory",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id: channelId } = req.params as { id: string };
      const parsed = createMemoryBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const membership = await requireChannelMember(userId, channelId);
      if (!membership.ok) {
        return reply.status(membership.status).send({
          error: membership.error,
        });
      }
      const active = await ensureServerActive(membership.channel.serverId, reply);
      if (!active) return;

      if (parsed.data.visibility === "WORKSPACE" && membership.channel.internal) {
        return reply.status(400).send({
          error: "Internal room memory cannot be shared with the whole workspace",
        });
      }
      const ownerUserId = parsed.data.ownerUserId ?? userId;
      if (
        ownerUserId !== userId &&
        !hasPermission(membership.member.role, "MEMORY_MANAGE")
      ) {
        return reply.status(403).send({ error: "Only memory managers can assign another owner" });
      }
      if (!(await ensureMemoryOwner(membership.channel.serverId, ownerUserId))) {
        return reply.status(400).send({ error: "Memory owner is not a workspace member" });
      }
      const now = new Date();
      const reviewDueAt =
        parseGovernanceDate(parsed.data.reviewDueAt) ?? addDays(now, DEFAULT_REVIEW_DAYS);
      const expiresAt = parseGovernanceDate(parsed.data.expiresAt) ?? null;
      if (expiresAt && expiresAt <= now) {
        return reply.status(400).send({ error: "Expiration must be in the future" });
      }

      let resolvedSourceMessageId = parsed.data.sourceMessageId ?? null;
      if (parsed.data.actionItemId) {
        const actionItem = await db.actionItem.findFirst({
          where: {
            id: parsed.data.actionItemId,
            channelId,
            serverId: membership.channel.serverId,
          },
          select: { id: true, sourceMessageId: true },
        });
        if (!actionItem) {
          return reply.status(400).send({ error: "Action item not found in this channel" });
        }
        if (
          resolvedSourceMessageId &&
          resolvedSourceMessageId !== actionItem.sourceMessageId
        ) {
          return reply.status(400).send({
            error: "Source message does not belong to this action item",
          });
        }
        resolvedSourceMessageId = actionItem.sourceMessageId;
      }

      if (resolvedSourceMessageId) {
        const sourceMessage = await db.message.findFirst({
          where: {
            id: resolvedSourceMessageId,
            channelId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!sourceMessage) {
          return reply.status(400).send({ error: "Source message not found in this channel" });
        }
      }

      const entry = await db.memoryEntry.create({
        data: {
          serverId: membership.channel.serverId,
          channelId,
          kind: parsed.data.kind,
          visibility: parsed.data.visibility,
          title: parsed.data.title,
          content: parsed.data.content || null,
          tags: normalizeTags(parsed.data.tags),
          sourceMessageId: resolvedSourceMessageId,
          actionItemId: parsed.data.actionItemId ?? null,
          createdByUserId: userId,
          ownerUserId,
          reviewDueAt,
          lastReviewedAt: now,
          lastReviewedByUserId: userId,
          expiresAt,
        },
        include: memoryEntryInclude,
      });

      emitMemoryUpdated(channelId, membership.channel.serverId, entry.visibility === "WORKSPACE");

      return reply.status(201).send({
        entry: serializeMemoryEntry(entry, userId, membership.member.role),
      });
    },
  );

  app.patch(
    "/api/memory/:id",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = req.params as { id: string };
      const parsed = updateMemoryBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const membership = await requireMemoryMember(userId, id);
      if (!membership.ok) {
        return reply.status(membership.status).send({
          error: membership.error,
        });
      }
      const active = await ensureServerActive(membership.entry.serverId, reply);
      if (!active) return;
      if (
        !canManageMemoryEntry(userId, membership.member.role, membership.entry)
      ) {
        return reply.status(403).send({ error: "Only the memory owner or manager can edit it" });
      }
      if (membership.entry.archivedAt) {
        return reply.status(409).send({ error: "Restore the memory entry before editing it" });
      }
      if (
        parsed.data.visibility === "WORKSPACE" &&
        membership.entry.channel?.internal
      ) {
        return reply.status(400).send({
          error: "Internal room memory cannot be shared with the whole workspace",
        });
      }
      if (
        parsed.data.ownerUserId &&
        parsed.data.ownerUserId !== membership.entry.ownerUserId
      ) {
        if (!hasPermission(membership.member.role, "MEMORY_MANAGE")) {
          return reply.status(403).send({ error: "Only memory managers can change the owner" });
        }
        if (!(await ensureMemoryOwner(membership.entry.serverId, parsed.data.ownerUserId))) {
          return reply.status(400).send({ error: "Memory owner is not a workspace member" });
        }
      }
      const now = new Date();
      const expiresAt = parseGovernanceDate(parsed.data.expiresAt);
      if (expiresAt && expiresAt <= now) {
        return reply.status(400).send({ error: "Expiration must be in the future" });
      }
      const reviewDueAt = parseGovernanceDate(parsed.data.reviewDueAt);

      const entry = await db.memoryEntry.update({
        where: { id },
        data: {
          ...(parsed.data.kind ? { kind: parsed.data.kind } : {}),
          ...(parsed.data.title ? { title: parsed.data.title } : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "content")
            ? { content: parsed.data.content || null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "tags")
            ? { tags: normalizeTags(parsed.data.tags) }
            : {}),
          ...(parsed.data.visibility ? { visibility: parsed.data.visibility } : {}),
          ...(parsed.data.ownerUserId ? { ownerUserId: parsed.data.ownerUserId } : {}),
          ...(reviewDueAt !== undefined
            ? { reviewDueAt }
            : { reviewDueAt: addDays(now, DEFAULT_REVIEW_DAYS) }),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          lastReviewedAt: now,
          lastReviewedByUserId: userId,
        },
        include: memoryEntryInclude,
      });

      emitMemoryUpdated(
        entry.channelId,
        entry.serverId,
        membership.entry.visibility === "WORKSPACE" || entry.visibility === "WORKSPACE",
      );

      return {
        entry: serializeMemoryEntry(entry, userId, membership.member.role),
      };
    },
  );

  app.post(
    "/api/memory/:id/review",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = reviewMemoryBody.safeParse(req.body ?? {});
      if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });
      const { id } = req.params as { id: string };
      const membership = await requireMemoryMember(userId, id);
      if (!membership.ok) {
        return reply.status(membership.status).send({ error: membership.error });
      }
      if (!canManageMemoryEntry(userId, membership.member.role, membership.entry)) {
        return reply.status(403).send({ error: "Only the memory owner or manager can review it" });
      }
      if (membership.entry.archivedAt) {
        return reply.status(409).send({ error: "Restore the memory entry before reviewing it" });
      }
      const active = await ensureServerActive(membership.entry.serverId, reply);
      if (!active) return;
      const now = new Date();
      const requestedReviewDueAt = parseGovernanceDate(parsed.data.reviewDueAt);
      const entry = await db.memoryEntry.update({
        where: { id },
        data: {
          lastReviewedAt: now,
          lastReviewedByUserId: userId,
          reviewDueAt:
            requestedReviewDueAt === undefined
              ? addDays(now, DEFAULT_REVIEW_DAYS)
              : requestedReviewDueAt,
        },
        include: memoryEntryInclude,
      });
      emitMemoryUpdated(entry.channelId, entry.serverId, entry.visibility === "WORKSPACE");
      return { entry: serializeMemoryEntry(entry, userId, membership.member.role) };
    },
  );

  app.delete(
    "/api/memory/:id",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = req.params as { id: string };
      const membership = await requireMemoryMember(userId, id);
      if (!membership.ok) {
        return reply.status(membership.status).send({
          error: membership.error,
        });
      }
      const active = await ensureServerActive(membership.entry.serverId, reply);
      if (!active) return;
      if (!canManageMemoryEntry(userId, membership.member.role, membership.entry)) {
        return reply.status(403).send({ error: "Only the memory owner or manager can archive it" });
      }
      if (membership.entry.archivedAt) {
        return reply.status(409).send({ error: "Memory entry is already archived" });
      }

      const entry = await db.memoryEntry.update({
        where: { id },
        data: { archivedAt: new Date(), archivedByUserId: userId },
        include: memoryEntryInclude,
      });

      emitMemoryUpdated(entry.channelId, entry.serverId, entry.visibility === "WORKSPACE");

      return { entry: serializeMemoryEntry(entry, userId, membership.member.role) };
    },
  );

  app.post(
    "/api/memory/:id/restore",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id } = req.params as { id: string };
      const membership = await requireMemoryMember(userId, id);
      if (!membership.ok) {
        return reply.status(membership.status).send({ error: membership.error });
      }
      if (!canManageMemoryEntry(userId, membership.member.role, membership.entry)) {
        return reply.status(403).send({ error: "Only the memory owner or manager can restore it" });
      }
      if (!membership.entry.archivedAt) {
        return reply.status(409).send({ error: "Memory entry is already active" });
      }
      const active = await ensureServerActive(membership.entry.serverId, reply);
      if (!active) return;
      const now = new Date();
      const entry = await db.memoryEntry.update({
        where: { id },
        data: {
          archivedAt: null,
          archivedByUserId: null,
          lastReviewedAt: now,
          lastReviewedByUserId: userId,
          reviewDueAt: addDays(now, DEFAULT_REVIEW_DAYS),
          ...(membership.entry.expiresAt && membership.entry.expiresAt <= now
            ? { expiresAt: null }
            : {}),
        },
        include: memoryEntryInclude,
      });
      emitMemoryUpdated(entry.channelId, entry.serverId, entry.visibility === "WORKSPACE");
      return { entry: serializeMemoryEntry(entry, userId, membership.member.role) };
    },
  );
}
