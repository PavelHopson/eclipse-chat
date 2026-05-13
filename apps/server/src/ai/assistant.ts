import { db } from "../db.js";
import { emitMessageOnChannel } from "../realtime.js";
import { chat, isAiConfigured } from "./provider.js";
import { assistantPrompt } from "./prompts.js";
import type { FastifyBaseLogger } from "fastify";

/**
 * @ai mention assistant.
 *
 * При detection `@ai` в новом сообщении канала — выполняем fire-and-forget
 * background-job: собрать контекст (open actions + pinned + last 20 msgs) →
 * скормить LLM → запостить ответ от system-bot в тот же канал.
 *
 * System-bot user — самый старый user в БД (создан seed-migration в v0.4 как
 * `system@eclipse-chat.local`). Используем его id для авторства AI-сообщений,
 * чтобы они выглядели как обычные сообщения, но визуально отличались (frontend
 * детектит по email домену или специальному префиксу).
 *
 * Защиты:
 *   - Только если AI configured (isAiConfigured).
 *   - Только если text-канал (VOICE — skip).
 *   - Throttle: один pending request per channel — дубль-mention в течение
 *     20 секунд игнорируется.
 *   - Bot не отвечает на свои собственные сообщения (избегаем циклов).
 */

/** Regex: `@ai`, `@AI`, `@Аи` etc., как отдельное слово. */
const AI_MENTION_REGEX = /(?:^|\s)@(?:ai|ии|AI|Аи)(?=\s|$|[?.!,])/iu;

export function detectAiMention(content: string): boolean {
  return AI_MENTION_REGEX.test(content);
}

/** Стрипаем @ai (любой регистр) из текста, оставляем остальное. */
export function stripAiMention(content: string): string {
  return content.replace(/@(?:ai|ии|AI|Аи)\b/giu, "").trim();
}

const pendingByChannel = new Map<string, number>();
const THROTTLE_MS = 20_000;

let cachedBotUserId: string | null = null;

async function getBotUserId(): Promise<string | null> {
  if (cachedBotUserId) return cachedBotUserId;
  // System user был создан в seed-migration с email system@eclipse-chat.local.
  // Если нет такого user — fallback на самого старого user'а (обычно OWNER).
  const sys = await db.user.findFirst({
    where: { email: "system@eclipse-chat.local" },
    select: { id: true },
  });
  if (sys) {
    cachedBotUserId = sys.id;
    return sys.id;
  }
  const oldest = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  cachedBotUserId = oldest?.id ?? null;
  return cachedBotUserId;
}

/**
 * Fire-and-forget triggered из POST /api/channels/:id/messages когда message
 * содержит @ai. Caller не ждёт — return обычное message immediately, AI
 * reply прилетит через socket через ~3-10 секунд.
 */
export async function maybeReplyToMention(
  channelId: string,
  triggerMessageId: string,
  triggerUserId: string,
  triggerContent: string,
  log: FastifyBaseLogger,
): Promise<void> {
  if (!isAiConfigured()) return;
  if (!detectAiMention(triggerContent)) return;

  // Throttle
  const lastAt = pendingByChannel.get(channelId);
  const now = Date.now();
  if (lastAt && now - lastAt < THROTTLE_MS) {
    log.debug({ channelId }, "AI mention throttled");
    return;
  }
  pendingByChannel.set(channelId, now);

  const botId = await getBotUserId();
  if (!botId || botId === triggerUserId) {
    // Bot не должен отвечать на собственные сообщения
    return;
  }

  // Не блокируем route — true fire-and-forget
  void (async () => {
    try {
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, name: true, type: true, serverId: true },
      });
      if (!channel || channel.type !== "TEXT") return;

      // Контекст
      const userInfo = await db.user.findUnique({
        where: { id: triggerUserId },
        select: { displayName: true },
      });
      const openActions = await db.actionItem.findMany({
        where: { channelId, status: "OPEN" },
        include: {
          assignee: { select: { displayName: true } },
        },
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 20,
      });
      const pinned = await db.message.findMany({
        where: { channelId, pinnedAt: { not: null }, deletedAt: null },
        orderBy: { pinnedAt: "desc" },
        take: 5,
        select: {
          content: true,
          user: { select: { displayName: true } },
        },
      });
      const recent = await db.message.findMany({
        where: { channelId, deletedAt: null, id: { not: triggerMessageId } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { displayName: true } },
        },
      });

      const prompt = assistantPrompt({
        channelName: channel.name,
        userQuery: stripAiMention(triggerContent),
        userDisplayName: userInfo?.displayName ?? "user",
        recentMessages: recent
          .reverse()
          .map((m) => ({
            displayName: m.user.displayName,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
        openActions: openActions.map((a) => ({
          type: a.type,
          title: a.title,
          dueAt: a.dueAt?.toISOString() ?? null,
          assignee: a.assignee ? { displayName: a.assignee.displayName } : null,
          status: a.status,
        })),
        pinned: pinned.map((p) => ({
          content: p.content,
          user: { displayName: p.user.displayName },
        })),
      });

      const result = await chat(
        [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        { temperature: 0.5, maxTokens: 450 },
      );

      // Постим как сообщение от system-bot в канал
      const botUser = await db.user.findUnique({
        where: { id: botId },
        select: { id: true, displayName: true, avatar: true },
      });
      if (!botUser) return;

      const reply = await db.message.create({
        data: {
          content: result.text,
          userId: botId,
          channelId,
        },
      });
      emitMessageOnChannel(channelId, {
        messageId: reply.id,
        content: reply.content,
        channelId,
        userId: botUser.id,
        displayName: botUser.displayName,
        avatar: botUser.avatar,
        createdAt: reply.createdAt.toISOString(),
      });
      log.info(
        {
          channelId,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          promptTokens: result.promptTokens,
        },
        "AI assistant replied",
      );
    } catch (err) {
      log.warn({ err, channelId }, "AI assistant failed");
      // Не отправляем error в чат — silent fail. User видит свой message,
      // просто без ответа. Это лучше чем «AI fail» спам в канале.
      pendingByChannel.delete(channelId);
    }
  })();
}
