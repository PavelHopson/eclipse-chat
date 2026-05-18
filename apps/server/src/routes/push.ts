import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  getPublicVapidKey,
  isPushEnabled,
  notifyUserDirect,
} from "../lib/webPush.js";

/**
 * v0.84 #27 phase 3 — Push subscription routes.
 *
 *   GET    /api/push/config     — returns VAPID public key (или null).
 *   GET    /api/push/subscriptions — список моих subscriptions.
 *   POST   /api/push/subscribe  — register subscription (upsert by endpoint).
 *   DELETE /api/push/subscribe  — unsubscribe конкретный endpoint.
 *   POST   /api/push/test       — отправить test notification на все мои
 *                                  subscriptions (для troubleshooting в UI).
 *
 * Permission: все routes — auth-gated через requireJwt. Subscription
 * tied to user (per-device). Endpoints validate ownership через userId
 * match (unique по endpoint global, но мы doublecheck).
 *
 * Privacy: endpoint никогда не возвращается клиенту в полном виде —
 * только префикс (для UI «вот это устройство»). Полный endpoint —
 * браузер сам знает и не нужно дублировать.
 */

const subscribeBody = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
  userAgent: z.string().max(500).optional(),
});

const unsubscribeBody = z.object({
  endpoint: z.string().url().max(2048),
});

/** Возвращает короткий fingerprint endpoint'а для UI («Chrome on Mac · ...»).
 *  Полный endpoint не leak'ается — это URL push-сервиса с уникальным id юзера. */
function summarizeEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.hostname;
  } catch {
    return "—";
  }
}

export function registerPushRoutes(app: FastifyInstance) {
  app.get("/api/push/config", async () => {
    return {
      enabled: isPushEnabled(),
      publicKey: getPublicVapidKey(),
    };
  });

  app.get(
    "/api/push/subscriptions",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const subs = await db.pushSubscription.findMany({
        where: { userId },
        orderBy: { lastSeenAt: "desc" },
        select: {
          id: true,
          endpoint: true,
          userAgent: true,
          createdAt: true,
          lastSeenAt: true,
        },
      });
      return {
        subscriptions: subs.map((s) => ({
          id: s.id,
          endpointHost: summarizeEndpoint(s.endpoint),
          userAgent: s.userAgent,
          createdAt: s.createdAt.toISOString(),
          lastSeenAt: s.lastSeenAt.toISOString(),
        })),
      };
    },
  );

  app.post(
    "/api/push/subscribe",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      if (!isPushEnabled()) {
        return reply
          .status(503)
          .send({ error: "Push notifications не настроены на сервере" });
      }
      const parsed = subscribeBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid subscription body" });
      }
      const { endpoint, keys, userAgent } = parsed.data;

      // Upsert: endpoint unique глобально. Если уже зарегистрирован — мог
      // быть привязан к другому user'у (smene'нили аккаунт в одном
      // браузере). Перезаписываем — текущий user становится новым owner'ом.
      const sub = await db.pushSubscription.upsert({
        where: { endpoint },
        create: {
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent,
        },
        update: {
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent,
          lastSeenAt: new Date(),
        },
        select: { id: true, createdAt: true },
      });
      return { id: sub.id, created: true };
    },
  );

  app.delete(
    "/api/push/subscribe",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = unsubscribeBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      // Ownership check + delete one-shot. Если endpoint существует но
      // принадлежит другому user'у — silently ignore (404 not leak инфу).
      const result = await db.pushSubscription.deleteMany({
        where: { endpoint: parsed.data.endpoint, userId },
      });
      return { deleted: result.count };
    },
  );

  /**
   * v0.85 #27 phase 4: per-event-type preferences.
   *
   *   GET /api/push/preferences — current state (default-all-true если row отсутствует).
   *   PUT /api/push/preferences — upsert с partial body (только переданные поля меняются).
   */
  app.get(
    "/api/push/preferences",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const row = await db.notificationPreferences.findUnique({
        where: { userId },
        select: {
          mentions: true,
          dms: true,
          assignments: true,
          approvals: true,
          escalations: true,
        },
      });
      // Default — все true (отсутствие row = full opt-in).
      return (
        row ?? {
          mentions: true,
          dms: true,
          assignments: true,
          approvals: true,
          escalations: true,
        }
      );
    },
  );

  const prefsBody = z
    .object({
      mentions: z.boolean().optional(),
      dms: z.boolean().optional(),
      assignments: z.boolean().optional(),
      approvals: z.boolean().optional(),
      escalations: z.boolean().optional(),
    })
    .strict();

  app.put(
    "/api/push/preferences",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = prefsBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const patch = parsed.data;
      const row = await db.notificationPreferences.upsert({
        where: { userId },
        create: {
          userId,
          // Default-true для не указанных полей (consistent с GET behavior).
          mentions: patch.mentions ?? true,
          dms: patch.dms ?? true,
          assignments: patch.assignments ?? true,
          approvals: patch.approvals ?? true,
          escalations: patch.escalations ?? true,
        },
        update: patch,
        select: {
          mentions: true,
          dms: true,
          assignments: true,
          approvals: true,
          escalations: true,
        },
      });
      return row;
    },
  );

  /**
   * v0.85 #27 phase 4: per-channel mute.
   *
   *   GET    /api/push/muted-channels — список заглушённых каналов.
   *   POST   /api/channels/:id/mute   — заглушить (membership-gated).
   *   DELETE /api/channels/:id/mute   — снять mute.
   */
  app.get(
    "/api/push/muted-channels",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const rows = await db.mutedChannel.findMany({
        where: { userId },
        select: { channelId: true, mutedAt: true },
      });
      return {
        muted: rows.map((r) => ({
          channelId: r.channelId,
          mutedAt: r.mutedAt.toISOString(),
        })),
      };
    },
  );

  app.post(
    "/api/channels/:id/mute",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      // Membership check: user должен иметь access к каналу. Проверяем
      // через server-membership (DM каналы не имеют serverId — для них
      // mute мы пока не поддерживаем; phase 5).
      const channel = await db.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true },
      });
      if (!channel) {
        return reply.status(404).send({ error: "Channel not found" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: channel.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member" });
      }
      await db.mutedChannel.upsert({
        where: { userId_channelId: { userId, channelId } },
        create: { userId, channelId },
        update: {}, // no-op — mutedAt не бампим при re-mute
      });
      return { muted: true };
    },
  );

  app.delete(
    "/api/channels/:id/mute",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: channelId } = req.params as { id: string };
      // Idempotent — отсутствие row OK.
      await db.mutedChannel
        .delete({ where: { userId_channelId: { userId, channelId } } })
        .catch(() => undefined);
      return { muted: false };
    },
  );

  app.post(
    "/api/push/test",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      if (!isPushEnabled()) {
        return reply
          .status(503)
          .send({ error: "Push notifications не настроены на сервере" });
      }
      // v0.85: test bypass'ит pref/mute checks — user явно тестирует.
      const stats = await notifyUserDirect(
        userId,
        {
          title: "Eclipse Chat — тестовое уведомление",
          body: "Push работает. Закройте, если получили.",
          url: "/eclipse-chat/",
          tag: "test",
        },
        req.log,
      );
      return stats;
    },
  );
}
