import type { FastifyInstance } from "fastify";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { snapshotForServer } from "../voicePresence.js";

/**
 * Home «TODAY» — операционная сводка для пользователя поверх всех его
 * workspace'ов. Отвечает на «что происходит в системе прямо сейчас», а не
 * «где переписка» — Eclipse Chat позиционируется как operational system,
 * не messenger.
 *
 *   GET /api/home/today
 *
 * Агрегирует across все серверы где user — member:
 *   - assignedTasks  — открытые ActionItem'ы назначенные на меня (+overdue флаг)
 *   - incidents      — открытые инциденты в моих серверах
 *   - activeVoice    — голосовые каналы где сейчас кто-то в эфире
 */
export function registerHomeRoutes(app: FastifyInstance) {
  app.get("/api/home/today", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Invalid token" });
    }

    const memberships = await db.member.findMany({
      where: { userId },
      select: { serverId: true },
    });
    const serverIds = memberships.map((m) => m.serverId);

    // ── Назначенные на меня открытые задачи (across all workspaces) ──
    const taskRows = await db.actionItem.findMany({
      where: { assigneeUserId: userId, status: "OPEN" },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        title: true,
        type: true,
        dueAt: true,
        serverId: true,
        channelId: true,
        server: { select: { name: true } },
        channel: { select: { name: true } },
      },
    });
    const now = Date.now();
    const assignedTasks = taskRows.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      overdue: t.dueAt ? t.dueAt.getTime() < now : false,
      serverId: t.serverId,
      serverName: t.server.name,
      channelId: t.channelId,
      channelName: t.channel.name,
    }));

    // ── Открытые инциденты в моих серверах ──────────────────────────
    const incidentRows = serverIds.length
      ? await db.incident.findMany({
          where: { serverId: { in: serverIds }, status: "OPEN" },
          orderBy: { openedAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            serverId: true,
            channelId: true,
            openedAt: true,
            server: { select: { name: true } },
          },
        })
      : [];
    const incidents = incidentRows.map((i) => ({
      id: i.id,
      title: i.title,
      serverId: i.serverId,
      serverName: i.server.name,
      channelId: i.channelId,
      openedAt: i.openedAt.toISOString(),
    }));

    // ── Активные голосовые сессии (in-memory voice presence) ────────
    const voiceChannels = serverIds.length
      ? await db.channel.findMany({
          where: { serverId: { in: serverIds }, type: "VOICE" },
          select: { id: true, name: true, serverId: true, server: { select: { name: true } } },
        })
      : [];
    const voiceSnap = snapshotForServer(voiceChannels.map((c) => c.id));
    const activeVoice = voiceChannels
      .filter((c) => (voiceSnap[c.id]?.length ?? 0) > 0)
      .map((c) => ({
        channelId: c.id,
        channelName: c.name,
        serverId: c.serverId,
        serverName: c.server.name,
        count: voiceSnap[c.id]!.length,
      }));

    return {
      assignedTasks,
      incidents,
      activeVoice,
      counts: {
        tasks: assignedTasks.length,
        overdue: assignedTasks.filter((t) => t.overdue).length,
        incidents: incidents.length,
        activeVoice: activeVoice.length,
      },
    };
  });
}
