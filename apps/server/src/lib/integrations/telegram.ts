/**
 * v0.89 #26 phase 2 — Telegram outgoing bridge.
 *
 * При новом message в bridged Eclipse channel — fire-and-forget POST
 * на `api.telegram.org/bot<token>/sendMessage` с chatId из integration
 * config. Никаких npm deps (raw fetch).
 *
 * SSRF: используем only telegram.org domain — фиксированный whitelist.
 * Token + chatId encrypted на rest в Integration.config (см. webPush
 * pattern + 2FA encryption — reuse encryptSecret/decryptSecret).
 *
 * Phase 2b — incoming bridge (TG webhook → Eclipse). Требует public
 * URL + ngrok-style routing или TG long-polling worker.
 */

import type { FastifyBaseLogger } from "fastify";

const TG_API_BASE = "https://api.telegram.org";

export type TelegramConfig = {
  botToken: string;
  chatId: string;
};

/**
 * Validate config shape после JSON.parse. Returns null если invalid.
 */
export function parseTelegramConfig(raw: string): TelegramConfig | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.botToken === "string" &&
      parsed.botToken.length > 0 &&
      typeof parsed.chatId === "string" &&
      parsed.chatId.length > 0
    ) {
      return { botToken: parsed.botToken, chatId: parsed.chatId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Send message в Telegram chat. Returns success boolean.
 * Никогда не throws — все errors logged.
 */
export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
  log?: FastifyBaseLogger,
): Promise<boolean> {
  // Sanity-check token shape: `<digits>:<base64ish>`. Reject anything
  // weird up-front (paranoid против injection в URL).
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(config.botToken)) {
    log?.warn("Invalid Telegram bot token format — skipping send");
    return false;
  }
  const url = `${TG_API_BASE}/bot${config.botToken}/sendMessage`;
  const trimmed = text.slice(0, 4000); // TG limit ~4096; safe margin

  // 10-second timeout — TG occasionally slow.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: trimmed,
        disable_web_page_preview: false,
        parse_mode: "Markdown",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log?.warn({ status: res.status, body: body.slice(0, 200) }, "Telegram send failed");
      return false;
    }
    return true;
  } catch (err) {
    log?.warn({ err }, "Telegram fetch error");
    return false;
  } finally {
    clearTimeout(timer);
  }
}
