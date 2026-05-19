import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { encryptSecret, decryptSecret } from "../security/twoFactor.js";
import {
  formatGitHubEvent,
  verifyGitHubSignature,
} from "../lib/integrations/github.js";
import {
  parseTelegramConfig,
  type TelegramConfig,
} from "../lib/integrations/telegram.js";
import { emitMessageOnChannel } from "../realtime.js";
import { userDisplayName } from "../lib/userView.js";
import { getSystemBotUserId } from "../lib/systemBot.js";
import type { MemberRole } from "./servers.js";

/**
 * v0.89 #26 phase 2 — Integration routes.
 *
 *   Admin (OWNER/ADMIN):
 *     GET    /api/servers/:id/integrations         — list
 *     POST   /api/servers/:id/integrations         — create
 *     PATCH  /api/integrations/:id                 — edit (enabled/name/config/channelId)
 *     DELETE /api/integrations/:id
 *
 *   Public (no auth, HMAC-verified):
 *     POST   /api/integrations/gh/:webhookPath     — GitHub webhook receiver
 *
 * Telegram outgoing — это fire-and-forget triggered из channels.ts (см.
 * `fireTelegramOutgoing` helper). UI просто настраивает integration row.
 *
 * Encryption: config (Telegram bot token + chat id) шифруется через
 * `encryptSecret`/`decryptSecret` (AES-256-GCM с TWOFA_ENCRYPTION_KEY).
 * GitHub webhookSecret хранится plaintext (используется только для HMAC).
 */

const createBody = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TELEGRAM_OUTGOING"),
    name: z.string().trim().min(1).max(120),
    channelId: z.string().min(1),
    botToken: z.string().trim().min(10).max(200),
    chatId: z.string().trim().min(1).max(64),
  }),
  z.object({
    type: z.literal("GITHUB_WEBHOOK"),
    name: z.string().trim().min(1).max(120),
    channelId: z.string().min(1),
  }),
]);

const updateBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  channelId: z.string().min(1).optional(),
  /** Только для TELEGRAM_OUTGOING — partial config refresh. */
  botToken: z.string().trim().min(10).max(200).optional(),
  chatId: z.string().trim().min(1).max(64).optional(),
});

type IntegrationRow = {
  id: string;
  serverId: string;
  type: "TELEGRAM_OUTGOING" | "GITHUB_WEBHOOK";
  name: string;
  channelId: string | null;
  webhookPath: string | null;
  enabled: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastEventAt: Date | null;
  eventCount: number;
};

function serialize(int: IntegrationRow & { webhookSecret?: string | null }) {
  return {
    id: int.id,
    serverId: int.serverId,
    type: int.type,
    name: int.name,
    channelId: int.channelId,
    webhookPath: int.webhookPath,
    /**
     * webhookSecret НЕ возвращается через regular API. Frontend получает
     * полный webhook URL через отдельный endpoint при первом view (after
     * create) — `webhookSecret` НЕ leaks обратно после создания.
     * Phase 2: pause-show option «Regenerate secret».
     */
    enabled: int.enabled,
    createdByUserId: int.createdByUserId,
    createdAt: int.createdAt.toISOString(),
    updatedAt: int.updatedAt.toISOString(),
    lastEventAt: int.lastEventAt?.toISOString() ?? null,
    eventCount: int.eventCount,
  };
}

async function isAdmin(userId: string, serverId: string): Promise<boolean> {
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
  if (!member) return false;
  return member.role === "OWNER" || member.role === "ADMIN";
}

// v0.90: getSystemBotUserId переехал в `lib/systemBot.ts` для shared reuse
// между integrations + table row→task conversion.

export function registerIntegrationRoutes(app: FastifyInstance) {
  /** List per server. */
  app.get(
    "/api/servers/:id/integrations",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      if (!(await isAdmin(userId, serverId))) {
        return reply.status(403).send({ error: "Admin only" });
      }
      const rows = await db.integration.findMany({
        where: { serverId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { integrations: rows.map(serialize) };
    },
  );

  /** Create. */
  app.post(
    "/api/servers/:id/integrations",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      if (!(await isAdmin(userId, serverId))) {
        return reply.status(403).send({ error: "Admin only" });
      }
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      // Validate channel exists + belongs to server.
      const channelCheck = await db.channel.findUnique({
        where: { id: parsed.data.channelId },
        select: { serverId: true, type: true },
      });
      if (!channelCheck || channelCheck.serverId !== serverId) {
        return reply
          .status(400)
          .send({ error: "Channel does not belong to this server" });
      }

      if (parsed.data.type === "TELEGRAM_OUTGOING") {
        const cfg: TelegramConfig = {
          botToken: parsed.data.botToken,
          chatId: parsed.data.chatId,
        };
        const encrypted = encryptSecret(JSON.stringify(cfg));
        const created = await db.integration.create({
          data: {
            serverId,
            type: "TELEGRAM_OUTGOING",
            name: parsed.data.name,
            channelId: parsed.data.channelId,
            config: encrypted,
            createdByUserId: userId,
          },
        });
        return { integration: serialize(created) };
      }

      // GITHUB_WEBHOOK
      const webhookPath = randomBytes(16).toString("hex");
      const webhookSecret = randomBytes(24).toString("hex");
      const created = await db.integration.create({
        data: {
          serverId,
          type: "GITHUB_WEBHOOK",
          name: parsed.data.name,
          channelId: parsed.data.channelId,
          config: "{}", // empty for GH
          webhookPath,
          webhookSecret,
          createdByUserId: userId,
        },
      });
      // ОДНОРАЗОВО возвращаем секреты сразу после create (UI показывает,
      // потом — только webhookPath без secret'а).
      return {
        integration: serialize(created),
        github: {
          webhookPath,
          webhookSecret,
          setupHint:
            "В GitHub Settings → Webhooks → Add webhook. Payload URL: " +
            "`https://app.star-crm.ru/eclipse-chat/api/integrations/gh/" +
            webhookPath +
            "`. Content-type: application/json. Secret: " +
            webhookSecret +
            ". Events: push, pull_request, issues, release.",
        },
      };
    },
  );

  /** Edit. */
  app.patch(
    "/api/integrations/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: integrationId } = req.params as { id: string };
      const existing = await db.integration.findUnique({
        where: { id: integrationId },
        select: {
          id: true,
          type: true,
          serverId: true,
          config: true,
          channelId: true,
        },
      });
      if (!existing) return reply.status(404).send({ error: "Integration not found" });
      if (!(await isAdmin(userId, existing.serverId))) {
        return reply.status(403).send({ error: "Admin only" });
      }
      const parsed = updateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const data: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) data.name = parsed.data.name;
      if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
      if (parsed.data.channelId !== undefined) {
        const ch = await db.channel.findUnique({
          where: { id: parsed.data.channelId },
          select: { serverId: true },
        });
        if (!ch || ch.serverId !== existing.serverId) {
          return reply.status(400).send({ error: "Channel not in this server" });
        }
        data.channelId = parsed.data.channelId;
      }
      // Telegram config refresh.
      if (
        existing.type === "TELEGRAM_OUTGOING" &&
        (parsed.data.botToken !== undefined || parsed.data.chatId !== undefined)
      ) {
        let current: TelegramConfig | null = null;
        try {
          current = parseTelegramConfig(decryptSecret(existing.config));
        } catch {
          current = null;
        }
        const next: TelegramConfig = {
          botToken: parsed.data.botToken ?? current?.botToken ?? "",
          chatId: parsed.data.chatId ?? current?.chatId ?? "",
        };
        if (!next.botToken || !next.chatId) {
          return reply.status(400).send({ error: "Telegram config incomplete" });
        }
        data.config = encryptSecret(JSON.stringify(next));
      }
      const updated = await db.integration.update({
        where: { id: integrationId },
        data,
      });
      return { integration: serialize(updated) };
    },
  );

  /** Delete. */
  app.delete(
    "/api/integrations/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: integrationId } = req.params as { id: string };
      const existing = await db.integration.findUnique({
        where: { id: integrationId },
        select: { serverId: true },
      });
      if (!existing) return reply.status(404).send({ error: "Integration not found" });
      if (!(await isAdmin(userId, existing.serverId))) {
        return reply.status(403).send({ error: "Admin only" });
      }
      await db.integration.delete({ where: { id: integrationId } });
      return { deleted: true };
    },
  );

  /**
   * Public GitHub webhook receiver. No auth — HMAC verified.
   *
   * Body parsing: Fastify default JSON parser работает, но для HMAC нам
   * нужен raw body bytes. Решение — global content-type parser
   * (см. index.ts), который сохраняет `req.rawBody` параллельно с parsed.
   */
  app.post(
    "/api/integrations/gh/:webhookPath",
    async (req: FastifyRequest, reply) => {
      const { webhookPath } = req.params as { webhookPath: string };
      const eventType = req.headers["x-github-event"];
      const signature = req.headers["x-hub-signature-256"];
      const rawBody = (req as FastifyRequest & { rawBody?: string }).rawBody ?? "";

      if (typeof eventType !== "string" || !rawBody) {
        return reply.status(400).send({ error: "Missing event headers" });
      }
      const integration = await db.integration.findUnique({
        where: { webhookPath },
        select: {
          id: true,
          type: true,
          enabled: true,
          channelId: true,
          serverId: true,
          webhookSecret: true,
        },
      });
      if (!integration || integration.type !== "GITHUB_WEBHOOK") {
        return reply.status(404).send({ error: "Webhook not found" });
      }
      if (!integration.enabled) {
        return reply.status(200).send({ skipped: "integration disabled" });
      }
      if (!integration.webhookSecret) {
        return reply.status(503).send({ error: "Webhook not configured" });
      }
      if (
        !verifyGitHubSignature(
          rawBody,
          typeof signature === "string" ? signature : undefined,
          integration.webhookSecret,
        )
      ) {
        return reply.status(401).send({ error: "Invalid signature" });
      }
      let payload: unknown;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return reply.status(400).send({ error: "Invalid JSON" });
      }
      const text = formatGitHubEvent(eventType, payload);
      if (!text) {
        // Event type не поддерживается — silently OK для GH retry.
        return reply.status(200).send({ skipped: "unsupported event" });
      }
      if (!integration.channelId) {
        return reply.status(200).send({ skipped: "no target channel" });
      }
      // Post as system bot.
      const systemUserId = await getSystemBotUserId();
      const channel = await db.channel.findUnique({
        where: { id: integration.channelId },
        select: { serverId: true, type: true },
      });
      if (!channel || channel.serverId !== integration.serverId) {
        return reply.status(200).send({ skipped: "channel mismatch" });
      }
      if (channel.type === "VOICE") {
        return reply.status(200).send({ skipped: "voice channel" });
      }
      const msg = await db.message.create({
        data: {
          content: text,
          userId: systemUserId,
          channelId: integration.channelId,
        },
        include: { user: { select: { id: true, displayName: true, avatar: true } } },
      });
      emitMessageOnChannel(integration.channelId, {
        messageId: msg.id,
        content: msg.content,
        channelId: msg.channelId!,
        userId: msg.userId!,
        displayName: userDisplayName(msg.user),
        avatar: msg.user?.avatar ?? null,
        isBot: true,
        createdAt: msg.createdAt.toISOString(),
        attachments: [],
      });
      // Bump counter.
      void db.integration
        .update({
          where: { id: integration.id },
          data: {
            lastEventAt: new Date(),
            eventCount: { increment: 1 },
          },
        })
        .catch(() => undefined);
      return { posted: true };
    },
  );
}

/**
 * v0.89 #26 phase 2 — Telegram outgoing fire-and-forget trigger.
 *
 * Вызывается из routes/channels.ts после `emitMessageOnChannel`. Перебирает
 * enabled TELEGRAM_OUTGOING интеграции для channelId, посылает в TG.
 * Никогда не throws.
 */
export async function fireTelegramOutgoing(
  channelId: string,
  senderName: string,
  content: string,
  log?: import("fastify").FastifyBaseLogger,
): Promise<void> {
  try {
    const integrations = await db.integration.findMany({
      where: {
        type: "TELEGRAM_OUTGOING",
        channelId,
        enabled: true,
      },
      select: { id: true, config: true },
    });
    if (integrations.length === 0) return;
    const { sendTelegramMessage } = await import("../lib/integrations/telegram.js");
    for (const int of integrations) {
      let cfg: TelegramConfig | null = null;
      try {
        cfg = parseTelegramConfig(decryptSecret(int.config));
      } catch (err) {
        log?.warn({ err, id: int.id }, "Telegram integration config decrypt failed");
        continue;
      }
      if (!cfg) continue;
      const trimmed = content.trim().slice(0, 3000);
      const text = `**${senderName}**\n${trimmed}`;
      const ok = await sendTelegramMessage(cfg, text, log);
      if (ok) {
        void db.integration
          .update({
            where: { id: int.id },
            data: {
              lastEventAt: new Date(),
              eventCount: { increment: 1 },
            },
          })
          .catch(() => undefined);
      }
    }
  } catch (err) {
    log?.warn({ err, channelId }, "fireTelegramOutgoing failed");
  }
}
