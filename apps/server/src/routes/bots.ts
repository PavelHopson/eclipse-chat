import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { requireBotAuth } from "../auth/botAuth.js";
import { recordAudit } from "../security/audit.js";
import { emitMessageOnChannel } from "../realtime.js";

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
});

const botMessageBody = z.object({
  channelId: z.string().min(1),
  content: z.string().max(8000).optional().default(""),
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
   * GET /api/servers/:id/bots — список ботов сервера. Member-only.
   * Не отдаёт apiKeyHash / apiKeyPrefix полностью — только public-safe meta.
   */
  app.get(
    "/api/servers/:id/bots",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) return reply.status(403).send({ error: "Not a member" });
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
          owner: b.owner,
          shadowUserId: b.userId,
          // Только префикс — не secret, для UX «ecb_AbCd…» display
          apiKeyPrefix: b.apiKeyPrefix,
          capabilities: JSON.parse(b.capabilities || "[]") as string[],
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
        metadata: { botId: result.id, serverId, name: result.name },
      });
      return {
        bot: {
          id: result.id,
          name: result.name,
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
      const payload = {
        messageId: m.id,
        content: m.content,
        channelId: ch.id,
        userId: shadow.id,
        displayName: shadow.displayName,
        avatar: shadow.avatar,
        createdAt: m.createdAt.toISOString(),
      };
      emitMessageOnChannel(ch.id, payload);
      return { message: payload };
    },
  );

  /**
   * GET /api/bot/me — bot intro/whoami. Используется SDK для health-check.
   */
  app.get(
    "/api/bot/me",
    { onRequest: [requireBotAuth] },
    async (req) => {
      const bot = req.bot!;
      return {
        bot: {
          id: bot.id,
          name: bot.name,
          serverId: bot.serverId,
          shadowUserId: bot.userId,
          capabilities: bot.capabilities,
        },
      };
    },
  );
}
