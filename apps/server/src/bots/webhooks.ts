import { createHmac } from "node:crypto";
import { db } from "../db.js";
import type { FastifyBaseLogger } from "fastify";
import type { BotRoleValue } from "../ai/botRoles.js";

/**
 * Outbound webhook fan-out для bot subscribers.
 *
 * При message.created событии:
 *   1. Находит всех bot'ов сервера с непустым webhookUrl
 *   2. Фильтрует subscribed events (webhookEvents JSON contains "message.created")
 *   3. POST'ит payload + HMAC-SHA256 signature (если webhookSecret задан)
 *   4. Fire-and-forget — не блокируем response. Failures логируются.
 *
 * Anti-loop: bot не получает свои собственные сообщения (filter by userId).
 *
 * Timeout 5s — если bot endpoint медленный, мы не висим.
 */

type MessageCreatedPayload = {
  messageId: string;
  channelId: string;
  serverId: string;
  userId: string;
  displayName: string;
  content: string;
  isBot: boolean;
  /** Taxonomy-роль автора, если isBot. Null для human-сообщений + system bot без Bot row. */
  botRole?: BotRoleValue | null;
  createdAt: string;
};

const WEBHOOK_TIMEOUT_MS = 5_000;

export function fireMessageCreatedWebhooks(
  serverId: string,
  payload: MessageCreatedPayload,
  log: FastifyBaseLogger,
): void {
  // Fire-and-forget — не await
  void (async () => {
    try {
      const bots = await db.bot.findMany({
        where: {
          serverId,
          webhookUrl: { not: null },
        },
        select: {
          id: true,
          webhookUrl: true,
          webhookSecret: true,
          webhookEvents: true,
          userId: true,
        },
      });
      if (bots.length === 0) return;
      const fullPayload = {
        event: "message.created" as const,
        ...payload,
      };
      const body = JSON.stringify(fullPayload);
      for (const bot of bots) {
        if (!bot.webhookUrl) continue;
        // Anti-loop: bot НЕ получает свои собственные сообщения
        if (bot.userId === payload.userId) continue;
        let events: string[] = [];
        try {
          events = JSON.parse(bot.webhookEvents || "[]") as string[];
        } catch {
          events = ["message.created"];
        }
        if (!events.includes("message.created")) continue;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Eclipse-Event": "message.created",
          "X-Eclipse-Bot-Id": bot.id,
        };
        if (bot.webhookSecret) {
          const sig = createHmac("sha256", bot.webhookSecret)
            .update(body)
            .digest("hex");
          headers["X-Eclipse-Bot-Signature"] = `sha256=${sig}`;
        }

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
        try {
          const res = await fetch(bot.webhookUrl, {
            method: "POST",
            headers,
            body,
            signal: ctrl.signal,
          });
          if (!res.ok) {
            log.warn(
              { botId: bot.id, status: res.status, url: bot.webhookUrl },
              "Bot webhook returned non-2xx",
            );
          }
        } catch (err) {
          log.warn(
            { err, botId: bot.id, url: bot.webhookUrl },
            "Bot webhook failed (network/timeout)",
          );
        } finally {
          clearTimeout(timer);
        }
      }
    } catch (err) {
      log.error({ err }, "fireMessageCreatedWebhooks orchestrator failed");
    }
  })();
}
