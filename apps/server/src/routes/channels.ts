import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { actionItemInclude, serializeActionItem } from "../actionItems.js";
import { db } from "../db.js";
import { emitMessageOnChannel } from "../realtime.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  ATTACHMENTS_PER_MESSAGE,
  MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS,
  processAttachment,
} from "../attachments.js";

const channelTypeSchema = z.enum(["TEXT", "VOICE"]);

const createChannelBody = z.object({
  name: z.string().min(1).max(80),
  type: channelTypeSchema.optional(),
});

const attachmentInputSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(80),
  dataBase64: z.string().min(1),
});

const createMessageBody = z.object({
  /** content может быть пустым если приложены attachments. */
  content: z.string().max(8000).optional().default(""),
  attachments: z.array(attachmentInputSchema).max(ATTACHMENTS_PER_MESSAGE).optional(),
});

function slugifyBase(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
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

/**
 * Возвращает id самого старого Server'а — обычно это Default Server,
 * созданный seed-миграцией. Используется в legacy `GET/POST /api/channels`
 * для backward compat: каналы создаются и читаются в Default Server.
 *
 * После Step 2 (frontend split) клиент перейдёт на
 * `GET/POST /api/servers/:id/channels` и эти legacy endpoints можно
 * будет deprecate.
 */
async function getDefaultServerId(): Promise<string | null> {
  const s = await db.server.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return s?.id ?? null;
}

export async function registerChannelRoutes(app: FastifyInstance) {
  /**
   * GET /api/channels — legacy: каналы Default Server.
   * Frontend MVP (single-file App.tsx) использует этот endpoint до Step 2 split.
   */
  app.get("/api/channels", async () => {
    const defaultServerId = await getDefaultServerId();
    const list = await db.channel.findMany({
      where: defaultServerId ? { serverId: defaultServerId } : {},
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });
    return { channels: list };
  });

  /**
   * POST /api/channels — legacy: создание канала в Default Server.
   * Требует JWT (как и раньше). Любой авторизованный user может создать
   * канал в Default Server (он member по seed-миграции).
   */
  app.post("/api/channels", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const parsed = createChannelBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body" });
    }
    const defaultServerId = await getDefaultServerId();
    if (!defaultServerId) {
      return reply.status(500).send({ error: "Default Server missing; run npm run db:seed" });
    }
    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId: defaultServerId } },
      select: { id: true },
    });
    if (!member) {
      await db.member.create({
        data: { userId, serverId: defaultServerId, role: "MEMBER" },
      });
    }
    const base = slugifyBase(parsed.data.name);
    const slug = await uniqueSlug(base);
    const ch = await db.channel.create({
      data: {
        name: parsed.data.name,
        slug,
        serverId: defaultServerId,
        type: parsed.data.type ?? "TEXT",
      },
    });
    return {
      channel: {
        id: ch.id,
        name: ch.name,
        slug: ch.slug,
        type: ch.type,
        createdAt: ch.createdAt,
      },
    };
  });

  /**
   * GET /api/channels/:id/messages — историчная пагинация take=N, max 100.
   * Открытый endpoint (без auth) — соответствует поведению Step 0.
   * Membership check добавится после Step 2 когда фронт перейдёт на server-scoped routes.
   */
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
      include: {
        user: { select: { id: true, displayName: true, avatar: true } },
        reactions: { select: { emoji: true, userId: true } },
        attachments: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            url: true,
            width: true,
            height: true,
            thumbnailUrl: true,
            position: true,
          },
          orderBy: { position: "asc" },
        },
        actionItems: {
          include: actionItemInclude,
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    // Опционально достаём currentUserId из jwt — без auth middleware
    // (этот GET был открытый ради SSR-like preview). Делаем optional
    // jwtVerify, чтобы 'mine' помечался когда возможно.
    let currentUserId: string | null = null;
    try {
      await req.jwtVerify();
      const payload = req.user as { sub?: string } | undefined;
      currentUserId = payload?.sub ?? null;
    } catch {
      /* anonymous — mine остаётся false */
    }
    return {
      channel: { id: ch.id, name: ch.name, slug: ch.slug },
      messages: messages
        .reverse()
        .map((m) => {
          // aggregate reactions: emoji → { count, mine }
          const grouped = new Map<string, { count: number; mine: boolean }>();
          for (const r of m.reactions) {
            const cur = grouped.get(r.emoji) ?? { count: 0, mine: false };
            cur.count += 1;
            if (currentUserId && r.userId === currentUserId) cur.mine = true;
            grouped.set(r.emoji, cur);
          }
          const reactions = Array.from(grouped.entries()).map(([emoji, agg]) => ({
            emoji,
            count: agg.count,
            mine: agg.mine,
          }));
          return {
            id: m.id,
            content: m.deletedAt ? "" : m.content,
            createdAt: m.createdAt.toISOString(),
            editedAt: m.editedAt?.toISOString() ?? null,
            deletedAt: m.deletedAt?.toISOString() ?? null,
            pinnedAt: m.pinnedAt?.toISOString() ?? null,
            user: { id: m.user.id, displayName: m.user.displayName, avatar: m.user.avatar },
            reactions,
            attachments: m.deletedAt ? [] : m.attachments,
            actionItems: m.deletedAt ? [] : m.actionItems.map(serializeActionItem),
          };
        }),
    };
  });

  /**
   * POST /api/channels/:id/messages — отправка сообщения с проверкой
   * membership на server канала. Это первый эндпоинт с serverguard.
   */
  app.post(
    "/api/channels/:id/messages",
    {
      onRequest: [requireJwt],
      bodyLimit: MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS,
    },
    async (req, reply) => {
      const { id: channelId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Invalid token" });
      }
      const parsed = createMessageBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const trimmed = parsed.data.content.trim();
      const attachInputs = parsed.data.attachments ?? [];
      // Сообщение должно иметь либо content, либо attachments — пустое нельзя
      if (trimmed === "" && attachInputs.length === 0) {
        return reply.status(400).send({ error: "Message must have content or attachments" });
      }
      const ch = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true, type: true },
      });
      if (!ch) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      if (ch.type === "VOICE") {
        return reply.status(400).send({ error: "Voice channels don't support text messages" });
      }
      if (ch.serverId) {
        const member = await db.member.findUnique({
          where: { userId_serverId: { userId, serverId: ch.serverId } },
          select: { id: true },
        });
        if (!member) {
          return reply.status(403).send({ error: "Not a member of this server" });
        }
      }
      const u = await db.user.findUnique({ where: { id: userId } });
      if (!u) {
        return reply.status(401).send({ error: "User not found" });
      }
      // Создаём message сначала чтобы получить id для имени файлов
      const m = await db.message.create({
        data: { content: trimmed, userId, channelId },
        include: { user: { select: { id: true, displayName: true, avatar: true } } },
      });
      // Обрабатываем attachments
      const processedAttachments = [];
      for (let i = 0; i < attachInputs.length; i++) {
        try {
          const proc = await processAttachment(attachInputs[i], m.id, i);
          const created = await db.attachment.create({
            data: {
              messageId: m.id,
              filename: proc.filename,
              mimeType: proc.mimeType,
              size: proc.size,
              url: proc.url,
              width: proc.width,
              height: proc.height,
              thumbnailUrl: proc.thumbnailUrl,
              position: proc.position,
            },
          });
          processedAttachments.push(created);
        } catch (err) {
          // Если хоть один attachment не удался — rollback всё сообщение,
          // чтобы не было «message без обещанных файлов»
          await db.message.delete({ where: { id: m.id } });
          const msg = err instanceof Error ? err.message : "Attachment processing failed";
          return reply.status(400).send({ error: msg });
        }
      }
      const payload = {
        messageId: m.id,
        content: m.content,
        // channelId всегда set'нут — этот route только для server channels.
        channelId: m.channelId!,
        userId: m.userId,
        displayName: m.user.displayName,
        avatar: m.user.avatar,
        createdAt: m.createdAt.toISOString(),
        attachments: processedAttachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: a.url,
          width: a.width,
          height: a.height,
          thumbnailUrl: a.thumbnailUrl,
          position: a.position,
        })),
      };
      emitMessageOnChannel(m.channelId!, payload);
      return { message: payload };
    },
  );
}
