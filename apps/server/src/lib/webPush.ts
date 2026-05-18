/**
 * v0.84 #27 phase 3 — Web Push notifications helper.
 *
 * Wraps `web-push` lib. Реализует:
 *   - Lazy VAPID config (reads env on first call, fail-safe если missing).
 *   - `notifyUser(userId, payload)` — fetch active subs + send + cleanup
 *     stale (HTTP 404 / 410 = expired endpoint).
 *   - Fire-and-forget — never throws, never blocks caller. Errors only
 *     logged. Push не должен ломать message:new или task creation flow.
 *
 * Privacy:
 *   - Payload через web-push шифруется browser-public-key + auth secret
 *     RFC 8291 aes128gcm content-encoding. Push-сервис (Google/Mozilla)
 *     видит только endpoint + encrypted blob.
 *   - Payload size cap 4KB (запас под TLS overhead). Сообщения длиннее
 *     truncate'ятся.
 *
 * Triggers (phase 3): mention (TEXT + DM), ActionItem assignee/approver
 * set, escalation. Phase 4 — per-event-type toggle, per-channel mute.
 */

import type { FastifyBaseLogger } from "fastify";
import webPush from "web-push";
import { db } from "../db.js";

let vapidConfigured = false;
let vapidPublicKey: string | null = null;

/**
 * Lazy init из ENV. Возвращает true если ключи валидные и web-push готов.
 * При отсутствии ключей — push silently disabled, helper'ы no-op.
 */
function ensureVapidConfig(): boolean {
  if (vapidConfigured) return vapidPublicKey !== null;
  vapidConfigured = true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return false;
  }
  try {
    webPush.setVapidDetails(subject, publicKey, privateKey);
    vapidPublicKey = publicKey;
    return true;
  } catch {
    return false;
  }
}

/** Returns public key для frontend (через GET /api/push/config). null если push disabled. */
export function getPublicVapidKey(): string | null {
  ensureVapidConfig();
  return vapidPublicKey;
}

/** Push enabled = VAPID config valid + at least one user can subscribe. */
export function isPushEnabled(): boolean {
  return ensureVapidConfig();
}

/**
 * Payload, который сериализуется в JSON и заворачивается web-push'ом.
 * Service worker парсит JSON в `push` event handler'е.
 *
 * Convention:
 *   - title — короткий subject (до 60 chars).
 *   - body — preview text (до 160 chars, truncate'нем если длиннее).
 *   - url — deep link для `notificationclick` handler. Relative path
 *     (`/eclipse-chat/...`).
 *   - tag — для dedupe одинаковых notifications (новый push с тем же
 *     tag перезаписывает старый, OS уведомляет только один раз).
 *   - icon — optional override (default favicon из manifest).
 */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
};

const MAX_TITLE = 60;
const MAX_BODY = 160;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/**
 * Отправить notification конкретному user'у на все его devices.
 *
 * Fire-and-forget: возвращает Promise что resolves к counts (sent/cleaned),
 * но caller обычно делает `void notifyUser(...)`. Не throws — все errors
 * логируются.
 *
 * Lifecycle:
 *   1. Fetch active subscriptions.
 *   2. Send concurrently, await all.
 *   3. Cleanup expired (HTTP 404 / 410).
 *   4. Bump lastSeenAt для successful sends.
 */
export async function notifyUser(
  userId: string,
  payload: PushPayload,
  log?: FastifyBaseLogger,
): Promise<{ sent: number; expired: number; failed: number }> {
  if (!ensureVapidConfig()) {
    return { sent: 0, expired: 0, failed: 0 };
  }
  const subs = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) {
    return { sent: 0, expired: 0, failed: 0 };
  }

  const safePayload: PushPayload = {
    title: truncate(payload.title, MAX_TITLE),
    body: truncate(payload.body, MAX_BODY),
    url: payload.url,
    tag: payload.tag,
    icon: payload.icon,
  };
  const payloadJson = JSON.stringify(safePayload);

  let sent = 0;
  let expired = 0;
  let failed = 0;
  const expiredIds: string[] = [];
  const sentIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadJson,
          { TTL: 86400 }, // 24h — после переустановить doesn't make sense
        );
        sent++;
        sentIds.push(sub.id);
      } catch (e: unknown) {
        // web-push lib бросает с .statusCode для HTTP errors
        const status =
          typeof e === "object" && e !== null && "statusCode" in e
            ? Number((e as { statusCode: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          expired++;
          expiredIds.push(sub.id);
        } else {
          failed++;
          log?.warn({ err: e, userId, status }, "Push send failed");
        }
      }
    }),
  );

  // Cleanup expired в фоне — не блокируем return.
  if (expiredIds.length > 0) {
    void db.pushSubscription
      .deleteMany({ where: { id: { in: expiredIds } } })
      .catch((err) => log?.warn({ err }, "Failed to cleanup expired push subs"));
  }
  if (sentIds.length > 0) {
    void db.pushSubscription
      .updateMany({
        where: { id: { in: sentIds } },
        data: { lastSeenAt: new Date() },
      })
      .catch((err) => log?.warn({ err }, "Failed to bump lastSeenAt"));
  }

  return { sent, expired, failed };
}

/**
 * Notify сразу нескольких user'ов (например — mention двух человек в
 * сообщении). Внутри — parallel Promise.all over notifyUser, не блокирует
 * caller.
 */
export async function notifyUsers(
  userIds: readonly string[],
  payload: PushPayload,
  log?: FastifyBaseLogger,
): Promise<void> {
  if (userIds.length === 0) return;
  const unique = Array.from(new Set(userIds));
  await Promise.all(unique.map((id) => notifyUser(id, payload, log)));
}
