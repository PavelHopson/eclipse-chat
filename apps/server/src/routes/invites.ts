import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { recordAudit } from "../security/audit.js";
import { hasPermission } from "../lib/permissions.js";
import type { MemberRole } from "./servers.js";
import {
  generateInviteCode,
  inviteRejectReason,
  resolveInviteExpiry,
  resolveInviteMaxUses,
} from "../lib/serverInvites.js";

/**
 * v1.6.99 — управление одноразовыми / истекающими invite-кодами (privacy
 * slice B). Создание/список/отзыв. Сам приём кода — в POST
 * /api/servers/join/:code (routes/servers.ts), который теперь принимает и
 * ServerInvite-коды, и legacy Server.inviteCode.
 *
 * Гейт: permission MEMBER_INVITE (OWNER/ADMIN/MODERATOR/OPERATOR — см. permissions.ts).
 */

const createInviteBody = z.object({
  // TTL в секундах; null/опущено = бессрочный. Кламп в resolveInviteExpiry.
  expiresInSeconds: z.number().int().positive().max(60 * 60 * 24 * 365).nullable().optional(),
  // Лимит использований; null/опущено = без лимита. Кламп в resolveInviteMaxUses.
  maxUses: z.number().int().positive().max(100000).nullable().optional(),
});

type InviteRow = {
  id: string;
  code: string;
  maxUses: number | null;
  uses: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
};

function inviteView(inv: InviteRow, now: Date) {
  return {
    id: inv.id,
    code: inv.code,
    maxUses: inv.maxUses,
    uses: inv.uses,
    expiresAt: inv.expiresAt?.toISOString() ?? null,
    revokedAt: inv.revokedAt?.toISOString() ?? null,
    createdByUserId: inv.createdByUserId,
    createdAt: inv.createdAt.toISOString(),
    // null = активен; иначе revoked/expired/exhausted — UI красит «неактивен».
    rejectReason: inviteRejectReason(inv, now),
  };
}

async function loadRole(userId: string, serverId: string): Promise<MemberRole | null> {
  const m = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
  return (m?.role as MemberRole | undefined) ?? null;
}

export async function registerInviteRoutes(app: FastifyInstance) {
  /** POST /api/servers/:id/invites — создать инвайт (нужен MEMBER_INVITE). */
  app.post("/api/servers/:id/invites", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const { id: serverId } = req.params as { id: string };
    const role = await loadRole(userId, serverId);
    if (!role) {
      return reply.status(403).send({ error: "Not a member" });
    }
    if (!hasPermission(role, "MEMBER_INVITE")) {
      return reply.status(403).send({ error: "Недостаточно прав для создания приглашений" });
    }
    const parsed = createInviteBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body" });
    }
    const now = new Date();
    const maxUses = resolveInviteMaxUses(parsed.data.maxUses);
    const expiresAt = resolveInviteExpiry(parsed.data.expiresInSeconds, now);

    // Уникальность code — через @unique + retry на P2002 (коллизия крайне редка).
    let invite: InviteRow | null = null;
    for (let attempt = 0; attempt < 5 && !invite; attempt += 1) {
      try {
        invite = await db.serverInvite.create({
          data: { code: generateInviteCode(), serverId, createdByUserId: userId, maxUses, expiresAt },
        });
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code !== "P2002") throw err;
      }
    }
    if (!invite) {
      return reply.status(500).send({ error: "Не удалось создать приглашение" });
    }
    recordAudit("SERVER_INVITE_CREATED", {
      userId,
      req,
      metadata: { serverId, inviteId: invite.id, maxUses, expiresAt: expiresAt?.toISOString() ?? null },
    });
    return { invite: inviteView(invite, now) };
  });

  /** GET /api/servers/:id/invites — активные инвайты сервера (нужен MEMBER_INVITE). */
  app.get("/api/servers/:id/invites", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const { id: serverId } = req.params as { id: string };
    const role = await loadRole(userId, serverId);
    if (!role) {
      return reply.status(403).send({ error: "Not a member" });
    }
    if (!hasPermission(role, "MEMBER_INVITE")) {
      return reply.status(403).send({ error: "Недостаточно прав" });
    }
    const now = new Date();
    const invites = await db.serverInvite.findMany({
      where: { serverId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { invites: invites.map((inv) => inviteView(inv, now)) };
  });

  /** DELETE /api/servers/:id/invites/:inviteId — отозвать инвайт (нужен MEMBER_INVITE). */
  app.delete("/api/servers/:id/invites/:inviteId", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const { id: serverId, inviteId } = req.params as { id: string; inviteId: string };
    const role = await loadRole(userId, serverId);
    if (!role) {
      return reply.status(403).send({ error: "Not a member" });
    }
    if (!hasPermission(role, "MEMBER_INVITE")) {
      return reply.status(403).send({ error: "Недостаточно прав" });
    }
    const inv = await db.serverInvite.findFirst({ where: { id: inviteId, serverId } });
    if (!inv) {
      return reply.status(404).send({ error: "Invite not found" });
    }
    if (inv.revokedAt === null) {
      await db.serverInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
    }
    recordAudit("SERVER_INVITE_REVOKED", { userId, req, metadata: { serverId, inviteId } });
    return { ok: true };
  });
}
