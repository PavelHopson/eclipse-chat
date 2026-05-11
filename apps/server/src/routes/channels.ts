import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { emitMessageOnChannel } from "../realtime.js";

const createChannelBody = z.object({
  name: z.string().min(1).max(80),
});

const createMessageBody = z.object({
  content: z.string().min(1).max(8000),
});

function slugifyBase(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "channel"
  );
}

async function uniqueSlug(base: string) {
  let slug = base;
  for (let n = 0; n < 20; n++) {
    const exists = await db.channel.findUnique({ where: { slug } });
    if (!exists) {
      return slug;
    }
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${base}-${Date.now()}`;
}

async function requireJwt(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    void reply.status(401).send({ error: "Unauthorized" });
  }
}

type JwtUser = { sub: string; email: string };

export async function registerChannelRoutes(app: FastifyInstance) {
  app.get("/api/channels", async () => {
    const list = await db.channel.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true, createdAt: true, _count: { select: { messages: true } } },
    });
    return { channels: list };
  });

  app.post(
    "/api/channels",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const parsed = createChannelBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const base = slugifyBase(parsed.data.name);
      const slug = await uniqueSlug(base);
      const ch = await db.channel.create({
        data: { name: parsed.data.name, slug },
      });
      return { channel: { id: ch.id, name: ch.name, slug: ch.slug, createdAt: ch.createdAt } };
    },
  );

  app.get("/api/channels/:id/messages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ch = await db.channel.findUnique({ where: { id } });
    if (!ch) {
      return reply.status(404).send({ error: "Channel not found" });
    }
    const take = Math.min(100, Math.max(1, Number((req.query as { take?: string }).take) || 50));
    const messages = await db.message.findMany({
      where: { channelId: id },
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    return {
      channel: { id: ch.id, name: ch.name, slug: ch.slug },
      messages: messages
        .reverse()
        .map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          user: { id: m.user.id, displayName: m.user.displayName },
        })),
    };
  });

  app.post(
    "/api/channels/:id/messages",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: channelId } = req.params as { id: string };
      const parsed = createMessageBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const jwt = req.user as JwtUser;
      const userId = jwt.sub;
      if (!userId) {
        return reply.status(401).send({ error: "Invalid token" });
      }
      const ch = await db.channel.findUnique({ where: { id: channelId } });
      if (!ch) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      const u = await db.user.findUnique({ where: { id: userId } });
      if (!u) {
        return reply.status(401).send({ error: "User not found" });
      }
      const m = await db.message.create({
        data: { content: parsed.data.content, userId, channelId },
        include: { user: { select: { id: true, displayName: true } } },
      });
      const payload = {
        messageId: m.id,
        content: m.content,
        channelId: m.channelId,
        userId: m.userId,
        displayName: m.user.displayName,
        createdAt: m.createdAt.toISOString(),
      };
      emitMessageOnChannel(m.channelId, payload);
      return { message: payload };
    },
  );
}
