import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { requireBotAuth } from "../auth/botAuth.js";
import { recordAudit } from "../security/audit.js";
import { emitMessageOnChannel, emitReactionAdded } from "../realtime.js";
import { fireMessageCreatedWebhooks } from "../bots/webhooks.js";
import {
  BOT_ROLES,
  BOT_ROLE_LABELS,
  botRolePrompt,
  resolveBotSystemPrompt,
  type BotRoleValue,
} from "../ai/botRoles.js";
import { chat, AINotConfiguredError, AIProviderError } from "../ai/provider.js";
import {
  BOT_CAPABILITIES,
  canViewBotWorkbench,
  canAccessBotChannel,
  normalizeAllowedChannelIds,
  normalizeBotCapabilities,
  parseAllowedChannelIds,
  parseBotCapabilities,
  type BotCapability,
} from "../ai/botAccess.js";

const botRoleSchema = z.enum(BOT_ROLES as readonly [BotRoleValue, ...BotRoleValue[]]);
const botCapabilitySchema = z.enum(
  BOT_CAPABILITIES as readonly [BotCapability, ...BotCapability[]],
);

const ALLOWED_BOT_EMOJI = new Set([
  "👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀",
  "🚀", "💯", "🙏", "👏",
]);

const URL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Генерация bot API key: `ecb_<32-char-urlsafe-base64>`.
 * Используем crypto.randomBytes + URL-safe alphabet — детерминированный
 * формат, легко проверить regex'ом.
 */
function generateApiKey(): string {
  const bytes = randomBytes(32);
  let out = "ecb_";
  for (let i = 0; i < 32; i++) {
    out += URL_SAFE[bytes[i] % URL_SAFE.length];
  }
  return out;
}

const createBotBody = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(280).optional().nullable(),
  role: botRoleSchema.optional(),
});

const updateBotBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(280).optional().nullable(),
  role: botRoleSchema.optional(),
  autoRespond: z.boolean().optional(),
  systemPromptOverride: z.string().max(8000).optional().nullable(),
  /** v1.2.27 — personality overlay (character/humor) до 1000 символов. */
  personality: z.string().max(1000).optional().nullable(),
  /** v1.2.29 — agent mode toggle. true → capabilities += "agent" (tool-use loop). */
  agentMode: z.boolean().optional(),
  capabilities: z.array(botCapabilitySchema).max(BOT_CAPABILITIES.length).optional(),
  /** null = every room; [] = deny all rooms. */
  allowedChannelIds: z.array(z.string().trim().min(1).max(64)).max(100).nullable().optional(),
  webhookUrl: z
    .string()
    .max(512)
    .refine(
      (v) => v === "" || /^https?:\/\//.test(v),
      { message: "webhookUrl должен быть http(s) URL" },
    )
    .optional()
    .nullable(),
  webhookSecret: z.string().max(128).optional().nullable(),
});

const botMessageBody = z.object({
  channelId: z.string().min(1),
  content: z.string().max(8000).optional().default(""),
});

const botReactionBody = z.object({
  messageId: z.string().min(1),
  emoji: z.string().min(1).max(8),
});

/**
 * Загружает membership + role для OWNER-gated actions на server.
 */
async function requireServerOwner(
  serverId: string,
  userId: string | null,
): Promise<{ ok: true } | { ok: false; status: 401 | 403 | 404; error: string }> {
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
  if (!member) return { ok: false, status: 403, error: "Not a member" };
  if (member.role !== "OWNER") {
    return { ok: false, status: 403, error: "Только OWNER может управлять ботами" };
  }
  return { ok: true };
}

async function requireServerAdminOrOwner(
  serverId: string,
  userId: string | null,
): Promise<
  | { ok: true; role: "OWNER" | "ADMIN" }
  | { ok: false; status: 401 | 403; error: string }
> {
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
  if (!member || !canViewBotWorkbench(member.role)) {
    return { ok: false, status: 403, error: "Только OWNER/ADMIN могут видеть агентов" };
  }
  return { ok: true, role: member.role };
}

/**
 * Создаёт shadow user для bot'а. Email `bot-<id>@eclipse-chat.local`,
 * passwordHash недостижимый bcrypt-блоб (никогда не пройдёт `bcrypt.compare`).
 */
async function createShadowUser(
  botName: string,
  botId: string,
): Promise<{ userId: string }> {
  const user = await db.user.create({
    data: {
      email: `bot-${botId}@eclipse-chat.local`,
      // sentinel passwordHash — никогда не используется, но NOT NULL constraint.
      passwordHash: "$2a$10$bot.shadow.user.no.login.never.never.never.never",
      displayName: botName,
    },
  });
  return { userId: user.id };
}

export async function registerBotRoutes(app: FastifyInstance) {
  /**
   * GET /api/servers/:id/bots — список ботов сервера. OWNER/ADMIN only.
   * ADMIN получает read-only state без prompt, personality, webhook и key metadata.
   */
  app.get(
    "/api/servers/:id/bots",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      const auth = await requireServerAdminOrOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      const canManage = auth.role === "OWNER";
      const bots = await db.bot.findMany({
        where: { serverId },
        orderBy: { createdAt: "asc" },
        include: {
          owner: { select: { id: true, displayName: true } },
          user: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      return {
        bots: bots.map((b) => ({
          id: b.id,
          name: b.name,
          avatar: b.avatar ?? b.user.avatar ?? null,
          description: b.description,
          role: b.role as BotRoleValue,
          autoRespond: b.autoRespond,
          systemPromptOverride: canManage ? b.systemPromptOverride : null,
          personality: canManage ? b.personality : null,
          /** v1.2.29 — true если "agent" в capabilities. */
          agentMode: parseBotCapabilities(b.capabilities).includes("agent"),
          owner: b.owner,
          shadowUserId: b.userId,
          // Только префикс — не secret, для UX «ecb_AbCd…» display
          apiKeyPrefix: canManage ? b.apiKeyPrefix : "",
          capabilities: parseBotCapabilities(b.capabilities),
          allowedChannelIds: parseAllowedChannelIds(b.allowedChannelIds),
          webhookUrl: canManage ? b.webhookUrl : null,
          // webhookSecret НЕ отдаём — только при create/regenerate
          // через webhookSecretSet flag показываем «есть/нет»
          webhookSecretSet: canManage && Boolean(b.webhookSecret),
          webhookEvents: canManage
            ? JSON.parse(b.webhookEvents || "[]") as string[]
            : [],
          createdAt: b.createdAt.toISOString(),
          lastUsedAt: b.lastUsedAt?.toISOString() ?? null,
        })),
      };
    },
  );

  /**
   * POST /api/servers/:id/bots — создать бота. OWNER only.
   * Returns ОДНОРАЗОВО plaintext API key. Сохрани сразу — backend хранит
   * только bcrypt hash, восстановить нельзя (только regenerate).
   */
  app.post(
    "/api/servers/:id/bots",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      const parsed = createBotBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid body",
        });
      }
      // Hard cap: не более 20 ботов per server (anti-abuse).
      const count = await db.bot.count({ where: { serverId } });
      if (count >= 20) {
        return reply.status(400).send({ error: "Лимит 20 ботов на сервер достигнут" });
      }
      // Генерируем key + bcrypt-хэш
      const fullKey = generateApiKey();
      const apiKeyHash = await bcrypt.hash(fullKey, 10);
      const apiKeyPrefix = fullKey.slice(0, 12);
      // Транзакция: shadow user + bot row + member (auto-add как MEMBER)
      const botId = "bot_" + randomBytes(8).toString("hex");
      const result = await db.$transaction(async (tx) => {
        const shadow = await tx.user.create({
          data: {
            email: `bot-${botId}@eclipse-chat.local`,
            passwordHash: "$2a$10$bot.shadow.user.no.login.never.never.never.never",
            displayName: parsed.data.name.trim(),
          },
        });
        const bot = await tx.bot.create({
          data: {
            id: botId,
            name: parsed.data.name.trim(),
            description: parsed.data.description?.trim() || null,
            role: parsed.data.role ?? "GENERIC",
            apiKeyHash,
            apiKeyPrefix,
            serverId,
            ownerUserId: userId!,
            userId: shadow.id,
          },
        });
        await tx.member.create({
          data: {
            userId: shadow.id,
            serverId,
            role: "MEMBER",
          },
        });
        return bot;
      });
      recordAudit("BOT_CREATED", {
        userId,
        req,
        metadata: {
          botId: result.id,
          serverId,
          name: result.name,
          role: result.role,
        },
      });
      return {
        bot: {
          id: result.id,
          name: result.name,
          role: result.role as BotRoleValue,
          shadowUserId: result.userId,
          apiKeyPrefix: result.apiKeyPrefix,
          createdAt: result.createdAt.toISOString(),
        },
        // ВНИМАНИЕ: показать пользователю один раз — больше не вернём.
        apiKey: fullKey,
      };
    },
  );

  /**
   * POST /api/servers/:id/bots/:botId/regenerate — новый API key. Старый
   * сразу инвалидируется.
   */
  app.post(
    "/api/servers/:id/bots/:botId/regenerate",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, botId } = req.params as { id: string; botId: string };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      const bot = await db.bot.findUnique({
        where: { id: botId },
        select: { id: true, serverId: true },
      });
      if (!bot || bot.serverId !== serverId) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      const fullKey = generateApiKey();
      const apiKeyHash = await bcrypt.hash(fullKey, 10);
      const apiKeyPrefix = fullKey.slice(0, 12);
      await db.bot.update({
        where: { id: botId },
        data: { apiKeyHash, apiKeyPrefix },
      });
      recordAudit("BOT_KEY_REGENERATED", {
        userId,
        req,
        metadata: { botId, serverId },
      });
      return {
        ok: true,
        apiKeyPrefix,
        apiKey: fullKey,
      };
    },
  );

  /**
   * PATCH /api/servers/:id/bots/:botId — update bot meta + webhook config.
   * OWNER only. Возвращает updated bot row (без webhookSecret в response —
   * мы его храним plaintext для HMAC signing но не отдаём через GET).
   */
  app.patch(
    "/api/servers/:id/bots/:botId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, botId } = req.params as { id: string; botId: string };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      const parsed = updateBotBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid body",
        });
      }
      const bot = await db.bot.findUnique({
        where: { id: botId },
        select: {
          id: true,
          serverId: true,
          userId: true,
          systemPromptOverride: true,
          capabilities: true,
          allowedChannelIds: true,
        },
      });
      if (!bot || bot.serverId !== serverId) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      const data: {
        name?: string;
        description?: string | null;
        role?: BotRoleValue;
        autoRespond?: boolean;
        systemPromptOverride?: string | null;
        personality?: string | null;
        capabilities?: string;
        allowedChannelIds?: string | null;
        webhookUrl?: string | null;
        webhookSecret?: string | null;
      } = {};
      if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
      if (parsed.data.description !== undefined) {
        const d = parsed.data.description?.trim();
        data.description = d ? d : null;
      }
      if (parsed.data.role !== undefined) data.role = parsed.data.role;
      if (parsed.data.autoRespond !== undefined) data.autoRespond = parsed.data.autoRespond;
      if (parsed.data.personality !== undefined) {
        const p = parsed.data.personality?.trim();
        data.personality = p ? p : null;
      }
      const existingCapabilities = parseBotCapabilities(bot.capabilities);
      let nextCapabilities = parsed.data.capabilities
        ? normalizeBotCapabilities(parsed.data.capabilities)
        : existingCapabilities;
      // Backward-compatible toggle used by existing clients.
      if (parsed.data.agentMode !== undefined) {
        nextCapabilities = nextCapabilities.filter((capability) => capability !== "agent");
        if (parsed.data.agentMode) nextCapabilities.push("agent");
        nextCapabilities = normalizeBotCapabilities(nextCapabilities);
      }
      if (
        parsed.data.capabilities !== undefined ||
        parsed.data.agentMode !== undefined
      ) {
        data.capabilities = JSON.stringify(nextCapabilities);
      }

      let nextAllowedChannelIds = parseAllowedChannelIds(bot.allowedChannelIds);
      if (parsed.data.allowedChannelIds !== undefined) {
        nextAllowedChannelIds = normalizeAllowedChannelIds(parsed.data.allowedChannelIds);
        if (nextAllowedChannelIds !== null && nextAllowedChannelIds.length > 0) {
          const matchingChannels = await db.channel.count({
            where: { serverId, id: { in: nextAllowedChannelIds } },
          });
          if (matchingChannels !== nextAllowedChannelIds.length) {
            return reply.status(400).send({
              error: "Одна или несколько комнат не принадлежат этому пространству",
            });
          }
        }
        data.allowedChannelIds =
          nextAllowedChannelIds === null ? null : JSON.stringify(nextAllowedChannelIds);
      }
      // v1.0: audit prompt update/reset для AI controls observability.
      let promptAuditEvent: "BOT_PROMPT_UPDATE" | "BOT_PROMPT_RESET" | null = null;
      if (parsed.data.systemPromptOverride !== undefined) {
        const p = parsed.data.systemPromptOverride?.trim();
        data.systemPromptOverride = p ? p : null;
        // Audit только если что-то реально меняется.
        if (p && p !== bot.systemPromptOverride) {
          promptAuditEvent = "BOT_PROMPT_UPDATE";
        } else if (!p && bot.systemPromptOverride) {
          promptAuditEvent = "BOT_PROMPT_RESET";
        }
      }
      if (parsed.data.webhookUrl !== undefined) {
        const u = parsed.data.webhookUrl?.trim();
        data.webhookUrl = u ? u : null;
      }
      if (parsed.data.webhookSecret !== undefined) {
        const s = parsed.data.webhookSecret?.trim();
        data.webhookSecret = s ? s : null;
      }
      // Sync shadow user displayName если bot.name changed
      const updated = await db.bot.update({
        where: { id: botId },
        data,
        select: {
          id: true,
          name: true,
          description: true,
          role: true,
          autoRespond: true,
          systemPromptOverride: true,
          personality: true,
          capabilities: true,
          allowedChannelIds: true,
          avatar: true,
          apiKeyPrefix: true,
          webhookUrl: true,
          webhookSecret: true,
          webhookEvents: true,
          userId: true,
          createdAt: true,
          lastUsedAt: true,
        },
      });
      if (data.name) {
        await db.user.update({
          where: { id: updated.userId },
          data: { displayName: data.name },
        });
      }
      if (promptAuditEvent) {
        recordAudit(promptAuditEvent, {
          userId,
          req,
          metadata: {
            botId,
            serverId,
            promptLength: data.systemPromptOverride?.length ?? 0,
          },
        });
      }
      if (
        data.capabilities !== undefined ||
        data.allowedChannelIds !== undefined
      ) {
        recordAudit("BOT_ACCESS_POLICY_CHANGED", {
          userId,
          req,
          metadata: {
            botId,
            serverId,
            capabilities: parseBotCapabilities(updated.capabilities),
            channelScope:
              updated.allowedChannelIds === null
                ? "all"
                : parseAllowedChannelIds(updated.allowedChannelIds)?.length ?? 0,
          },
        });
      }
      return {
        bot: {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          role: updated.role as BotRoleValue,
          autoRespond: updated.autoRespond,
          systemPromptOverride: updated.systemPromptOverride,
          capabilities: parseBotCapabilities(updated.capabilities),
          agentMode: parseBotCapabilities(updated.capabilities).includes("agent"),
          allowedChannelIds: parseAllowedChannelIds(updated.allowedChannelIds),
          avatar: updated.avatar,
          apiKeyPrefix: updated.apiKeyPrefix,
          webhookUrl: updated.webhookUrl,
          webhookSecretSet: Boolean(updated.webhookSecret),
          webhookEvents: JSON.parse(updated.webhookEvents || "[]") as string[],
          shadowUserId: updated.userId,
          createdAt: updated.createdAt.toISOString(),
          lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
        },
      };
    },
  );

  /**
   * DELETE /api/servers/:id/bots/:botId — удалить бота. Cascade удалит
   * shadow user, member row, все его сообщения.
   */
  app.delete(
    "/api/servers/:id/bots/:botId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, botId } = req.params as { id: string; botId: string };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      const bot = await db.bot.findUnique({
        where: { id: botId },
        select: { id: true, serverId: true, userId: true, name: true },
      });
      if (!bot || bot.serverId !== serverId) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      // Удаляем shadow user → cascade удалит Bot + Member + Messages
      await db.user.delete({ where: { id: bot.userId } });
      recordAudit("BOT_DELETED", {
        userId,
        req,
        metadata: { botId, serverId, name: bot.name },
      });
      return { ok: true };
    },
  );

  /**
   * v1.0 #11 AI controls: GET /api/servers/:id/bots/:botId/usage —
   * aggregate stats для bot. Pull from existing Message table (no logs
   * schema migration). Возвращает:
   *   - totalMessages: lifetime count of messages from bot's shadow user
   *   - messages7d: last 7 days count
   *   - messages24h: last 24 hours count
   *   - lastUsedAt: from Bot.lastUsedAt (auto-updated при bot.token usage)
   *   - topChannels: top 3 channels by message count
   *
   * OWNER/ADMIN only. ADMIN использует эти агрегаты в read-only Workbench.
   */
  app.get(
    "/api/servers/:id/bots/:botId/usage",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, botId } = req.params as { id: string; botId: string };
      const userId = getUserId(req);
      const auth = await requireServerAdminOrOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      const bot = await db.bot.findUnique({
        where: { id: botId },
        select: { id: true, serverId: true, userId: true, lastUsedAt: true },
      });
      if (!bot || bot.serverId !== serverId) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      const now = Date.now();
      const start7d = new Date(now - 7 * 24 * 3600 * 1000);
      const start24h = new Date(now - 24 * 3600 * 1000);
      const [totalMessages, messages7d, messages24h, perChannel] = await Promise.all([
        db.message.count({
          where: {
            userId: bot.userId,
            deletedAt: null,
          },
        }),
        db.message.count({
          where: {
            userId: bot.userId,
            deletedAt: null,
            createdAt: { gte: start7d },
          },
        }),
        db.message.count({
          where: {
            userId: bot.userId,
            deletedAt: null,
            createdAt: { gte: start24h },
          },
        }),
        db.message.groupBy({
          by: ["channelId"],
          where: {
            userId: bot.userId,
            deletedAt: null,
          },
          _count: { _all: true },
          orderBy: { _count: { id: "desc" } },
          take: 3,
        }),
      ]);
      const channelIds = perChannel
        .map((c) => c.channelId)
        .filter((id): id is string => id !== null);
      const channels = channelIds.length
        ? await db.channel.findMany({
            where: { id: { in: channelIds }, serverId },
            select: { id: true, name: true, type: true },
          })
        : [];
      const channelById = new Map(channels.map((c) => [c.id, c]));
      const topChannels = perChannel
        .map((c) => {
          if (c.channelId == null) return null;
          const ch = channelById.get(c.channelId);
          if (!ch) return null;
          return {
            id: ch.id,
            name: ch.name,
            type: ch.type,
            count: c._count._all,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
      return {
        totalMessages,
        messages7d,
        messages24h,
        lastUsedAt: bot.lastUsedAt?.toISOString() ?? null,
        topChannels,
      };
    },
  );

  /**
   * v1.0 #11 AI controls: POST /api/servers/:id/bots/:botId/test —
   * test-run AI response для bot'а с текущим system prompt (override или
   * role template). НЕ создаёт message в канале — только runs chat() и
   * возвращает response. Для preview prompt-changes без spam'а каналов.
   *
   * Rate limit: 10 per minute per user через Fastify rate-limit на уровне
   * application (если применяется глобально).
   *
   * OWNER only — управление AI controls.
   */
  app.post(
    "/api/servers/:id/bots/:botId/test",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, botId } = req.params as { id: string; botId: string };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      const testBody = z.object({
        userInput: z.string().trim().min(1).max(2000),
      });
      const parsed = testBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid body",
        });
      }
      const bot = await db.bot.findUnique({
        where: { id: botId },
        select: {
          id: true,
          serverId: true,
          name: true,
          role: true,
          systemPromptOverride: true,
          personality: true,
        },
      });
      if (!bot || bot.serverId !== serverId) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      const systemPrompt = resolveBotSystemPrompt(
        bot.role as BotRoleValue,
        bot.systemPromptOverride,
        undefined,
        bot.personality,
      );
      const started = Date.now();
      try {
        const result = await chat(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: parsed.data.userInput },
          ],
          {
            temperature: 0.7,
            maxTokens: 600,
            route: {
              task: "conversation",
              objective: "quality",
              sensitivity: "sensitive",
            },
          },
        );
        const latencyMs = Date.now() - started;
        recordAudit("BOT_TEST_INVOKE", {
          userId: userId!,
          req,
          metadata: {
            botId,
            serverId,
            inputLength: parsed.data.userInput.length,
            outputLength: result.text.length,
            provider: result.provider,
            latencyMs,
          },
        });
        return {
          ok: true,
          response: result.text,
          provider: result.provider,
          model: result.model ?? null,
          latencyMs,
          systemPromptLength: systemPrompt.length,
          isOverride: Boolean(bot.systemPromptOverride),
        };
      } catch (err) {
        const latencyMs = Date.now() - started;
        if (err instanceof AINotConfiguredError) {
          return reply.status(503).send({
            error: "AI providers не сконфигурированы (нет API ключей в .env)",
          });
        }
        if (err instanceof AIProviderError) {
          return reply.status(502).send({
            error: `AI provider ${err.provider} failed: ${err.message}`,
            latencyMs,
          });
        }
        throw err;
      }
    },
  );

  // =========================================================================
  // Bot-authenticated endpoints (Authorization: Bot ecb_...)
  // =========================================================================

  /**
   * POST /api/bot/messages — отправка сообщения от бота в канал.
   * Body: { channelId, content }.
   * Bot должен быть Member of channel.server (auto-added при create).
   */
  app.post(
    "/api/bot/messages",
    { onRequest: [requireBotAuth] },
    async (req, reply) => {
      const bot = req.bot;
      if (!bot) return reply.status(401).send({ error: "Bot auth required" });
      const parsed = botMessageBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const trimmed = parsed.data.content.trim();
      if (!trimmed) {
        return reply.status(400).send({ error: "content required" });
      }
      if (!bot.capabilities.includes("send_message")) {
        return reply.status(403).send({
          error: "Bot не имеет capability send_message",
        });
      }
      const ch = await db.channel.findUnique({
        where: { id: parsed.data.channelId },
        select: { id: true, serverId: true, type: true },
      });
      if (!ch) return reply.status(404).send({ error: "Channel not found" });
      if (ch.serverId !== bot.serverId) {
        return reply.status(403).send({
          error: "Bot не имеет доступа к этому каналу",
        });
      }
      if (!canAccessBotChannel(bot.allowedChannelIds, ch.id)) {
        return reply.status(403).send({
          error: "Канал не входит в разрешённый scope бота",
        });
      }
      if (ch.type !== "TEXT") {
        return reply.status(400).send({ error: "Bot может писать только в TEXT каналы" });
      }
      // Bot пишет от имени своего shadow user
      const shadow = await db.user.findUnique({
        where: { id: bot.userId },
        select: { id: true, displayName: true, avatar: true },
      });
      if (!shadow) return reply.status(500).send({ error: "Bot shadow user missing" });
      const m = await db.message.create({
        data: {
          content: trimmed,
          userId: bot.userId,
          channelId: ch.id,
        },
      });
      // Bump lastUsedAt — bot аналитика «когда последний раз дышал».
      // Fire-and-forget (не блокируем response).
      void db.bot
        .update({ where: { id: bot.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
      const payload = {
        messageId: m.id,
        content: m.content,
        channelId: ch.id,
        userId: shadow.id,
        displayName: shadow.displayName,
        avatar: shadow.avatar,
        isBot: true,
        botRole: bot.role,
        createdAt: m.createdAt.toISOString(),
      };
      emitMessageOnChannel(ch.id, payload);
      // Fire-and-forget: webhooks для ДРУГИХ bot'ов в этом server'е
      // (с фильтром anti-loop в helper'е — bot НЕ получает свои сообщения).
      fireMessageCreatedWebhooks(
        ch.serverId,
        {
          messageId: m.id,
          channelId: ch.id,
          serverId: ch.serverId,
          userId: shadow.id,
          displayName: shadow.displayName,
          content: m.content,
          isBot: true,
          botRole: bot.role,
          createdAt: m.createdAt.toISOString(),
        },
        app.log,
      );
      return { message: payload };
    },
  );

  /**
   * POST /api/bot/reactions — добавить реакцию на сообщение от имени бота.
   * Body: { messageId, emoji }.
   *
   * Permission rules:
   *   - capability 'react' должен быть в bot.capabilities
   *   - message должен принадлежать TEXT-каналу того же server'а что bot
   *   - DM-сообщения нельзя реагировать ботом (нет membership в DM)
   *   - emoji должен быть в whitelist (тот же что у human user реакций)
   *
   * Idempotent через unique(messageId, userId, emoji) constraint.
   */
  app.post(
    "/api/bot/reactions",
    { onRequest: [requireBotAuth] },
    async (req, reply) => {
      const bot = req.bot;
      if (!bot) return reply.status(401).send({ error: "Bot auth required" });
      const parsed = botReactionBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      if (!bot.capabilities.includes("react")) {
        return reply.status(403).send({
          error: "Bot не имеет capability react",
        });
      }
      const { messageId, emoji } = parsed.data;
      if (!ALLOWED_BOT_EMOJI.has(emoji)) {
        return reply.status(400).send({ error: "Emoji not in allowed list" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          channelId: true,
          deletedAt: true,
          channel: { select: { serverId: true } },
        },
      });
      if (!m) return reply.status(404).send({ error: "Message not found" });
      if (m.deletedAt) {
        return reply.status(410).send({ error: "Cannot react to deleted message" });
      }
      if (!m.channelId || !m.channel) {
        return reply.status(400).send({
          error: "Bot реакции доступны только для канальных сообщений (не DM)",
        });
      }
      if (m.channel.serverId !== bot.serverId) {
        return reply.status(403).send({
          error: "Bot не имеет доступа к этому каналу",
        });
      }
      if (!canAccessBotChannel(bot.allowedChannelIds, m.channelId)) {
        return reply.status(403).send({
          error: "Канал не входит в разрешённый scope бота",
        });
      }
      // Bump lastUsedAt fire-and-forget (см. POST /api/bot/messages)
      void db.bot
        .update({ where: { id: bot.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
      try {
        await db.reaction.create({
          data: { messageId, userId: bot.userId, emoji },
        });
        emitReactionAdded(m.channelId, {
          messageId,
          channelId: m.channelId,
          emoji,
          userId: bot.userId,
        });
        return { ok: true };
      } catch (err: unknown) {
        // P2002 = unique constraint = already reacted; idempotent success
        if (
          err instanceof Error &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          return { ok: true, alreadyExists: true };
        }
        throw err;
      }
    },
  );

  /**
   * GET /api/bot/me — bot intro/whoami. Используется SDK для health-check.
   *
   * Возвращает также:
   *   - role:           taxonomy-роль бота (GENERIC | MODERATOR | PM | KNOWLEDGE | SALES)
   *   - roleLabel:      короткий RU-лейбл для UI
   *   - systemPrompt:   рекомендуемый system-prompt template для LLM-провайдера
   *                     бота. SDK может использовать как system message для
   *                     своего chat completion.
   */
  app.get(
    "/api/bot/me",
    { onRequest: [requireBotAuth] },
    async (req) => {
      const ctx = req.bot!;
      const row = await db.bot.findUnique({
        where: { id: ctx.id },
        select: {
          role: true,
          autoRespond: true,
          systemPromptOverride: true,
           personality: true,
           allowedChannelIds: true,
        },
      });
      const role = (row?.role ?? ctx.role) as BotRoleValue;
      const override = row?.systemPromptOverride ?? null;
      const personality = row?.personality ?? null;
      return {
        bot: {
          id: ctx.id,
          name: ctx.name,
          serverId: ctx.serverId,
          shadowUserId: ctx.userId,
           capabilities: ctx.capabilities,
           allowedChannelIds: parseAllowedChannelIds(row?.allowedChannelIds ?? null),
          role,
          roleLabel: BOT_ROLE_LABELS[role] ?? BOT_ROLE_LABELS.GENERIC,
          autoRespond: row?.autoRespond ?? false,
          systemPrompt: resolveBotSystemPrompt(role, override, undefined, personality),
          systemPromptOverride: override,
          personality,
          roleTemplatePrompt: botRolePrompt(role),
        },
      };
    },
  );

  const botActivityTypes = [
    "BOT_CREATED",
    "BOT_KEY_REGENERATED",
    "BOT_PROMPT_UPDATE",
    "BOT_PROMPT_RESET",
    "BOT_TEST_INVOKE",
    "BOT_ACCESS_POLICY_CHANGED",
    "BOT_TOOL_CALL",
  ] as const;
  const botActivityQuery = z.object({
    take: z.coerce.number().int().min(1).max(50).default(20),
  });

  /** Metadata-only activity journal for Agent Workbench. */
  app.get(
    "/api/servers/:id/bots/:botId/activity",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, botId } = req.params as { id: string; botId: string };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      const parsed = botActivityQuery.safeParse(req.query);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid query" });
      const bot = await db.bot.findUnique({
        where: { id: botId },
        select: { serverId: true },
      });
      if (!bot || bot.serverId !== serverId) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      const events = await db.auditLog.findMany({
        where: {
          type: { in: botActivityTypes.slice() },
          metadata: {
            contains: `"botId":"${botId}"`,
          },
        },
        orderBy: { createdAt: "desc" },
        take: parsed.data.take,
        select: { id: true, type: true, createdAt: true, metadata: true },
      });
      return {
        events: events.map((event) => {
          let metadata: Record<string, unknown> = {};
          try {
            const candidate = JSON.parse(event.metadata ?? "{}");
            if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
              const raw = candidate as Record<string, unknown>;
              metadata = {
                tool: typeof raw.tool === "string" ? raw.tool.slice(0, 64) : undefined,
                outcome: typeof raw.outcome === "string" ? raw.outcome.slice(0, 16) : undefined,
                provider: typeof raw.provider === "string" ? raw.provider.slice(0, 64) : undefined,
                latencyMs: typeof raw.latencyMs === "number" ? raw.latencyMs : undefined,
                channelScope:
                  typeof raw.channelScope === "string" || typeof raw.channelScope === "number"
                    ? raw.channelScope
                    : undefined,
              };
            }
          } catch {
            // Historical malformed metadata stays visible as an event without details.
          }
          return {
            id: event.id,
            type: event.type,
            createdAt: event.createdAt.toISOString(),
            metadata,
          };
        }),
      };
    },
  );
}
