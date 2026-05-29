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
import { isInQuietHours } from "./quietHours.js";

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
 * v0.85 #27 phase 4: event types для per-event-type filtering.
 *
 *   mention      — @<displayName> в server channel
 *   dm           — DM message (1-to-1 или group)
 *   assignment   — ActionItem.assigneeUserId set на recipient
 *   approval     — ActionItem.approverUserId set на recipient
 *   escalation   — overdue 48h+ escalation cron
 */
export type NotificationEvent =
  | "mention"
  | "dm"
  | "assignment"
  | "approval"
  | "escalation";

/** Маппинг event → поле в NotificationPreferences. */
const EVENT_TO_PREF: Record<NotificationEvent, keyof PrefRow> = {
  mention: "mentions",
  dm: "dms",
  assignment: "assignments",
  approval: "approvals",
  escalation: "escalations",
};

type PrefRow = {
  mentions: boolean;
  dms: boolean;
  assignments: boolean;
  approvals: boolean;
  escalations: boolean;
};

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
 *   - channelId — для per-channel mute check (если user заглушил канал,
 *     push skip'ается даже если event-type enabled). Phase 4. Если нет
 *     channelId (например, escalation которая может быть в любом
 *     канале) — mute check skip'нется.
 */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
  /** v0.85: channelId для per-channel mute check. */
  channelId?: string;
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
 * Lifecycle (v0.85 #27 phase 4):
 *   1. Check per-event-type preference (default enabled). Skip если off.
 *   2. Check per-channel mute (если payload.channelId задан). Skip если muted.
 *   3. Fetch active subscriptions.
 *   4. Send concurrently, await all.
 *   5. Cleanup expired (HTTP 404 / 410).
 *   6. Bump lastSeenAt для successful sends.
 */
export async function notifyUser(
  userId: string,
  event: NotificationEvent,
  payload: PushPayload,
  log?: FastifyBaseLogger,
): Promise<{ sent: number; expired: number; failed: number; skipped?: string }> {
  if (!ensureVapidConfig()) {
    return { sent: 0, expired: 0, failed: 0 };
  }

  // v0.85: check user preferences (default = enabled если row отсутствует).
  const prefs = await db.notificationPreferences.findUnique({
    where: { userId },
    select: {
      mentions: true,
      dms: true,
      assignments: true,
      approvals: true,
      escalations: true,
    },
  });
  if (prefs) {
    const fieldName = EVENT_TO_PREF[event];
    if (prefs[fieldName] === false) {
      return { sent: 0, expired: 0, failed: 0, skipped: "event-disabled" };
    }
  }

  // v1.5.49 B5: check quiet hours. Independent от per-event preferences —
  // mentions/dms/etc могут быть enabled, но если sleep window — skip.
  const quiet = await db.user.findUnique({
    where: { id: userId },
    select: { quietFrom: true, quietTo: true, timezone: true },
  });
  if (quiet && isInQuietHours(quiet)) {
    return { sent: 0, expired: 0, failed: 0, skipped: "quiet-hours" };
  }

  // v0.85: check per-channel mute (если payload содержит channelId).
  if (payload.channelId) {
    const muted = await db.mutedChannel.findUnique({
      where: {
        userId_channelId: { userId, channelId: payload.channelId },
      },
      select: { userId: true },
    });
    if (muted) {
      return { sent: 0, expired: 0, failed: 0, skipped: "channel-muted" };
    }
  }

  return notifyUserDirect(userId, payload, log);
}

/**
 * Raw send без pref/mute checks — для test-endpoint'а где user явно тестирует
 * связку. Не должен использоваться для regular triggers (иначе игнорирует
 * user opt-out).
 */
export async function notifyUserDirect(
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
 * caller. v0.85: takes event type для per-recipient pref filtering.
 */
export async function notifyUsers(
  userIds: readonly string[],
  event: NotificationEvent,
  payload: PushPayload,
  log?: FastifyBaseLogger,
): Promise<void> {
  if (userIds.length === 0) return;
  const unique = Array.from(new Set(userIds));
  await Promise.all(unique.map((id) => notifyUser(id, event, payload, log)));
}
