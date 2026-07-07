import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { serializeUser, type RawUserView } from "../lib/userView.js";

const memoryKindSchema = z.enum(["NOTE", "DECISION", "RISK", "FACT", "LINK", "ACTION"]);

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(8)
  .optional();

const listMemoryQuery = z.object({
  includeServer: z.enum(["true", "false"]).optional(),
});

const createMemoryBody = z.object({
  kind: memoryKindSchema.default("NOTE"),
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().max(4000).nullable().optional(),
  tags: tagsSchema,
  sourceMessageId: z.string().trim().min(1).optional(),
  actionItemId: z.string().trim().min(1).optional(),
});

const updateMemoryBody = z
  .object({
    kind: memoryKindSchema.optional(),
    title: z.string().trim().min(1).max(180).optional(),
    content: z.string().trim().max(4000).nullable().optional(),
    tags: tagsSchema,
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

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
};

type MemoryEntryRow = {
  id: string;
  serverId: string;
  channelId: string | null;
  kind: string;
  title: string;
  content: string | null;
  tags: string | null;
  sourceMessageId: string | null;
  actionItemId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: RawUserView;
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

function serializeMemoryEntry(entry: MemoryEntryRow) {
  return {
    id: entry.id,
    serverId: entry.serverId,
    channelId: entry.channelId,
    kind: entry.kind,
    title: entry.title,
    content: entry.content,
    tags: parseTags(entry.tags),
    sourceMessageId: entry.sourceMessageId,
    actionItemId: entry.actionItemId,
    archivedAt: entry.archivedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    createdBy: serializeUser(entry.createdBy),
  };
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

async function requireMemoryMember(userId: string, memoryId: string) {
  const entry = await db.memoryEntry.findUnique({
    where: { id: memoryId },
    include: memoryEntryInclude,
  });
  if (!entry) {
    return { error: "Memory entry not found" as const };
  }

  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId: entry.serverId } },
    select: { id: true },
  });
  if (!member) {
    return { error: "Not a member of this server" as const };
  }

  return { entry };
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
      if ("error" in membership) {
        return reply.status(membership.error === "Channel not found" ? 404 : 403).send({
          error: membership.error,
        });
      }

      const includeServer = parsedQuery.data.includeServer !== "false";
      const entries = await db.memoryEntry.findMany({
        where: {
          serverId: membership.channel.serverId,
          archivedAt: null,
          OR: includeServer
            ? [{ channelId }, { channelId: null }]
            : [{ channelId }],
        },
        include: memoryEntryInclude,
        orderBy: { createdAt: "desc" },
        take: 80,
      });

      return { entries: entries.map(serializeMemoryEntry) };
    },
  );

  app.post(
    "/api/channels/:id/memory",
    { onRequest: [requireJwt] },
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
      if ("error" in membership) {
        return reply.status(membership.error === "Channel not found" ? 404 : 403).send({
          error: membership.error,
        });
      }
      const active = await ensureServerActive(membership.channel.serverId, reply);
      if (!active) return;

      if (parsed.data.sourceMessageId) {
        const sourceMessage = await db.message.findFirst({
          where: {
            id: parsed.data.sourceMessageId,
            channelId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!sourceMessage) {
          return reply.status(400).send({ error: "Source message not found in this channel" });
        }
      }

      if (parsed.data.actionItemId) {
        const actionItem = await db.actionItem.findFirst({
          where: { id: parsed.data.actionItemId, channelId },
          select: { id: true },
        });
        if (!actionItem) {
          return reply.status(400).send({ error: "Action item not found in this channel" });
        }
      }

      const entry = await db.memoryEntry.create({
        data: {
          serverId: membership.channel.serverId,
          channelId,
          kind: parsed.data.kind,
          title: parsed.data.title,
          content: parsed.data.content || null,
          tags: normalizeTags(parsed.data.tags),
          sourceMessageId: parsed.data.sourceMessageId ?? null,
          actionItemId: parsed.data.actionItemId ?? null,
          createdByUserId: userId,
        },
        include: memoryEntryInclude,
      });

      return reply.status(201).send({ entry: serializeMemoryEntry(entry) });
    },
  );

  app.patch(
    "/api/memory/:id",
    { onRequest: [requireJwt] },
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
      if ("error" in membership) {
        return reply.status(membership.error === "Memory entry not found" ? 404 : 403).send({
          error: membership.error,
        });
      }
      const active = await ensureServerActive(membership.entry.serverId, reply);
      if (!active) return;

      const entry = await db.memoryEntry.update({
        where: { id },
        data: {
          ...(parsed.data.kind ? { kind: parsed.data.kind } : {}),
          ...(parsed.data.title ? { title: parsed.data.title } : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "content")
            ? { content: parsed.data.content || null }
            : {}),
          ...(parsed.data.tags ? { tags: normalizeTags(parsed.data.tags) } : {}),
        },
        include: memoryEntryInclude,
      });

      return { entry: serializeMemoryEntry(entry) };
    },
  );

  app.delete(
    "/api/memory/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = req.params as { id: string };
      const membership = await requireMemoryMember(userId, id);
      if ("error" in membership) {
        return reply.status(membership.error === "Memory entry not found" ? 404 : 403).send({
          error: membership.error,
        });
      }
      const active = await ensureServerActive(membership.entry.serverId, reply);
      if (!active) return;

      const entry = await db.memoryEntry.update({
        where: { id },
        data: { archivedAt: new Date() },
        include: memoryEntryInclude,
      });

      return { entry: serializeMemoryEntry(entry) };
    },
  );
}
