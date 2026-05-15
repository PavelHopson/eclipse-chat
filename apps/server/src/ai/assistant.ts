import { db } from "../db.js";
import { emitMessageOnChannel } from "../realtime.js";
import { chat, isAiConfigured } from "./provider.js";
import { assistantPrompt } from "./prompts.js";
import { botRolePrompt, type BotRoleValue } from "./botRoles.js";
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

/**
 * Mention-detector с role-resolution.
 *
 * Поддерживает:
 *   `@ai` / `@AI` / `@ии` / `@Аи`               → GENERIC
 *   `@moderator` / `@мод` / `@модератор`        → MODERATOR
 *   `@pm` / `@менеджер`                          → PM
 *   `@knowledge` / `@знания` / `@kb`             → KNOWLEDGE
 *   `@sales` / `@продажи`                        → SALES
 *
 * Все keyword'ы — case-insensitive, должны стоять как отдельное слово
 * (lookbehind на start/whitespace, lookahead на end/whitespace/пунктуацию).
 *
 * Если в одном сообщении несколько mention'ов — берётся первый.
 */
type AiMentionMatch = { role: BotRoleValue; keyword: string };

const AI_MENTION_KEYWORDS: ReadonlyArray<{ kw: string; role: BotRoleValue }> = [
  // Specific roles прежде GENERIC — match-order matters при overlapping
  // (e.g. "ai" — это GENERIC, не должен ловить "@aimoderator" etc — но из-за
  // \b boundary это safe).
  { kw: "moderator", role: "MODERATOR" },
  { kw: "модератор", role: "MODERATOR" },
  { kw: "мод", role: "MODERATOR" },
  { kw: "pm", role: "PM" },
  { kw: "менеджер", role: "PM" },
  { kw: "knowledge", role: "KNOWLEDGE" },
  { kw: "kb", role: "KNOWLEDGE" },
  { kw: "знания", role: "KNOWLEDGE" },
  { kw: "sales", role: "SALES" },
  { kw: "продажи", role: "SALES" },
  // Generic — традиционные ai/ии триггеры
  { kw: "ai", role: "GENERIC" },
  { kw: "ии", role: "GENERIC" },
  { kw: "аи", role: "GENERIC" },
];

/** Превращаем список в alternation, sorted by length desc (long first). */
const KEYWORDS_ALT = [...AI_MENTION_KEYWORDS]
  .map((k) => k.kw)
  .sort((a, b) => b.length - a.length)
  .join("|");

/**
 * Капчурим keyword чтобы определить роль. Boundary lookbehind/lookahead
 * предотвращает match'и внутри слов (`@aimoderator` не сматчит `@ai`).
 */
const AI_MENTION_REGEX = new RegExp(
  `(?:^|\\s)@(${KEYWORDS_ALT})(?=\\s|$|[?.!,;:])`,
  "iu",
);

/** Найдено ли любое role-mention в content'е. */
export function detectAiMention(content: string): boolean {
  return AI_MENTION_REGEX.test(content);
}

/**
 * Resolve role + matched keyword. Null если нет mention'а. Берётся первый
 * (если несколько — игнорируем остальные).
 */
export function resolveAiMention(content: string): AiMentionMatch | null {
  const m = AI_MENTION_REGEX.exec(content);
  if (!m || !m[1]) return null;
  const kw = m[1].toLowerCase();
  const entry = AI_MENTION_KEYWORDS.find((e) => e.kw === kw);
  if (!entry) return null;
  return { role: entry.role, keyword: kw };
}

/**
 * Стрипаем все известные role-mention'ы из текста.
 *
 * Cyrillic-safe boundaries:
 *   - lookbehind `(?<=^|\s)` — `@` должен быть в начале строки или после
 *     whitespace. Защита от удаления `@ai` внутри email-подобных строк
 *     (`user@ai.com`).
 *   - lookahead `(?![\p{L}\p{N}_])` — после keyword'а НЕ должно быть
 *     unicode word char'а. JS `\b` использует ASCII `\w` даже с `u` флагом,
 *     поэтому для кириллицы стандартный `\b` НЕ работает; используем явный
 *     unicode property escape.
 */
const STRIP_REGEX = new RegExp(
  `(?<=^|\\s)@(?:${KEYWORDS_ALT})(?![\\p{L}\\p{N}_])`,
  "giu",
);
export function stripAiMention(content: string): string {
  return content.replace(STRIP_REGEX, "").replace(/\s+/g, " ").trim();
}

const pendingByChannel = new Map<string, number>();
const THROTTLE_MS = 20_000;

let cachedSystemUserId: string | null = null;

async function getSystemUserId(): Promise<string | null> {
  if (cachedSystemUserId) return cachedSystemUserId;
  // System user был создан в seed-migration с email system@eclipse-chat.local.
  // Если нет такого user — fallback на самого старого user'а (обычно OWNER).
  const sys = await db.user.findFirst({
    where: { email: "system@eclipse-chat.local" },
    select: { id: true },
  });
  if (sys) {
    cachedSystemUserId = sys.id;
    return sys.id;
  }
  const oldest = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  cachedSystemUserId = oldest?.id ?? null;
  return cachedSystemUserId;
}

/**
 * Responder для AI-reply на role-mention.
 *
 * Priority (v0.33+):
 *   1. Если есть Bot row в server с подходящей `role` → отвечает он.
 *      Bot.userId (shadow user) становится author'ом сообщения, frontend
 *      рисует bot's avatar + role-badge через стандартную сериализацию
 *      (m.user.botProfile?.role в channels.ts route).
 *   2. Иначе fallback на system @ai (system@eclipse-chat.local) с
 *      role-prompt'ом — наследственное поведение v0.29+.
 *
 * Это превращает Bot row из «shadow user posting via REST» в
 * «embedded room participant» — обещание AI Agents типологии (#6 brief).
 *
 * GENERIC role не lookup'ит Bot — generic mention обслуживается system @ai
 * чтобы не дёргать случайный generic-bot в server'е (например telegram-bridge).
 */
export async function getResponderForRole(
  serverId: string,
  role: BotRoleValue,
): Promise<{ userId: string; isRealBot: boolean } | null> {
  if (role !== "GENERIC") {
    const bot = await db.bot.findFirst({
      where: { serverId, role },
      orderBy: { createdAt: "asc" },
      select: { userId: true, capabilities: true },
    });
    if (bot) {
      // Bot должен иметь capability send_message (default yes).
      let caps: string[] = [];
      try {
        caps = JSON.parse(bot.capabilities) as string[];
      } catch {
        /* fallback empty */
      }
      if (caps.includes("send_message")) {
        return { userId: bot.userId, isRealBot: true };
      }
    }
  }
  const sys = await getSystemUserId();
  if (!sys) return null;
  return { userId: sys, isRealBot: false };
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
  const mention = resolveAiMention(triggerContent);
  if (!mention) return;

  // Throttle
  const lastAt = pendingByChannel.get(channelId);
  const now = Date.now();
  if (lastAt && now - lastAt < THROTTLE_MS) {
    log.debug({ channelId, role: mention.role }, "AI mention throttled");
    return;
  }
  pendingByChannel.set(channelId, now);

  // Не блокируем route — true fire-and-forget
  void (async () => {
    try {
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, name: true, type: true, serverId: true },
      });
      if (!channel || channel.type !== "TEXT") return;

      // Resolve responder: real Bot row с подходящей role > system @ai.
      const responder = await getResponderForRole(channel.serverId, mention.role);
      if (!responder || responder.userId === triggerUserId) {
        // Нет responder ИЛИ это сам же триггерящий юзер
        return;
      }
      const botId = responder.userId;

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

      // Базовый user-prompt с контекстом канала (open actions / pinned / recent).
      // System message замещаем role-aware: GENERIC = старый assistantPrompt
      // (наследственный generic operator-tone), остальные роли — из botRolePrompt.
      const basePrompt = assistantPrompt({
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
      const systemPrompt =
        mention.role === "GENERIC" ? basePrompt.system : botRolePrompt(mention.role);

      const result = await chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: basePrompt.user },
        ],
        { temperature: 0.5, maxTokens: 450 },
      );

      // Постим как сообщение от responder'а в канал (real Bot OR system @ai)
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
        // Real Bot row: isBot=true + botProfile resolution даст role-badge
        // на reload. System @ai: isBot=true (email-check в channels.ts),
        // botRole в realtime payload — на reload botRole=null (нет Bot row).
        isBot: true,
        botRole: mention.role,
        createdAt: reply.createdAt.toISOString(),
      });
      log.info(
        {
          channelId,
          role: mention.role,
          keyword: mention.keyword,
          responder: responder.isRealBot ? "bot-row" : "system-ai",
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
