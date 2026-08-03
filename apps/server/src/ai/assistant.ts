import { db } from "../db.js";
import { userDisplayName } from "../lib/userView.js";
import { emitBotTyping, emitMessageOnChannel } from "../realtime.js";
import { chat, isAiConfigured } from "./provider.js";
import { assistantPrompt } from "./prompts.js";
import { resolveBotSystemPrompt, type BotRoleValue } from "./botRoles.js";
import { attemptCreateRowFromMention } from "./taskFromChat.js";
import { runAgentLoop } from "./agentLoop.js";
import type { FastifyBaseLogger } from "fastify";
import {
  canAccessBotChannel,
  parseAllowedChannelIds,
  parseBotCapabilities,
  type BotCapability,
} from "./botAccess.js";

/**
 * @ai mention assistant + Bot v3 autoRespond.
 *
 * При detection `@ai` / role-mentions — fire-and-forget background reply.
 * При `Bot.autoRespond` — ответ на каждое human-сообщение в TEXT-канале
 * сервера (без @mention), один бот (oldest createdAt).
 *
 * Защиты:
 *   - isAiConfigured
 *   - TEXT channels only
 *   - Throttle 20s per channel
 *   - Bot не отвечает на bot-сообщения
 *   - Mention path и autoRespond не дублируются
 */

type AiMentionMatch = { role: BotRoleValue; keyword: string };

const AI_MENTION_KEYWORDS: ReadonlyArray<{ kw: string; role: BotRoleValue }> = [
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
  // v0.74 #18 phase 1: новые роли.
  { kw: "support", role: "SUPPORT" },
  { kw: "поддержка", role: "SUPPORT" },
  { kw: "хелп", role: "SUPPORT" },
  { kw: "architect", role: "ARCHITECT" },
  { kw: "архитектор", role: "ARCHITECT" },
  { kw: "арх", role: "ARCHITECT" },
  { kw: "ai", role: "GENERIC" },
  { kw: "ии", role: "GENERIC" },
  { kw: "аи", role: "GENERIC" },
];

const KEYWORDS_ALT = [...AI_MENTION_KEYWORDS]
  .map((k) => k.kw)
  .sort((a, b) => b.length - a.length)
  .join("|");

const AI_MENTION_REGEX = new RegExp(
  `(?:^|\\s)@(${KEYWORDS_ALT})(?=\\s|$|[?.!,;:])`,
  "iu",
);

const STRIP_REGEX = new RegExp(
  `(?<=^|\\s)@(?:${KEYWORDS_ALT})(?![\\p{L}\\p{N}_])`,
  "giu",
);

export function detectAiMention(content: string): boolean {
  return AI_MENTION_REGEX.test(content);
}

export function resolveAiMention(content: string): AiMentionMatch | null {
  const m = AI_MENTION_REGEX.exec(content);
  if (!m || !m[1]) return null;
  const kw = m[1].toLowerCase();
  const entry = AI_MENTION_KEYWORDS.find((e) => e.kw === kw);
  if (!entry) return null;
  return { role: entry.role, keyword: kw };
}

export function stripAiMention(content: string): string {
  return content.replace(STRIP_REGEX, "").replace(/\s+/g, " ").trim();
}

const pendingByChannel = new Map<string, number>();
const THROTTLE_MS = 20_000;

let cachedSystemUserId: string | null = null;

async function getSystemUserId(): Promise<string | null> {
  if (cachedSystemUserId) return cachedSystemUserId;
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

export type BotResponder = {
  botId: string | null;
  userId: string;
  role: BotRoleValue;
  displayName: string;
  systemPromptOverride: string | null;
  /** v1.2.27 — character/humor overlay (см. botRoles.ts). */
  personality: string | null;
  /** v1.2.29 — capabilities из Bot row (`agent` → tool-use loop). */
  capabilities: BotCapability[];
  allowedChannelIds: string[] | null;
  isRealBot: boolean;
};

export async function getResponderForRole(
  serverId: string,
  role: BotRoleValue,
  channelId?: string,
): Promise<BotResponder | null> {
  if (role !== "GENERIC") {
    const bots = await db.bot.findMany({
      where: { serverId, role },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        role: true,
        capabilities: true,
        allowedChannelIds: true,
        systemPromptOverride: true,
        personality: true,
        user: { select: { displayName: true } },
      },
    });
    for (const bot of bots) {
      const caps = parseBotCapabilities(bot.capabilities);
      const allowedChannelIds = parseAllowedChannelIds(bot.allowedChannelIds);
      if (
        caps.includes("send_message") &&
        (!channelId || canAccessBotChannel(allowedChannelIds, channelId))
      ) {
        return {
          botId: bot.id,
          userId: bot.userId,
          role: bot.role as BotRoleValue,
          displayName: bot.user.displayName,
          systemPromptOverride: bot.systemPromptOverride,
          personality: bot.personality,
          capabilities: caps,
          allowedChannelIds,
          isRealBot: true,
        };
      }
    }
    // A configured role must not fall through to the unscoped system user.
    if (bots.length > 0) return null;
  }
  const sys = await getSystemUserId();
  if (!sys) return null;
  const user = await db.user.findUnique({
    where: { id: sys },
    select: { displayName: true },
  });
  return {
    botId: null,
    userId: sys,
    role: "GENERIC",
    displayName: user?.displayName ?? "AI",
    systemPromptOverride: null,
    personality: null,
    capabilities: [],
    allowedChannelIds: null,
    isRealBot: false,
  };
}

async function isBotUserId(userId: string): Promise<boolean> {
  const row = await db.bot.findUnique({
    where: { userId },
    select: { id: true },
  });
  return Boolean(row);
}

function tryAcquireChannelThrottle(channelId: string, log: FastifyBaseLogger): boolean {
  const lastAt = pendingByChannel.get(channelId);
  const now = Date.now();
  if (lastAt && now - lastAt < THROTTLE_MS) {
    log.debug({ channelId }, "AI/bot reply throttled");
    return false;
  }
  pendingByChannel.set(channelId, now);
  return true;
}

type ChannelContext = {
  channel: { id: string; name: string; serverId: string };
  userQuery: string;
  userDisplayName: string;
  basePrompt: ReturnType<typeof assistantPrompt>;
};

async function loadChannelContext(
  channelId: string,
  triggerMessageId: string,
  triggerUserId: string,
  triggerContent: string,
): Promise<ChannelContext | null> {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, name: true, type: true, serverId: true },
  });
  if (!channel || channel.type !== "TEXT") return null;

  const userInfo = await db.user.findUnique({
    where: { id: triggerUserId },
    select: { displayName: true },
  });
  const openActions = await db.actionItem.findMany({
    where: { channelId, status: "OPEN" },
    include: { assignee: { select: { displayName: true } } },
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
    include: { user: { select: { displayName: true } } },
  });

  const basePrompt = assistantPrompt({
    channelName: channel.name,
    userQuery: stripAiMention(triggerContent),
    userDisplayName: userInfo?.displayName ?? "user",
    recentMessages: recent
      .reverse()
      .map((m) => ({
        displayName: userDisplayName(m.user),
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
      user: { displayName: userDisplayName(p.user) },
    })),
  });

  return {
    channel: { id: channel.id, name: channel.name, serverId: channel.serverId },
    userQuery: stripAiMention(triggerContent),
    userDisplayName: userInfo?.displayName ?? "user",
    basePrompt,
  };
}

async function executeChannelBotReply(params: {
  channelId: string;
  triggerMessageId: string;
  triggerUserId: string;
  triggerContent: string;
  responder: BotResponder;
  mentionRole: BotRoleValue;
  log: FastifyBaseLogger;
  source: "mention" | "auto_respond";
}): Promise<void> {
  const { channelId, triggerMessageId, triggerUserId, responder, mentionRole, log, source } =
    params;

  if (responder.userId === triggerUserId) return;
  if (
    responder.isRealBot &&
    !canAccessBotChannel(responder.allowedChannelIds, channelId)
  ) return;

  const ctx = await loadChannelContext(
    channelId,
    triggerMessageId,
    triggerUserId,
    params.triggerContent,
  );
  if (!ctx) return;

  const promptRole = responder.isRealBot ? responder.role : mentionRole;
  const genericAssistant =
    mentionRole === "GENERIC" && !responder.isRealBot ? ctx.basePrompt.system : undefined;
  const baseSystemPrompt = resolveBotSystemPrompt(
    promptRole,
    responder.systemPromptOverride,
    genericAssistant,
    responder.personality,
  );

  emitBotTyping(channelId, {
    channelId,
    userId: responder.userId,
    displayName: responder.displayName,
    botRole: promptRole,
  });

  // v1.2.29 — agent mode: если bot имеет capability "agent" → tool-use loop.
  // Иначе — старый flow (обычный chat без tools).
  const agentMode = responder.isRealBot && responder.capabilities.includes("agent");

  let replyText: string;
  let providerLabel: string;
  let modelLabel: string | null = null;
  let latencyMs: number;
  let toolCallCount = 0;

  if (agentMode) {
    const availableToolLines = [
      responder.capabilities.includes("send_message")
        ? "- `post_message(channel_id, content)` — написать в другую разрешённую комнату."
        : null,
      responder.capabilities.includes("create_task")
        ? "- `create_task(channel_id, title, type?, assignee_email?, due_at?)` — создать задачу или решение."
        : null,
      responder.capabilities.includes("update_table_row")
        ? "- `update_table_row(table_id, row_id, cell_updates[])` — обновить строку разрешённой operational table."
        : null,
    ].filter((line): line is string => line !== null);
    const augmented =
      baseSystemPrompt +
      "\n\n## Доступные инструменты\n" +
      (availableToolLines.length > 0
        ? `${availableToolLines.join("\n")}\n\n`
        : "Действия не разрешены: отвечай только текстом.\n\n") +
      "## Контекст\n" +
      `- channel_id (текущий): ${ctx.channel.id}\n` +
      `- channel name: #${ctx.channel.name}\n` +
      `- server_id: ${ctx.channel.serverId}\n\n` +
      "Если задача требует действия — вызови нужный tool. Если просто ответить — пиши текстом. Не вызывай post_message для текущего канала — твой финальный текст и так попадёт сюда.";

    const result = await runAgentLoop({
      systemPrompt: augmented,
      initialMessages: [{ role: "user", content: ctx.basePrompt.user }],
      toolContext: {
        botId: responder.botId ?? responder.userId,
        botUserId: responder.userId,
        botName: responder.displayName,
        serverId: ctx.channel.serverId,
        channelId,
        capabilities: responder.capabilities,
        allowedChannelIds: responder.allowedChannelIds,
        log,
      },
      log,
      temperature: 0.5,
    });
    replyText = result.text;
    providerLabel = result.provider;
    latencyMs = result.latencyMs;
    toolCallCount = result.toolCallCount;
  } else {
    const result = await chat(
      [
        { role: "system", content: baseSystemPrompt },
        { role: "user", content: ctx.basePrompt.user },
      ],
      {
        temperature: 0.5,
        maxTokens: 450,
        route: {
          task: "conversation",
          objective: "balanced",
          sensitivity: "sensitive",
        },
      },
    );
    replyText = result.text;
    providerLabel = result.provider;
    modelLabel = result.model;
    latencyMs = result.latencyMs;
  }

  const botUser = await db.user.findUnique({
    where: { id: responder.userId },
    select: { id: true, displayName: true, avatar: true },
  });
  if (!botUser) return;

  if (replyText.trim()) {
    const reply = await db.message.create({
      data: {
        content: replyText,
        userId: responder.userId,
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
      isBot: true,
      botRole: promptRole,
      createdAt: reply.createdAt.toISOString(),
    });
  }

  log.info(
    {
      channelId,
      role: promptRole,
      source,
      responder: responder.isRealBot ? "bot-row" : "system-ai",
      provider: providerLabel,
      model: modelLabel,
      latencyMs,
      agentMode,
      toolCallCount,
    },
    "Bot assistant replied",
  );
}

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
  if (!tryAcquireChannelThrottle(channelId, log)) return;

  void (async () => {
    try {
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { serverId: true, type: true },
      });
      if (!channel || channel.type !== "TEXT") return;

      const responder = await getResponderForRole(channel.serverId, mention.role, channelId);
      if (!responder) return;

      // v0.93 #5 ph2 + #4: try task-creation first. Если AI сочтёт
      // это запросом на создание row в таблице → создаст row + reply
      // confirmation, и мы skip'аем normal reply (один bot message).
      // Иначе fall through к normal AI reply.
      const taskCreated = responder.capabilities.includes("update_table_row")
        ? await attemptCreateRowFromMention({
            channelId,
            serverId: channel.serverId,
            senderUserId: triggerUserId,
            content: triggerContent,
            responder,
            log,
          })
        : false;
      if (taskCreated) {
        return;
      }

      await executeChannelBotReply({
        channelId,
        triggerMessageId,
        triggerUserId,
        triggerContent,
        responder,
        mentionRole: mention.role,
        log,
        source: "mention",
      });
    } catch (err) {
      log.warn({ err, channelId }, "AI assistant failed");
      pendingByChannel.delete(channelId);
    }
  })();
}

/**
 * Auto-respond: первый Bot с autoRespond=true на сервере (oldest createdAt).
 * Не срабатывает если в сообщении уже есть role-mention.
 */
export async function maybeAutoRespond(
  channelId: string,
  triggerMessageId: string,
  triggerUserId: string,
  triggerContent: string,
  log: FastifyBaseLogger,
): Promise<void> {
  if (!isAiConfigured()) return;
  if (detectAiMention(triggerContent)) return;
  if (await isBotUserId(triggerUserId)) return;
  if (!tryAcquireChannelThrottle(channelId, log)) return;

  void (async () => {
    try {
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { serverId: true, type: true },
      });
      if (!channel || channel.type !== "TEXT") return;

      const autoBots = await db.bot.findMany({
        where: { serverId: channel.serverId, autoRespond: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          userId: true,
          role: true,
          capabilities: true,
          allowedChannelIds: true,
          systemPromptOverride: true,
          personality: true,
          user: { select: { displayName: true } },
        },
      });
      const autoBot = autoBots.find((candidate) => {
        const capabilities = parseBotCapabilities(candidate.capabilities);
        const allowed = parseAllowedChannelIds(candidate.allowedChannelIds);
        return capabilities.includes("send_message") && canAccessBotChannel(allowed, channelId);
      });
      if (!autoBot) return;
      const caps = parseBotCapabilities(autoBot.capabilities);
      const allowedChannelIds = parseAllowedChannelIds(autoBot.allowedChannelIds);

      await executeChannelBotReply({
        channelId,
        triggerMessageId,
        triggerUserId,
        triggerContent,
        responder: {
          botId: autoBot.id,
          userId: autoBot.userId,
          role: autoBot.role as BotRoleValue,
          displayName: autoBot.user.displayName,
          systemPromptOverride: autoBot.systemPromptOverride,
          personality: autoBot.personality,
          capabilities: caps,
          allowedChannelIds,
          isRealBot: true,
        },
        mentionRole: autoBot.role as BotRoleValue,
        log,
        source: "auto_respond",
      });
    } catch (err) {
      log.warn({ err, channelId }, "Bot auto-respond failed");
      pendingByChannel.delete(channelId);
    }
  })();
}
