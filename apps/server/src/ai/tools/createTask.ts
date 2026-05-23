import { z } from "zod";
import { db } from "../../db.js";
import { actionItemInclude, serializeActionItem } from "../../actionItems.js";
import { emitActionItemCreated, emitMessageOnChannel } from "../../realtime.js";
import type { Tool } from "./types.js";

/**
 * v1.2.28 — create_task: бот создаёт ActionItem (TASK / DECISION / FOLLOW_UP).
 *
 * Architecture note: ActionItem требует `sourceMessageId` (FK). Tool сам создаёт
 * source-message от имени бота вида «📋 Задача: <title>» — это даёт users
 * visible trace в чате + удовлетворяет schema. Иначе bot не может ставить
 * задачи «из воздуха».
 *
 * Safety:
 *   - channel.serverId === ctx.serverId.
 *   - assignee_email (если задан) — member текущего сервера. Используем email
 *     потому что LLM легче генерирует email (видит в message history) чем cuid.
 *   - due_at ISO timestamp в будущем (если задан).
 */

const argsSchema = z.object({
  channel_id: z.string().min(1).describe("ID канала, к которому привязать задачу"),
  title: z.string().min(1).max(280).describe("Краткая формулировка задачи"),
  type: z.enum(["TASK", "DECISION", "FOLLOW_UP"]).default("TASK").describe("Тип: TASK / DECISION / FOLLOW_UP"),
  assignee_email: z
    .string()
    .email()
    .optional()
    .describe("Email участника-исполнителя (опц.). Должен быть member сервера."),
  due_at: z
    .string()
    .datetime()
    .optional()
    .describe("ISO timestamp дедлайна (опц., в будущем)."),
});

type Args = z.infer<typeof argsSchema>;
type Result = { action_id: string; title: string; type: string; assignee_user_id: string | null };

export const createTaskTool: Tool<Args, Result> = {
  name: "create_task",
  description:
    "Создать задачу / решение / follow-up в канале текущего сервера. Используй когда из обсуждения вытекает action-item, который нужно зафиксировать и трекать. По умолчанию type=TASK.",
  parameters: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description: "ID канала. Обычно канал-источник обсуждения.",
      },
      title: {
        type: "string",
        description: "Что нужно сделать (до 280 chars).",
      },
      type: {
        type: "string",
        enum: ["TASK", "DECISION", "FOLLOW_UP"],
        description: "TASK (default) — задача. DECISION — зафиксированное решение. FOLLOW_UP — напоминание вернуться.",
      },
      assignee_email: {
        type: "string",
        description: "Email исполнителя (опц.). Бери только из текущего разговора — не выдумывай.",
      },
      due_at: {
        type: "string",
        description: "ISO 8601 timestamp дедлайна, в будущем (опц.).",
      },
    },
    required: ["channel_id", "title"],
    additionalProperties: false,
  },
  async execute(rawArgs, ctx) {
    const parsed = argsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, error: `Invalid args: ${parsed.error.issues[0]?.message ?? "schema"}` };
    }
    const { channel_id, title, type, assignee_email, due_at } = parsed.data;

    const channel = await db.channel.findUnique({
      where: { id: channel_id },
      select: { id: true, serverId: true },
    });
    if (!channel) return { ok: false, error: `Канал ${channel_id} не найден` };
    if (channel.serverId !== ctx.serverId) {
      return { ok: false, error: "Канал не из текущего сервера" };
    }

    let assigneeUserId: string | null = null;
    if (assignee_email) {
      const assignee = await db.user.findUnique({
        where: { email: assignee_email.toLowerCase() },
        select: { id: true },
      });
      if (!assignee) {
        return { ok: false, error: `Пользователь ${assignee_email} не найден` };
      }
      const membership = await db.member.findUnique({
        where: { userId_serverId: { userId: assignee.id, serverId: ctx.serverId } },
        select: { id: true },
      });
      if (!membership) {
        return { ok: false, error: `${assignee_email} не участник этого сервера` };
      }
      assigneeUserId = assignee.id;
    }

    if (due_at) {
      const ts = Date.parse(due_at);
      if (Number.isNaN(ts) || ts < Date.now() - 60_000) {
        return { ok: false, error: "due_at должно быть валидным ISO timestamp в будущем" };
      }
    }

    const cleanTitle = title.trim();
    const typeLabel = type === "TASK" ? "Задача" : type === "DECISION" ? "Решение" : "Follow-up";

    // Source message — visible footprint в чате (required FK на ActionItem).
    const sourceMessage = await db.message.create({
      data: {
        channelId: channel.id,
        userId: ctx.botUserId,
        content: `📋 ${typeLabel}: ${cleanTitle}`,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            botProfile: { select: { role: true } },
          },
        },
      },
    });
    if (sourceMessage.user) {
      emitMessageOnChannel(channel.id, {
        messageId: sourceMessage.id,
        channelId: channel.id,
        userId: ctx.botUserId,
        displayName: sourceMessage.user.displayName,
        avatar: sourceMessage.user.avatar,
        content: sourceMessage.content,
        isBot: true,
        botRole: sourceMessage.user.botProfile?.role ?? null,
        createdAt: sourceMessage.createdAt.toISOString(),
        attachments: [],
      });
    }

    const created = await db.actionItem.create({
      data: {
        title: cleanTitle,
        type,
        serverId: ctx.serverId,
        channelId: channel.id,
        sourceMessageId: sourceMessage.id,
        createdByUserId: ctx.botUserId,
        assigneeUserId: assigneeUserId ?? undefined,
        dueAt: due_at ? new Date(due_at) : undefined,
        activities: {
          create: {
            userId: ctx.botUserId,
            type: "CREATED",
            payload: JSON.stringify({
              source: "agent_tool",
              tool: "create_task",
              botName: ctx.botName,
              type,
            }),
          },
        },
      },
      include: actionItemInclude,
    });

    const payload = serializeActionItem(created);
    emitActionItemCreated(channel.id, payload);

    ctx.log.info(
      {
        tool: "create_task",
        botUserId: ctx.botUserId,
        actionId: created.id,
        type,
        assigneeUserId,
      },
      "Bot tool executed",
    );

    return {
      ok: true,
      data: {
        action_id: created.id,
        title: created.title,
        type: created.type,
        assignee_user_id: created.assigneeUserId ?? null,
      },
    };
  },
};
