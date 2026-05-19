import { createHmac, randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import {
  actionItemInclude,
  serializeActionItem,
} from "./actionItems.js";
import { db } from "./db.js";
import {
  emitActionItemCreated,
  emitMessageOnChannel,
} from "./realtime.js";
import { executeAction as composioExecuteAction, isComposioEnabled } from "./lib/composio.js";
import { recordAudit } from "./security/audit.js";

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
  /** v0.82 #19 phase 1: regex pattern (alternative to substring keyword).
   *  Применяется ПОСЛЕ keyword match — если оба заданы, оба должны pass'нуть.
   *  Invalid regex → rule skip (silent). Anchors допустимы; flags определяются
   *  отдельно через caseInsensitive (применяется к regex тоже). */
  regex?: string;
};

type PostMessageAction = {
  type: "POST_MESSAGE";
  channelId: string;
  template: string;
};

/** v0.82 #19 phase 1: создать ActionItem на source-message. */
type CreateTaskAction = {
  type: "CREATE_TASK";
  /** TASK / DECISION / FOLLOW_UP — какой тип создать. */
  taskType: "TASK" | "DECISION" | "FOLLOW_UP";
  /** Template title. Та же {{user}}/{{message}}/{{channel}} палитра. */
  titleTemplate: string;
};

/** v0.82 #19 phase 1: outbound webhook с HMAC-SHA256 signature. */
type SendWebhookAction = {
  type: "SEND_WEBHOOK";
  url: string;
  /** Secret для HMAC. Тот же шаблон что у bot webhooks. */
  secret?: string;
};

/** v1.0.1 #11.5: execute action на подключённом Composio app'е.
 *  ComposioConnection.id (Eclipse-side row) + action name + JSON params
 *  с placeholders {{user}} / {{message}} / {{channel}}. Params JSON
 *  парсится и рендерится на каждый fire. */
type ComposioActionDef = {
  type: "COMPOSIO_ACTION";
  connectionId: string;
  actionName: string;
  /** JSON-stringified params object с template placeholders. */
  paramsTemplate: string;
};

type ActionDef =
  | PostMessageAction
  | CreateTaskAction
  | SendWebhookAction
  | ComposioActionDef;

function parseTrigger(raw: string): MessageTrigger | null {
  try {
    const t = JSON.parse(raw);
    if (t && t.type === "MESSAGE_NEW") return t as MessageTrigger;
  } catch {
    /* ignore */
  }
  return null;
}

function parseAction(raw: string): ActionDef | null {
  try {
    const a = JSON.parse(raw);
    if (!a || typeof a.type !== "string") return null;
    if (
      a.type === "POST_MESSAGE" &&
      typeof a.channelId === "string" &&
      typeof a.template === "string"
    ) {
      return a as PostMessageAction;
    }
    if (
      a.type === "CREATE_TASK" &&
      (a.taskType === "TASK" ||
        a.taskType === "DECISION" ||
        a.taskType === "FOLLOW_UP") &&
      typeof a.titleTemplate === "string"
    ) {
      return a as CreateTaskAction;
    }
    if (a.type === "SEND_WEBHOOK" && typeof a.url === "string") {
      return a as SendWebhookAction;
    }
    if (
      a.type === "COMPOSIO_ACTION" &&
      typeof a.connectionId === "string" &&
      typeof a.actionName === "string" &&
      typeof a.paramsTemplate === "string"
    ) {
      return a as ComposioActionDef;
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

  // Pre-fetch source channel name (для template placeholders).
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
  const tplCtx = {
    user: userDisplay,
    message: content,
    channel: sourceChannel?.name ?? "—",
  };

  for (const rule of rules) {
    const trig = parseTrigger(rule.trigger);
    const act = parseAction(rule.action);
    if (!trig || !act) continue;

    // Channel filter (optional)
    if (trig.channelId && trig.channelId !== channelId) continue;

    // Keyword match
    const ci = trig.caseInsensitive ?? true;
    if (!matchKeyword(content, trig.keyword ?? "", ci)) continue;

    // v0.82 #19 phase 1: regex match (если задан).
    if (trig.regex) {
      try {
        const re = new RegExp(trig.regex, ci ? "i" : "");
        if (!re.test(content)) continue;
      } catch {
        // Invalid regex — skip правило тихо. UI должен валидировать на save.
        continue;
      }
    }

    let fired = false;
    try {
      if (act.type === "POST_MESSAGE") {
        fired = await fireActionPostMessage(act, serverId, tplCtx, log, rule.id);
      } else if (act.type === "CREATE_TASK") {
        fired = await fireActionCreateTask(
          act,
          serverId,
          channelId,
          messageId,
          authorUserId,
          tplCtx,
          log,
          rule.id,
        );
      } else if (act.type === "SEND_WEBHOOK") {
        fired = await fireActionSendWebhook(
          act,
          serverId,
          channelId,
          messageId,
          authorUserId,
          content,
          rule.id,
          rule.name,
          log,
        );
      } else if (act.type === "COMPOSIO_ACTION") {
        fired = await fireActionComposio(
          act,
          serverId,
          tplCtx,
          rule.id,
          log,
        );
      }
    } catch (err) {
      log.warn(
        { err, ruleId: rule.id, actionType: act.type },
        "automation action failed; continuing",
      );
    }

    if (fired) {
      await db.automationRule.update({
        where: { id: rule.id },
        data: {
          lastFiredAt: new Date(),
          fireCount: { increment: 1 },
        },
      });
      log.info(
        { ruleId: rule.id, actionType: act.type },
        "automation rule fired",
      );
    }
  }
}

async function fireActionPostMessage(
  act: PostMessageAction,
  serverId: string,
  tplCtx: { user: string; message: string; channel: string },
  log: FastifyBaseLogger,
  ruleId: string,
): Promise<boolean> {
  const target = await db.channel.findUnique({
    where: { id: act.channelId },
    select: { id: true, serverId: true, type: true, name: true },
  });
  if (!target || target.serverId !== serverId) return false;
  if (target.type !== "TEXT" && target.type !== "BROADCAST") return false;

  const rendered = renderTemplate(act.template, tplCtx);
  if (!rendered.trim()) return false;
  const systemUserId = await getSystemUserId();
  if (!systemUserId) {
    log.warn({ ruleId }, "automation: no system user for posting");
    return false;
  }
  const posted = await db.message.create({
    data: {
      content: rendered.slice(0, 4000),
      channelId: act.channelId,
      userId: systemUserId,
    },
    include: {
      user: { select: { id: true, displayName: true, avatar: true } },
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
  return true;
}

async function fireActionCreateTask(
  act: CreateTaskAction,
  serverId: string,
  channelId: string,
  sourceMessageId: string,
  authorUserId: string | null,
  tplCtx: { user: string; message: string; channel: string },
  log: FastifyBaseLogger,
  ruleId: string,
): Promise<boolean> {
  const title = renderTemplate(act.titleTemplate, tplCtx).trim().slice(0, 160);
  if (!title) return false;
  const systemUserId = (await getSystemUserId()) ?? authorUserId;
  if (!systemUserId) {
    log.warn({ ruleId }, "automation: no creator user for CREATE_TASK");
    return false;
  }
  try {
    const item = await db.actionItem.create({
      data: {
        title,
        type: act.taskType,
        serverId,
        channelId,
        sourceMessageId,
        createdByUserId: systemUserId,
        activities: {
          create: {
            userId: systemUserId,
            type: "CREATED",
            payload: JSON.stringify({
              source: "automation",
              ruleId,
              type: act.taskType,
            }),
          },
        },
      },
      include: actionItemInclude,
    });
    const payload = serializeActionItem(item);
    emitActionItemCreated(channelId, payload);
    return true;
  } catch (err) {
    // P2002 (unique sourceMessageId+type) — already exists; считаем не-fired.
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return false;
    }
    throw err;
  }
}

async function fireActionSendWebhook(
  act: SendWebhookAction,
  serverId: string,
  channelId: string,
  messageId: string,
  authorUserId: string | null,
  content: string,
  ruleId: string,
  ruleName: string,
  log: FastifyBaseLogger,
): Promise<boolean> {
  // SSRF defense (как в lib/linkPreview): запрет на http://localhost,
  // private-IP ranges, file:/ftp:/gopher:. Только https://.
  let u: URL;
  try {
    u = new URL(act.url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname;
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return false;
  }

  const body = JSON.stringify({
    eventId: randomUUID(),
    eventType: "automation.fired",
    ruleId,
    ruleName,
    serverId,
    channelId,
    messageId,
    authorUserId,
    content: content.slice(0, 2000),
    firedAt: new Date().toISOString(),
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "EclipseChat-Automation/1.0",
  };
  if (act.secret) {
    const sig = createHmac("sha256", act.secret).update(body).digest("hex");
    headers["X-Eclipse-Signature"] = `sha256=${sig}`;
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(act.url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });
    if (!res.ok) {
      log.warn(
        { ruleId, status: res.status },
        "automation webhook returned non-2xx",
      );
      return false;
    }
    return true;
  } catch (err) {
    log.warn({ err, ruleId }, "automation webhook fetch failed");
    return false;
  } finally {
    clearTimeout(t);
  }
}

/**
 * v1.0.1 #11.5: execute Composio action на behalf того, кто настроил
 * rule. Загружает ComposioConnection row → парсит paramsTemplate →
 * рендерит placeholders → вызывает composio.executeAction.
 *
 * Anti-abuse: только для ACTIVE connections. Если connection expired —
 * skip silent + audit failure (на UI будет видно красный flag).
 */
async function fireActionComposio(
  act: ComposioActionDef,
  serverId: string,
  tplCtx: { user: string; message: string; channel: string },
  ruleId: string,
  log: FastifyBaseLogger,
): Promise<boolean> {
  if (!isComposioEnabled()) {
    log.warn({ ruleId }, "composio action skipped — COMPOSIO_API_KEY not set");
    return false;
  }
  const conn = await db.composioConnection.findUnique({
    where: { id: act.connectionId },
    select: {
      id: true,
      serverId: true,
      appName: true,
      composioConnId: true,
      status: true,
    },
  });
  if (!conn || conn.serverId !== serverId) {
    log.warn({ ruleId, connectionId: act.connectionId }, "composio connection not found / wrong server");
    return false;
  }
  if (conn.status !== "ACTIVE") {
    log.warn(
      { ruleId, connectionId: conn.id, status: conn.status },
      "composio connection not active — skip",
    );
    return false;
  }

  // Parse + render params. Каждое строковое значение получает placeholder
  // substitution. Числа / booleans / nested objects пропускаем без изменения.
  let params: Record<string, unknown>;
  try {
    const raw = JSON.parse(act.paramsTemplate);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      log.warn({ ruleId }, "composio params template must be a JSON object");
      return false;
    }
    params = renderParamsDeep(raw as Record<string, unknown>, tplCtx);
  } catch (err) {
    log.warn({ err, ruleId }, "composio params template invalid JSON");
    return false;
  }

  const started = Date.now();
  try {
    const result = await composioExecuteAction({
      connectionId: conn.composioConnId,
      actionName: act.actionName,
      params,
    });
    const latencyMs = Date.now() - started;
    await db.composioConnection.update({
      where: { id: conn.id },
      data: { lastUsedAt: new Date() },
    });
    recordAudit("COMPOSIO_ACTION_EXECUTED", {
      userId: null,
      metadata: {
        ruleId,
        connectionId: conn.id,
        appName: conn.appName,
        actionName: act.actionName,
        success: result.success,
        latencyMs,
        triggeredByAutomation: true,
      },
    });
    if (!result.success) {
      log.warn(
        { ruleId, actionName: act.actionName, error: result.error },
        "composio action returned success=false",
      );
    }
    return result.success;
  } catch (err) {
    log.warn(
      { err, ruleId, connectionId: conn.id, actionName: act.actionName },
      "composio action execution failed",
    );
    return false;
  }
}

/** Render placeholders {{user}}/{{message}}/{{channel}} в string values
 *  рекурсивно (объекты / массивы). Non-string values остаются as-is. */
function renderParamsDeep(
  obj: Record<string, unknown>,
  ctx: { user: string; message: string; channel: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = renderValue(v, ctx);
  }
  return out;
}

function renderValue(
  v: unknown,
  ctx: { user: string; message: string; channel: string },
): unknown {
  if (typeof v === "string") {
    return v
      .replace(/\{\{\s*user\s*\}\}/g, ctx.user)
      .replace(/\{\{\s*message\s*\}\}/g, ctx.message.slice(0, 1500))
      .replace(/\{\{\s*channel\s*\}\}/g, ctx.channel);
  }
  if (Array.isArray(v)) return v.map((x) => renderValue(x, ctx));
  if (v && typeof v === "object") {
    return renderParamsDeep(v as Record<string, unknown>, ctx);
  }
  return v;
}
