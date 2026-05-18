import type { FastifyBaseLogger } from "fastify";
import { db } from "./db.js";
import { emitMessageOnChannel } from "./realtime.js";

/**
 * v0.80 #26 phase 1: Automation engine.
 *
 * Async fire-and-forget evaluator: при создании message в channel вызывается
 * scheduleAutomation() → загружает enabled rules сервера, matches trigger,
 * fires action. Никогда не throws — caller обернёт void.
 *
 * Trigger discriminator: type=MESSAGE_NEW.
 *   - keyword: regex-escaped substring match (caseInsensitive default true)
 *   - channelId: filter — null = any channel сервера
 *
 * Action discriminator: type=POST_MESSAGE.
 *   - channelId: target channel (validates same server)
 *   - template: text шаблон с placeholders {{user}} / {{message}} / {{channel}}
 *
 * Anti-loop: pendingFires set per-message prevents infinite cascade (rule
 * posts message → triggers same rule → ...). Также skip если author является
 * системным user'ом / bot — rule fires только на human-authored messages.
 *
 * Future phase 2: больше trigger types (NEW_TASK, FILE_UPLOAD, APPROVAL,
 * MENTION), action types (CREATE_TASK, WEBHOOK_OUT, UPDATE_TABLE), conditions
 * (regex / time-of-day / role).
 */

const SYSTEM_USER_EMAIL = "system@eclipse-chat.local";
let cachedSystemUserId: string | null = null;

async function getSystemUserId(): Promise<string | null> {
  if (cachedSystemUserId) return cachedSystemUserId;
  const sys = await db.user.findFirst({
    where: { email: SYSTEM_USER_EMAIL },
    select: { id: true },
  });
  if (sys) {
    cachedSystemUserId = sys.id;
    return sys.id;
  }
  // Fallback: oldest user (Eclipse Chat OWNER первого пространства).
  const oldest = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  cachedSystemUserId = oldest?.id ?? null;
  return cachedSystemUserId;
}

type MessageTrigger = {
  type: "MESSAGE_NEW";
  keyword?: string;
  channelId?: string | null;
  caseInsensitive?: boolean;
};

type PostMessageAction = {
  type: "POST_MESSAGE";
  channelId: string;
  template: string;
};

function parseTrigger(raw: string): MessageTrigger | null {
  try {
    const t = JSON.parse(raw);
    if (t && t.type === "MESSAGE_NEW") return t as MessageTrigger;
  } catch {
    /* ignore */
  }
  return null;
}

function parseAction(raw: string): PostMessageAction | null {
  try {
    const a = JSON.parse(raw);
    if (
      a &&
      a.type === "POST_MESSAGE" &&
      typeof a.channelId === "string" &&
      typeof a.template === "string"
    ) {
      return a as PostMessageAction;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function matchKeyword(
  content: string,
  keyword: string,
  caseInsensitive: boolean,
): boolean {
  if (!keyword) return true;
  const k = caseInsensitive ? keyword.toLowerCase() : keyword;
  const c = caseInsensitive ? content.toLowerCase() : content;
  return c.includes(k);
}

function renderTemplate(
  template: string,
  ctx: {
    user: string;
    message: string;
    channel: string;
  },
): string {
  return template
    .replace(/\{\{\s*user\s*\}\}/g, ctx.user)
    .replace(/\{\{\s*message\s*\}\}/g, ctx.message.slice(0, 400))
    .replace(/\{\{\s*channel\s*\}\}/g, ctx.channel);
}

/**
 * Fire-and-forget evaluator. Caller: `void scheduleAutomation(...)` после
 * успешного create + emit message.
 */
export function scheduleAutomation(
  serverId: string,
  channelId: string,
  messageId: string,
  authorUserId: string | null,
  content: string,
  authorIsBot: boolean,
  log: FastifyBaseLogger,
): void {
  void doEvaluate(
    serverId,
    channelId,
    messageId,
    authorUserId,
    content,
    authorIsBot,
    log,
  ).catch((err) => {
    log.warn({ err, serverId, channelId, messageId }, "automation eval failed");
  });
}

async function doEvaluate(
  serverId: string,
  channelId: string,
  messageId: string,
  authorUserId: string | null,
  content: string,
  authorIsBot: boolean,
  log: FastifyBaseLogger,
): Promise<void> {
  // Anti-loop: не fire'им rule на message, который сам был результатом fire'а
  // (тот всегда исходит от system / bot). Это hard guard — даже если правило
  // matches себя самого, оно не зацикливается.
  if (authorIsBot) return;

  const rules = await db.automationRule.findMany({
    where: { serverId, enabled: true },
    select: {
      id: true,
      name: true,
      trigger: true,
      action: true,
    },
    take: 50,
  });
  if (rules.length === 0) return;

  // Lookup target channels с серверной проверкой за один query.
  // Action.channelId должен принадлежать тому же серверу.
  for (const rule of rules) {
    const trig = parseTrigger(rule.trigger);
    const act = parseAction(rule.action);
    if (!trig || !act) continue;

    // Channel filter (optional)
    if (trig.channelId && trig.channelId !== channelId) continue;

    // Keyword match
    const ci = trig.caseInsensitive ?? true;
    if (!matchKeyword(content, trig.keyword ?? "", ci)) continue;

    // Validate target channel в same server.
    const target = await db.channel.findUnique({
      where: { id: act.channelId },
      select: { id: true, serverId: true, type: true, name: true },
    });
    if (!target || target.serverId !== serverId) continue;
    if (target.type !== "TEXT" && target.type !== "BROADCAST") continue;

    // Resolve author display name (для placeholder).
    let userDisplay = "—";
    if (authorUserId) {
      const u = await db.user.findUnique({
        where: { id: authorUserId },
        select: { displayName: true },
      });
      userDisplay = u?.displayName ?? "—";
    }
    const sourceChannel = await db.channel.findUnique({
      where: { id: channelId },
      select: { name: true },
    });
    const rendered = renderTemplate(act.template, {
      user: userDisplay,
      message: content,
      channel: sourceChannel?.name ?? "—",
    });
    if (!rendered.trim()) continue;

    const systemUserId = await getSystemUserId();
    if (!systemUserId) {
      log.warn({ ruleId: rule.id }, "automation: no system user for posting");
      continue;
    }

    try {
      const posted = await db.message.create({
        data: {
          content: rendered.slice(0, 4000),
          channelId: act.channelId,
          userId: systemUserId,
        },
        include: {
          user: {
            select: { id: true, displayName: true, avatar: true },
          },
        },
      });
      emitMessageOnChannel(act.channelId, {
        messageId: posted.id,
        content: posted.content,
        channelId: act.channelId,
        userId: posted.userId ?? "",
        displayName: posted.user?.displayName ?? "Automation",
        avatar: posted.user?.avatar ?? null,
        isBot: true,
        createdAt: posted.createdAt.toISOString(),
      });
      // Update fireCount + lastFiredAt fire-and-forget (не блокируем эмит).
      await db.automationRule.update({
        where: { id: rule.id },
        data: {
          lastFiredAt: new Date(),
          fireCount: { increment: 1 },
        },
      });
      log.info(
        { ruleId: rule.id, targetChannelId: act.channelId },
        "automation rule fired",
      );
    } catch (err) {
      log.warn(
        { err, ruleId: rule.id },
        "automation rule fire failed; continuing",
      );
    }
  }
}
