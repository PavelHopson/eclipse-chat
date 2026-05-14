import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  emitChannelCreated,
  emitIncidentOpened,
  emitIncidentResolved,
} from "../realtime.js";
import { chat, isAiConfigured } from "../ai/provider.js";
import { incidentPostMortemPrompt } from "../ai/prompts.js";

/**
 * Incident Mode — операторский «контур разбора».
 *
 * POST   /api/servers/:id/incidents     — открыть инцидент (любой member).
 *   Создаёт Incident-запись + dedicated TEXT-канал (emoji 🚨, position -100
 *   чтобы был сверху списка), линкует через Incident.channelId ↔ Channel.incidentId.
 *
 * GET    /api/servers/:id/incidents     — список инцидентов сервера.
 * GET    /api/incidents/:id             — детали + timeline (actions + pinned).
 * PATCH  /api/incidents/:id/resolve     — закрыть. Status RESOLVED + resolvedAt
 *   ставятся синхронно (responsive UX). Post-mortem генерится Ollama
 *   fire-and-forget — по готовности UPDATE postMortem + emit incident:resolved
 *   с hasPostMortem=true. Resolve работает даже если AI не настроен.
 *
 * Permissions:
 *   - open / list / detail — любой member сервера
 *   - resolve — openedBy ИЛИ OWNER/ADMIN/MODERATOR
 */

const openIncidentBody = z.object({
  title: z.string().trim().min(1).max(160),
});

/** Уникальный slug для incident-канала. inc-<base36 timestamp>-<rand>. */
function incidentSlug(): string {
  return `inc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function registerIncidentRoutes(app: FastifyInstance) {
  /**
   * POST /api/servers/:id/incidents — открыть инцидент.
   */
  app.post(
    "/api/servers/:id/incidents",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = openIncidentBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const opener = await db.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });
      if (!opener) {
        return reply.status(401).send({ error: "User not found" });
      }

      const title = parsed.data.title;
      const now = new Date();

      // Создаём Incident + dedicated channel в транзакции.
      // Сначала incident (нужен id для Channel.incidentId), потом channel,
      // потом back-link Incident.channelId.
      const { incident, channel } = await db.$transaction(async (tx) => {
        const inc = await tx.incident.create({
          data: {
            serverId,
            title,
            openedByUserId: userId,
            openedAt: now,
            status: "OPEN",
          },
        });
        const ch = await tx.channel.create({
          data: {
            name: title,
            slug: incidentSlug(),
            serverId,
            type: "TEXT",
            emoji: "🚨",
            // position -100 — incident-каналы всегда наверху списка каналов
            position: -100,
            description: `Инцидент открыт ${now.toLocaleString("ru-RU")} · ${opener.displayName}`,
            incidentId: inc.id,
          },
        });
        const linkedIncident = await tx.incident.update({
          where: { id: inc.id },
          data: { channelId: ch.id },
        });
        return { incident: linkedIncident, channel: ch };
      });

      // emit channel:created — ChannelList у всех в сервере получит новый канал
      emitChannelCreated(serverId, {
        channelId: channel.id,
        serverId,
        name: channel.name,
        slug: channel.slug,
        type: channel.type,
        position: channel.position,
        createdAt: channel.createdAt.toISOString(),
      });
      // emit incident:opened — incident list update
      emitIncidentOpened(serverId, {
        incidentId: incident.id,
        serverId,
        title: incident.title,
        channelId: incident.channelId,
        openedByUserId: userId,
        openedByName: opener.displayName,
        openedAt: incident.openedAt.toISOString(),
      });

      return {
        incident: {
          id: incident.id,
          serverId: incident.serverId,
          title: incident.title,
          status: incident.status,
          channelId: incident.channelId,
          openedByUserId: incident.openedByUserId,
          openedByName: opener.displayName,
          openedAt: incident.openedAt.toISOString(),
          resolvedAt: null,
          postMortem: null,
        },
        channel: {
          id: channel.id,
          name: channel.name,
          slug: channel.slug,
          type: channel.type,
          position: channel.position,
          description: channel.description,
          emoji: channel.emoji,
        },
      };
    },
  );

  /**
   * GET /api/servers/:id/incidents — список инцидентов сервера, новые сверху.
   */
  app.get(
    "/api/servers/:id/incidents",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const incidents = await db.incident.findMany({
        where: { serverId },
        orderBy: { openedAt: "desc" },
        take: 100,
        include: {
          openedBy: { select: { displayName: true } },
        },
      });
      return {
        incidents: incidents.map((inc) => ({
          id: inc.id,
          serverId: inc.serverId,
          title: inc.title,
          status: inc.status,
          channelId: inc.channelId,
          openedByUserId: inc.openedByUserId,
          openedByName: inc.openedBy.displayName,
          openedAt: inc.openedAt.toISOString(),
          resolvedAt: inc.resolvedAt?.toISOString() ?? null,
          hasPostMortem: inc.postMortem != null,
        })),
      };
    },
  );

  /**
   * GET /api/incidents/:id — детали инцидента + timeline.
   * Timeline = decisions + tasks/follow-ups + pinned messages incident-канала.
   */
  app.get(
    "/api/incidents/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: incidentId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const incident = await db.incident.findUnique({
        where: { id: incidentId },
        include: {
          openedBy: { select: { displayName: true } },
        },
      });
      if (!incident) {
        return reply.status(404).send({ error: "Incident not found" });
      }
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: incident.serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      // Timeline собираем из incident-канала (если он ещё существует)
      let actionItems: Array<{
        id: string;
        title: string;
        type: string;
        status: string;
        assigneeName: string | null;
      }> = [];
      let pinned: Array<{ id: string; content: string; authorName: string }> = [];

      if (incident.channelId) {
        const [actions, pins] = await Promise.all([
          db.actionItem.findMany({
            where: { channelId: incident.channelId },
            orderBy: [{ status: "asc" }, { createdAt: "asc" }],
            include: { assignee: { select: { displayName: true } } },
          }),
          db.message.findMany({
            where: { channelId: incident.channelId, pinnedAt: { not: null }, deletedAt: null },
            orderBy: { pinnedAt: "desc" },
            take: 20,
            include: { user: { select: { displayName: true } } },
          }),
        ]);
        actionItems = actions.map((a) => ({
          id: a.id,
          title: a.title,
          type: a.type,
          status: a.status,
          assigneeName: a.assignee?.displayName ?? null,
        }));
        pinned = pins.map((p) => ({
          id: p.id,
          content: p.content,
          authorName: p.user.displayName,
        }));
      }

      return {
        incident: {
          id: incident.id,
          serverId: incident.serverId,
          title: incident.title,
          status: incident.status,
          channelId: incident.channelId,
          openedByUserId: incident.openedByUserId,
          openedByName: incident.openedBy.displayName,
          openedAt: incident.openedAt.toISOString(),
          resolvedAt: incident.resolvedAt?.toISOString() ?? null,
          postMortem: incident.postMortem,
        },
        timeline: { actionItems, pinned },
      };
    },
  );

  /**
   * PATCH /api/incidents/:id/resolve — закрыть инцидент.
   * Status + resolvedAt — синхронно. Post-mortem — fire-and-forget Ollama.
   */
  app.patch(
    "/api/incidents/:id/resolve",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: incidentId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const incident = await db.incident.findUnique({
        where: { id: incidentId },
        include: { openedBy: { select: { displayName: true } } },
      });
      if (!incident) {
        return reply.status(404).send({ error: "Incident not found" });
      }
      if (incident.status === "RESOLVED") {
        return reply.status(409).send({ error: "Инцидент уже закрыт" });
      }
      // Permission: openedBy ИЛИ OWNER/ADMIN/MODERATOR
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: incident.serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const isOpener = incident.openedByUserId === userId;
      const isMod =
        member.role === "OWNER" ||
        member.role === "ADMIN" ||
        member.role === "MODERATOR";
      if (!isOpener && !isMod) {
        return reply.status(403).send({
          error: "Закрыть инцидент может тот кто открыл, либо OWNER/ADMIN/MODERATOR",
        });
      }

      const resolvedAt = new Date();
      const updated = await db.incident.update({
        where: { id: incidentId },
        data: { status: "RESOLVED", resolvedAt },
      });

      // Post-mortem генерится async — не блокируем response.
      // Resolve уже применён; post-mortem прилетит через socket позже.
      if (incident.channelId && isAiConfigured()) {
        const channelId = incident.channelId;
        void (async () => {
          try {
            const [decisionsRaw, actionsRaw, pinnedRaw, messagesRaw] =
              await Promise.all([
                db.actionItem.findMany({
                  where: { channelId, type: "DECISION" },
                  include: { assignee: { select: { displayName: true } } },
                  orderBy: { createdAt: "asc" },
                  take: 20,
                }),
                db.actionItem.findMany({
                  where: { channelId, type: { in: ["TASK", "FOLLOW_UP"] } },
                  include: { assignee: { select: { displayName: true } } },
                  orderBy: { createdAt: "asc" },
                  take: 24,
                }),
                db.message.findMany({
                  where: { channelId, pinnedAt: { not: null }, deletedAt: null },
                  include: { user: { select: { displayName: true } } },
                  orderBy: { pinnedAt: "desc" },
                  take: 10,
                }),
                db.message.findMany({
                  where: { channelId, deletedAt: null, parentMessageId: null },
                  include: { user: { select: { displayName: true } } },
                  orderBy: { createdAt: "asc" },
                  take: 60,
                }),
              ]);

            const mapAction = (a: (typeof actionsRaw)[number]) => ({
              type: a.type,
              title: a.title,
              dueAt: a.dueAt?.toISOString() ?? null,
              assignee: a.assignee ? { displayName: a.assignee.displayName } : null,
              status: a.status,
            });

            const prompt = incidentPostMortemPrompt({
              title: incident.title,
              openedAt: incident.openedAt.toISOString(),
              resolvedAt: resolvedAt.toISOString(),
              openedByName: incident.openedBy.displayName,
              decisions: decisionsRaw.map(mapAction),
              actionItems: actionsRaw.map(mapAction),
              pinned: pinnedRaw.map((p) => ({
                content: p.content,
                user: { displayName: p.user.displayName },
              })),
              messages: messagesRaw.map((m) => ({
                displayName: m.user.displayName,
                content: m.content,
                createdAt: m.createdAt.toISOString(),
              })),
            });

            const result = await chat(
              [
                { role: "system", content: prompt.system },
                { role: "user", content: prompt.user },
              ],
              { temperature: 0.4, maxTokens: 900 },
            );

            await db.incident.update({
              where: { id: incidentId },
              data: { postMortem: result.text },
            });
            emitIncidentResolved(incident.serverId, {
              incidentId,
              serverId: incident.serverId,
              resolvedAt: resolvedAt.toISOString(),
              hasPostMortem: true,
            });
            app.log.info(
              { incidentId, provider: result.provider, latencyMs: result.latencyMs },
              "Incident post-mortem generated",
            );
          } catch (err) {
            app.log.warn({ err, incidentId }, "Incident post-mortem generation failed");
            // post-mortem остаётся null — UI покажет «не сгенерирован».
            // resolve уже применён, инцидент закрыт корректно.
            emitIncidentResolved(incident.serverId, {
              incidentId,
              serverId: incident.serverId,
              resolvedAt: resolvedAt.toISOString(),
              hasPostMortem: false,
            });
          }
        })();
      } else {
        // AI не настроен или нет канала — resolve без post-mortem.
        emitIncidentResolved(incident.serverId, {
          incidentId,
          serverId: incident.serverId,
          resolvedAt: resolvedAt.toISOString(),
          hasPostMortem: false,
        });
      }

      return {
        incident: {
          id: updated.id,
          serverId: updated.serverId,
          title: updated.title,
          status: updated.status,
          channelId: updated.channelId,
          openedByUserId: updated.openedByUserId,
          openedByName: incident.openedBy.displayName,
          openedAt: updated.openedAt.toISOString(),
          resolvedAt: updated.resolvedAt?.toISOString() ?? null,
          postMortem: updated.postMortem,
        },
        // postMortemPending: true если AI генерит в фоне — UI покажет spinner
        postMortemPending:
          Boolean(incident.channelId) && isAiConfigured(),
      };
    },
  );
}
