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

    // ── v0.69: На моём одобрении (Approvals waiting on me) ──────────
    // ActionItems где я approver + status PENDING. Не зависит от server-
    // membership напрямую (approver мог быть назначен в чужой server'е),
    // но FK approverUserId → User обеспечивает что это валидные items.
    const approvalRows = await db.actionItem.findMany({
      where: { approverUserId: userId, approvalStatus: "PENDING" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        type: true,
        serverId: true,
        channelId: true,
        updatedAt: true,
        server: { select: { name: true } },
        channel: { select: { name: true } },
        createdBy: { select: { displayName: true } },
      },
    });
    const pendingApprovals = approvalRows.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      serverId: a.serverId,
      serverName: a.server.name,
      channelId: a.channelId,
      channelName: a.channel.name,
      requestedAt: a.updatedAt.toISOString(),
      requestedBy: a.createdBy?.displayName ?? "—",
    }));

    // ── v0.69: Активные комнаты (recent activity heat) ──────────────
    // Top-5 TEXT-channels с сообщениями за последний час across мои
    // servers. Группировка by channelId через JS (group + take 5)
    // вместо тяжёлого SQL — для MVP scope 100-1000 messages в 1h в
    // small workspace это милисекунды.
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const recentMessages = serverIds.length
      ? await db.message.findMany({
          where: {
            channel: { serverId: { in: serverIds }, type: "TEXT" },
            createdAt: { gte: oneHourAgo },
            deletedAt: null,
          },
          select: {
            channelId: true,
            userId: true,
          },
        })
      : [];
    const activityByChannel = new Map<
      string,
      { messages: number; uniqueAuthors: Set<string> }
    >();
    for (const m of recentMessages) {
      if (!m.channelId) continue;
      const cur =
        activityByChannel.get(m.channelId) ?? {
          messages: 0,
          uniqueAuthors: new Set<string>(),
        };
      cur.messages += 1;
      if (m.userId) cur.uniqueAuthors.add(m.userId);
      activityByChannel.set(m.channelId, cur);
    }
    const topChannelIds = [...activityByChannel.entries()]
      .sort((a, b) => b[1].messages - a[1].messages)
      .slice(0, 5)
      .map(([id]) => id);
    const activeRoomChannels = topChannelIds.length
      ? await db.channel.findMany({
          where: { id: { in: topChannelIds } },
          select: {
            id: true,
            name: true,
            serverId: true,
            server: { select: { name: true } },
          },
        })
      : [];
    const activeRoomMap = new Map(activeRoomChannels.map((c) => [c.id, c]));
    const activeRooms = topChannelIds
      .map((cid) => {
        const ch = activeRoomMap.get(cid);
        const stats = activityByChannel.get(cid);
        if (!ch || !stats) return null;
        return {
          channelId: ch.id,
          channelName: ch.name,
          serverId: ch.serverId,
          serverName: ch.server.name,
          messageCount: stats.messages,
          authorCount: stats.uniqueAuthors.size,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // ── v0.76 #28 phase 2: AI signals ───────────────────────────────
    // Heuristic-based «alerts» поверх данных (без AI provider call'а на
    // каждый Home open — это бы было дорого + flaky). Каждый signal
    // вычисляется detectively, frontend рендерит accent-coloured card.
    //
    //   stale-action — задача без updatedAt за last 14 дней + ещё не DONE
    //   blocker-chain — задача-блокер с blockers >= 2 уровня (transitive blockers)
    //   escalated — escalatedAt set within last 24h (overdue 48h+ scan'ом)
    //
    // Все signals — top-3 max каждой категории. Если >3 — UI показывает
    // «и ещё N…» counter без деталей. Никаких PII, только id/title.
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const staleRows = await db.actionItem.findMany({
      where: {
        assigneeUserId: userId,
        status: { in: ["OPEN", "IN_PROGRESS", "REVIEW"] },
        updatedAt: { lt: new Date(now - FOURTEEN_DAYS_MS) },
      },
      orderBy: { updatedAt: "asc" },
      take: 3,
      select: {
        id: true,
        title: true,
        type: true,
        updatedAt: true,
        serverId: true,
        channelId: true,
        server: { select: { name: true } },
        channel: { select: { name: true } },
      },
    });
    const escalatedRows = await db.actionItem.findMany({
      where: {
        assigneeUserId: userId,
        status: { in: ["OPEN", "IN_PROGRESS", "REVIEW"] },
        escalatedAt: { gte: new Date(now - ONE_DAY_MS) },
      },
      orderBy: { escalatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        type: true,
        escalatedAt: true,
        dueAt: true,
        serverId: true,
        channelId: true,
        server: { select: { name: true } },
        channel: { select: { name: true } },
      },
    });
    const aiSignals = {
      staleTasks: staleRows.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        updatedAt: t.updatedAt.toISOString(),
        serverId: t.serverId,
        serverName: t.server.name,
        channelId: t.channelId,
        channelName: t.channel.name,
      })),
      escalated: escalatedRows.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        escalatedAt: t.escalatedAt?.toISOString() ?? null,
        dueAt: t.dueAt?.toISOString() ?? null,
        serverId: t.serverId,
        serverName: t.server.name,
        channelId: t.channelId,
        channelName: t.channel.name,
      })),
    };

    return {
      assignedTasks,
      incidents,
      activeVoice,
      pendingApprovals,
      activeRooms,
      aiSignals,
      counts: {
        tasks: assignedTasks.length,
        overdue: assignedTasks.filter((t) => t.overdue).length,
        incidents: incidents.length,
        activeVoice: activeVoice.length,
        approvals: pendingApprovals.length,
        activeRooms: activeRooms.length,
        aiSignals:
          aiSignals.staleTasks.length + aiSignals.escalated.length,
      },
    };
  });
}
