import { z } from "zod";
import { db } from "../../db.js";
import { emitMessageOnChannel } from "../../realtime.js";
import type { Tool } from "./types.js";

/**
 * v1.2.28 — post_message: бот пишет в указанный канал того же сервера.
 *
 * Safety:
 *   - channel.serverId === ctx.serverId (нельзя писать в чужой server).
 *   - channel.type === TEXT (не VOICE / EXECUTION).
 *   - Server не suspended.
 *   - content max 4000 chars (lower чем human messages — bot не нужен длинный текст).
 *   - Не emit'ит для BotsTab webhooks (deliberate: чтобы не triggered loop).
 *
 * Возвращает messageId — LLM может ссылаться на него в дальнейшем reasoning'е.
 */

const argsSchema = z.object({
  channel_id: z.string().min(1).describe("ID канала, в который писать"),
  content: z.string().min(1).max(4000).describe("Текст сообщения"),
});

type Args = z.infer<typeof argsSchema>;
type Result = { message_id: string; channel_id: string };

export const postMessageTool: Tool<Args, Result> = {
  name: "post_message",
  description:
    "Опубликовать сообщение в TEXT-канал текущего сервера от имени бота. Используй для общения, ответов, отчётов. Не для создания задач — для задач есть create_task.",
  parameters: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description:
          "ID канала. Используй ID канала-источника если хочешь ответить в той же комнате, или ID другого канала чтобы перенаправить.",
      },
      content: {
        type: "string",
        description: "Текст сообщения (markdown поддерживается, max 4000 chars).",
      },
    },
    required: ["channel_id", "content"],
    additionalProperties: false,
  },
  async execute(rawArgs, ctx) {
    const parsed = argsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, error: `Invalid args: ${parsed.error.issues[0]?.message ?? "schema"}` };
    }
    const { channel_id, content } = parsed.data;
    const channel = await db.channel.findUnique({
      where: { id: channel_id },
      select: { id: true, serverId: true, type: true, name: true },
    });
    if (!channel) return { ok: false, error: `Канал ${channel_id} не найден` };
    if (channel.serverId !== ctx.serverId) {
      return { ok: false, error: "Канал не из текущего сервера" };
    }
    if (channel.type !== "TEXT") {
      return { ok: false, error: `Tool post_message работает только в TEXT-каналах (этот: ${channel.type})` };
    }
    const server = await db.server.findUnique({
      where: { id: ctx.serverId },
      select: { suspendedAt: true },
    });
    if (!server || server.suspendedAt != null) {
      return { ok: false, error: "Сервер заморожен или удалён — постинг недоступен" };
    }

    const trimmed = content.trim();
    if (!trimmed) return { ok: false, error: "Пустое сообщение" };

    const msg = await db.message.create({
      data: {
        content: trimmed,
        userId: ctx.botUserId,
        channelId: channel.id,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            email: true,
            botProfile: { select: { id: true, role: true } },
          },
        },
      },
    });

    // msg.user здесь non-null т.к. userId был только что создан.
    // Defensive guard — на случай race с user-delete.
    if (msg.user) {
      emitMessageOnChannel(channel.id, {
        messageId: msg.id,
        channelId: channel.id,
        userId: ctx.botUserId,
        displayName: msg.user.displayName,
        avatar: msg.user.avatar,
        content: trimmed,
        isBot: true,
        botRole: msg.user.botProfile?.role ?? null,
        createdAt: msg.createdAt.toISOString(),
        attachments: [],
      });
    }

    ctx.log.info(
      { tool: "post_message", botUserId: ctx.botUserId, channelId: channel.id, msgId: msg.id },
      "Bot tool executed",
    );

    return { ok: true, data: { message_id: msg.id, channel_id: channel.id } };
  },
};
