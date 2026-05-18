import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { actionItemInclude, serializeActionItem } from "../actionItems.js";
import { db } from "../db.js";
import { serializeUser, userDisplayName } from "../lib/userView.js";
import { emitMessageOnChannel, emitActionItemCreated } from "../realtime.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  ATTACHMENTS_PER_MESSAGE,
  MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS,
  kickoffTranscription,
  processAttachment,
} from "../attachments.js";
import { maybeAutoRespond, maybeReplyToMention } from "../ai/assistant.js";
import { scheduleEmbed } from "../ai/embedSync.js";
import { scheduleAutomation } from "../automation.js";
import { fireMessageCreatedWebhooks } from "../bots/webhooks.js";
import { extractMentionTokens, resolveMentions } from "../lib/mentions.js";
import { notifyUsers } from "../lib/webPush.js";
import { fireTelegramOutgoing } from "./integrations.js";

const channelTypeSchema = z.enum(["TEXT", "VOICE", "BROADCAST", "EXECUTION"]);

const createChannelBody = z.object({
  name: z.string().min(1).max(80),
  type: channelTypeSchema.optional(),
  /// v0.74 #29 phase 1: optional auto-expiry. ISO timestamp в будущем,
  /// max 30 дней вперёд. NULL/undefined = постоянный канал.
  expiresAt: z.string().datetime().nullable().optional(),
});

const attachmentInputSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(80),
  dataBase64: z.string().min(1),
  // v0.66: optional pre-computed audio waveform peaks (Telegram-style viz).
  // 32..256 значений, каждое 0..100. Backend дополнительно validate'ит
  // — кривые игнорируются, fallback на linear progress bar.
  waveformPeaks: z.array(z.number().min(0).max(100)).min(32).max(256).optional().nullable(),
});

const createMessageBody = z.object({
  /** content может быть пустым если приложены attachments. */
  content: z.string().max(8000).optional().default(""),
  attachments: z.array(attachmentInputSchema).max(ATTACHMENTS_PER_MESSAGE).optional(),
  /**
   * Operator slash-command: создать ActionItem из этого же сообщения
   * (`/task` `/decision` `/followup` в композере). Сообщение становится
   * sourceMessage для action item — задача линкуется к видимому сообщению.
   */
  actionItem: z
    .object({ type: z.enum(["TASK", "DECISION", "FOLLOW_UP"]) })
    .optional(),
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
      where: {
        channelId: id,
        // Скрываем thread replies из main feed — они показываются в Thread panel
        parentMessageId: null,
      },
      take,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            // botProfile: 1-to-1 relation → null если user не shadow-bot.
            // Преобразуется в `user.isBot: boolean` + `user.botRole` на сериализации.
            botProfile: { select: { id: true, role: true } },
            // email нужен только чтобы детектить system AI bot
            // (system@eclipse-chat.local) — у него нет Bot record по архитектуре,
            // но он визуально должен быть BOT для @ai сообщений.
            // email НЕ отдаётся фронту, отбрасывается на serialize.
            email: true,
          },
        },
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
            transcript: true,
            transcriptStatus: true,
            transcriptError: true,
            waveformPeaks: true,
          },
          orderBy: { position: "asc" },
        },
        actionItems: {
          include: actionItemInclude,
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
        // Thread metadata: count + last reply timestamp.
        // _count efficient (один subquery), даёт UI бейдж «3 replies» без N+1.
        _count: { select: { threadReplies: true } },
        threadReplies: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
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
            user: serializeUser(m.user),
            reactions,
            attachments: m.deletedAt ? [] : m.attachments,
            actionItems: m.deletedAt ? [] : m.actionItems.map(serializeActionItem),
            threadReplyCount: m._count.threadReplies,
            threadLastReplyAt:
              m.threadReplies[0]?.createdAt.toISOString() ?? null,
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
          select: { id: true, role: true },
        });
        if (!member) {
          return reply.status(403).send({ error: "Not a member of this server" });
        }
        // BROADCAST-каналы (news/blogger): публикуют только OWNER/ADMIN/
        // MODERATOR, остальные участники — read-only подписчики.
        if (
          ch.type === "BROADCAST" &&
          member.role !== "OWNER" &&
          member.role !== "ADMIN" &&
          member.role !== "MODERATOR"
        ) {
          return reply
            .status(403)
            .send({ error: "В канал-вещание публикуют только владелец и модераторы" });
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
              waveformPeaks: proc.waveformPeaks ?? undefined,
            },
          });
          processedAttachments.push(created);
          // v0.58: fire-and-forget транскрипция аудио. Если non-audio
          // или OPENAI_API_KEY не сетап — kickoff молча skip'нёт.
          kickoffTranscription(created.id, proc.audioBuffer, proc.mimeType, proc.filename, {
            channelId,
          });
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
        // userId только что-создан этим аутентифицированным юзером (POST'нувшим
        // сообщение) — guaranteed non-null. Non-null assertion для compliance
        // с emitMessageOnChannel signature (userId: string).
        userId: m.userId!,
        displayName: userDisplayName(m.user),
        avatar: m.user?.avatar ?? null,
        // POST через requireJwt = только human users; bot пишет через
        // POST /api/bot/messages с собственным payload.
        isBot: false,
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
          // v0.66: Prisma Json field returns JsonValue; cast в number[].
          // validateWaveformPeaks гарантировал shape, либо null.
          waveformPeaks: (a.waveformPeaks as number[] | null) ?? null,
        })),
      };
      emitMessageOnChannel(m.channelId!, payload);
      // Fire-and-forget: если в сообщении @ai — assistant ответит асинхронно
      // через ~3-10s. Caller получит immediately свой message, AI reply
      // прилетит через socket.
      void maybeReplyToMention(m.channelId!, m.id, userId, m.content, app.log);
      // v0.85 #27 phase 4: human-mention push. Parse @<displayName>,
      // resolve to userIds, push (skip self, skip muted, skip event-disabled).
      // AI keywords (@ai/@pm etc) тоже могут match'нуть на реальных
      // пользователей с такими именами — это OK, оба пути fire fire-and-forget.
      const mentionTokens = extractMentionTokens(m.content);
      if (mentionTokens.length > 0 && ch.serverId) {
        const senderName = userDisplayName(m.user);
        void (async () => {
          try {
            const ids = await resolveMentions(ch.serverId, mentionTokens, userId);
            if (ids.size === 0) return;
            const preview = m.content.trim().slice(0, 140);
            await notifyUsers(
              Array.from(ids),
              "mention",
              {
                title: `Упоминание от ${senderName}`,
                body: preview || "Тебя упомянули в Eclipse Chat",
                url: `/eclipse-chat/`,
                tag: `mention-${m.channelId}-${m.id}`,
                channelId: m.channelId!,
              },
              app.log,
            );
          } catch (err) {
            app.log.warn({ err }, "mention push failed");
          }
        })();
      }
      // v0.77 #21: embed content для semantic search (no-op если AI не сетап).
      scheduleEmbed(m.id, m.content, app.log);
      // v0.80 #26 phase 1: automation engine — fire matching rules.
      const channelInfo = await db.channel.findUnique({
        where: { id: m.channelId! },
        select: { serverId: true },
      });
      if (channelInfo) {
        scheduleAutomation(
          channelInfo.serverId,
          m.channelId!,
          m.id,
          m.userId,
          m.content,
          false,
          app.log,
        );
      }
      void maybeAutoRespond(m.channelId!, m.id, userId, m.content, app.log);
      // v0.89 #26 phase 2: fire-and-forget Telegram outgoing bridge.
      // Перебирает enabled TELEGRAM_OUTGOING integrations для channel,
      // postит в TG chat. Skip если no integrations.
      void fireTelegramOutgoing(
        m.channelId!,
        userDisplayName(m.user),
        m.content,
        app.log,
      );

      // Fire-and-forget: bot webhooks (outbound POST для подписанных bots).
      fireMessageCreatedWebhooks(
        ch.serverId,
        {
          messageId: m.id,
          channelId: m.channelId!,
          serverId: ch.serverId,
          userId,
          displayName: userDisplayName(m.user),
          content: m.content,
          isBot: false,
          createdAt: m.createdAt.toISOString(),
        },
        app.log,
      );

      // Operator slash-command: создаём ActionItem из только что
      // отправленного сообщения (title = content). Линкуется к сообщению,
      // как обычный «message → task». Только для server-каналов.
      let actionItemPayload = null;
      if (parsed.data.actionItem && ch.serverId && trimmed) {
        try {
          const createdAction = await db.actionItem.create({
            data: {
              title: trimmed.replace(/\s+/g, " ").slice(0, 160),
              type: parsed.data.actionItem.type,
              serverId: ch.serverId,
              channelId: m.channelId!,
              sourceMessageId: m.id,
              createdByUserId: userId,
            },
            include: actionItemInclude,
          });
          actionItemPayload = serializeActionItem(createdAction);
          emitActionItemCreated(m.channelId!, actionItemPayload);
        } catch (err) {
          // Не критично — сообщение уже отправлено. Логируем и продолжаем.
          app.log.warn({ err, messageId: m.id }, "slash-command action item failed");
        }
      }

      return { message: payload, actionItem: actionItemPayload };
    },
  );
}
