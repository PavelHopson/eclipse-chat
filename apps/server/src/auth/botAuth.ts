import type { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { db } from "../db.js";

/**
 * Bot auth middleware.
 *
 * Запрос с заголовком `Authorization: Bot ecb_<32-char-base64>` загружает
 * bot из БД (по apiKeyPrefix), bcrypt-сравнивает full key, обновляет
 * lastUsedAt fire-and-forget и кладёт `req.bot` для downstream handler'ов.
 *
 * Формат API key:
 *   ecb_<32-char-urlsafe-base64>
 *   - Префикс `ecb_` (eclipse-chat-bot) + 32 случайных символа [A-Za-z0-9_-].
 *   - Полные 36 символов.
 *   - `apiKeyPrefix` (12 chars = `ecb_` + 8) → unique index в БД, O(1) lookup.
 *   - `apiKeyHash` = bcrypt(full key, cost 10).
 *
 * Safety:
 *   - 401 при невалидной schema (anti-enumeration: minimal info в error).
 *   - 401 при mismatch hash — constant-time bcrypt.
 *   - lastUsedAt update — best-effort, не блокирует response.
 *
 * Не использует JWT — bot keys long-lived, без TTL. Revocation = DELETE bot.
 */

export type BotContext = {
  id: string;
  name: string;
  serverId: string;
  userId: string;
  ownerUserId: string;
  capabilities: string[];
};

declare module "fastify" {
  interface FastifyRequest {
    bot?: BotContext;
  }
}

const KEY_PREFIX = "ecb_";
const KEY_LENGTH = 36; // ecb_ + 32

export function isValidKeyFormat(key: string): boolean {
  if (!key.startsWith(KEY_PREFIX)) return false;
  if (key.length !== KEY_LENGTH) return false;
  return /^ecb_[A-Za-z0-9_-]{32}$/.test(key);
}

export async function requireBotAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bot ")) {
    void reply.status(401).send({ error: "Bot authorization required" });
    return;
  }
  const key = auth.slice(4).trim();
  if (!isValidKeyFormat(key)) {
    void reply.status(401).send({ error: "Invalid bot key format" });
    return;
  }
  const prefix = key.slice(0, 12); // ecb_ + 8 chars
  const bot = await db.bot.findUnique({ where: { apiKeyPrefix: prefix } });
  if (!bot) {
    // Constant-time bcrypt против non-existent prefix для anti-timing
    await bcrypt.compare(key, "$2a$10$fakehashtotallyfakedontuse...........");
    void reply.status(401).send({ error: "Invalid bot key" });
    return;
  }
  const ok = await bcrypt.compare(key, bot.apiKeyHash);
  if (!ok) {
    void reply.status(401).send({ error: "Invalid bot key" });
    return;
  }
  // Parse capabilities (graceful fallback на пустой массив).
  let capabilities: string[] = [];
  try {
    const parsed = JSON.parse(bot.capabilities);
    if (Array.isArray(parsed)) capabilities = parsed;
  } catch {
    /* */
  }
  req.bot = {
    id: bot.id,
    name: bot.name,
    serverId: bot.serverId,
    userId: bot.userId,
    ownerUserId: bot.ownerUserId,
    capabilities,
  };
  // Fire-and-forget lastUsedAt update
  void db.bot
    .update({
      where: { id: bot.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);
}
