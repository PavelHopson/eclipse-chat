import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  emitFriendBlocked,
  emitFriendRemoved,
  emitFriendRequestAccepted,
  emitFriendRequestReceived,
} from "../realtime.js";

/**
 * v1.5.42 Discord-parity A1 — Friends model.
 *
 * REST endpoints (all require JWT):
 *   POST   /api/friends/request            — отправить friend request
 *   POST   /api/friends/:friendshipId/accept — accept incoming PENDING
 *   DELETE /api/friends/:friendshipId      — cancel/decline/unfriend
 *   POST   /api/friends/block              — заблокировать user'а
 *   DELETE /api/friends/block/:userId      — снять блок
 *   GET    /api/friends                    — список (grouped by status)
 *
 * Socket events (room `user:${userId}`):
 *   friend:request:received — addressee получает new PENDING
 *   friend:request:accepted — requester видит, что accepted
 *   friend:removed          — другая сторона видит cancel/decline/unfriend
 *   friend:blocked          — заблокированный видит, что его blocked
 */

/**
 * Нормализуем пару user-id'ов в (userAId, userBId) где userA < userB.
 * Гарантирует unique constraint работает — иначе «A→B» и «B→A» создались бы
 * как два разных Friendship row'а.
 */
function sortIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Возвращает «другого» из пары — для DTO `other` поля. */
function otherUserId(pair: { userAId: string; userBId: string }, me: string): string {
  return pair.userAId === me ? pair.userBId : pair.userAId;
}

/**
 * POST /api/friends/request body schema: ровно один identifier должен быть
 * заполнен. Pre-validation проверяется в роуте (zod не поддерживает «ровно
 * один» из набора через native API без refine).
 */
const requestBody = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().max(255).optional(),
  displayName: z.string().min(1).max(80).optional(),
});

const blockBody = z.object({
  userId: z.string().min(1),
});

const listQuery = z.object({
  status: z.enum(["ALL", "ACCEPTED", "PENDING_IN", "PENDING_OUT", "BLOCKED"]).optional(),
});

/**
 * Минимальный user-shape для DTO `other` поля. Не serializeUser — это DM-style
 * presentation (с manualStatus), а не bot-aware UserView.
 */
type FriendOtherDto = {
  id: string;
  displayName: string;
  avatar: string | null;
  manualStatus: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
};

type FriendshipDto = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  requestedByUserId: string;
  blockedByUserId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  other: FriendOtherDto;
};

/** Row → DTO для текущего user'а. me нужен чтобы выбрать «другого» из пары. */
function toDto(
  row: {
    id: string;
    userAId: string;
    userBId: string;
    status: "PENDING" | "ACCEPTED" | "BLOCKED";
    requestedByUserId: string;
    blockedByUserId: string | null;
    createdAt: Date;
    acceptedAt: Date | null;
    userA: { id: string; displayName: string; avatar: string | null; status: "ONLINE" | "IDLE" | "DND" | "INVISIBLE" };
    userB: { id: string; displayName: string; avatar: string | null; status: "ONLINE" | "IDLE" | "DND" | "INVISIBLE" };
  },
  me: string,
): FriendshipDto {
  const other = row.userAId === me ? row.userB : row.userA;
  return {
    id: row.id,
    status: row.status,
    requestedByUserId: row.requestedByUserId,
    blockedByUserId: row.blockedByUserId,
    createdAt: row.createdAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    other: {
      id: other.id,
      displayName: other.displayName,
      avatar: other.avatar,
      manualStatus: other.status,
    },
  };
}

const friendshipInclude = {
  userA: { select: { id: true, displayName: true, avatar: true, status: true } },
  userB: { select: { id: true, displayName: true, avatar: true, status: true } },
} as const;

export async function registerFriendRoutes(app: FastifyInstance) {
  /**
   * POST /api/friends/request — отправить friend request.
   *
   * Identifier из body: ровно один из { userId, email, displayName }. Email +
   * displayName ищутся case-insensitive, exact match (без fuzzy). При множественных
   * matches по displayName — 409 «ambiguous», требуется userId.
   *
   * Logic:
   *   - Найти target user
   *   - Если target == me → 400 «cannot friend yourself»
   *   - Найти существующую Friendship (нормализованная пара):
   *     - ACCEPTED → return existing (idempotent 200)
   *     - PENDING с requestedByUserId == me → 200 «already pending»
   *     - PENDING с requestedByUserId == target → auto-accept (200, autoAccepted: true)
   *     - BLOCKED → 403 (с любой стороны)
   *   - Иначе создать новый PENDING (201)
   *   - Emit socket к addressee (friend:request:received) либо к requester
   *     (friend:request:accepted на auto-accept path)
   *
   * Rate limit: 20 requests / 15 min (anti-spam friend-bombing).
   */
  app.post(
    "/api/friends/request",
    {
      onRequest: [requireJwt],
      config: {
        rateLimit: { max: 20, timeWindow: 15 * 60 * 1000 },
      },
    },
    async (req, reply) => {
      const me = getUserId(req);
      if (!me) return reply.status(401).send({ error: "Unauthorized" });

      const parsed = requestBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", detail: parsed.error.format() });
      }
      const { userId, email, displayName } = parsed.data;
      const provided = [userId, email, displayName].filter((v) => v != null).length;
      if (provided !== 1) {
        return reply.status(400).send({
          error: "Exactly one of { userId, email, displayName } must be provided",
        });
      }

      // Найти target user
      let target: { id: string; displayName: string; avatar: string | null } | null = null;
      if (userId) {
        target = await db.user.findUnique({
          where: { id: userId },
          select: { id: true, displayName: true, avatar: true },
        });
      } else if (email) {
        target = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { id: true, displayName: true, avatar: true },
        });
      } else if (displayName) {
        // displayName не unique — может быть множественные matches. Если 2+,
        // просим userId явно (ambiguous).
        const candidates = await db.user.findMany({
          where: { displayName },
          select: { id: true, displayName: true, avatar: true },
          take: 2,
        });
        if (candidates.length === 0) {
          target = null;
        } else if (candidates.length === 1) {
          target = candidates[0];
        } else {
          return reply.status(409).send({
            error: "Ambiguous displayName — multiple users match, use userId",
          });
        }
      }

      if (!target) return reply.status(404).send({ error: "User not found" });
      if (target.id === me) {
        return reply.status(400).send({ error: "Cannot send friend request to yourself" });
      }

      const [userAId, userBId] = sortIds(me, target.id);
      const existing = await db.friendship.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
        include: friendshipInclude,
      });

      // Already friends — idempotent return
      if (existing && existing.status === "ACCEPTED") {
        return reply.status(200).send({ friendship: toDto(existing, me) });
      }

      // Blocked — deny (не раскрываем кто кого, чтобы не leak'ать blocked-side privacy)
      if (existing && existing.status === "BLOCKED") {
        return reply.status(403).send({ error: "Blocked" });
      }

      // PENDING сам уже отправлял
      if (existing && existing.status === "PENDING" && existing.requestedByUserId === me) {
        return reply.status(200).send({
          friendship: toDto(existing, me),
          alreadyPending: true,
        });
      }

      // PENDING от target ко мне — auto-accept
      if (existing && existing.status === "PENDING" && existing.requestedByUserId === target.id) {
        const now = new Date();
        const updated = await db.friendship.update({
          where: { id: existing.id },
          data: { status: "ACCEPTED", acceptedAt: now },
          include: friendshipInclude,
        });
        // Я (acceptor) видел этот pending через GET; requester'у — live notify.
        const myInfo = await db.user.findUnique({
          where: { id: me },
          select: { id: true, displayName: true, avatar: true },
        });
        if (myInfo) {
          emitFriendRequestAccepted(target.id, {
            friendshipId: updated.id,
            by: myInfo,
            acceptedAt: now.toISOString(),
          });
        }
        return reply.status(200).send({
          friendship: toDto(updated, me),
          autoAccepted: true,
        });
      }

      // Create new PENDING
      try {
        const created = await db.friendship.create({
          data: {
            userAId,
            userBId,
            status: "PENDING",
            requestedByUserId: me,
          },
          include: friendshipInclude,
        });
        emitFriendRequestReceived(target.id, {
          friendshipId: created.id,
          from: {
            id: me,
            displayName: (created.userAId === me ? created.userA : created.userB).displayName,
            avatar: (created.userAId === me ? created.userA : created.userB).avatar,
          },
          createdAt: created.createdAt.toISOString(),
        });
        return reply.status(201).send({ friendship: toDto(created, me) });
      } catch (err) {
        // Race на unique pair — другой запрос создал между findUnique и create.
        // Re-query и обработать как существующий.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const race = await db.friendship.findUnique({
            where: { userAId_userBId: { userAId, userBId } },
            include: friendshipInclude,
          });
          if (race) return reply.status(200).send({ friendship: toDto(race, me) });
        }
        throw err;
      }
    },
  );

  /**
   * POST /api/friends/:friendshipId/accept — addressee принимает PENDING.
   *
   * Permission: только addressee (тот, кто НЕ requestedByUserId) на статусе PENDING.
   * Idempotent для ACCEPTED (возвращает existing). 403 если caller — requester
   * (cancel выполняется через DELETE).
   */
  app.post(
    "/api/friends/:friendshipId/accept",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      if (!me) return reply.status(401).send({ error: "Unauthorized" });
      const { friendshipId } = req.params as { friendshipId: string };

      const existing = await db.friendship.findUnique({
        where: { id: friendshipId },
        include: friendshipInclude,
      });
      if (!existing) return reply.status(404).send({ error: "Friendship not found" });

      const isParticipant = existing.userAId === me || existing.userBId === me;
      if (!isParticipant) {
        return reply.status(404).send({ error: "Friendship not found" });
      }

      if (existing.status === "ACCEPTED") {
        return reply.status(200).send({ friendship: toDto(existing, me) });
      }
      if (existing.status === "BLOCKED") {
        return reply.status(403).send({ error: "Friendship is blocked" });
      }
      // PENDING — accept allowed только addressee (тот, кто НЕ requester)
      if (existing.requestedByUserId === me) {
        return reply.status(403).send({
          error: "Cannot accept your own request — wait for the other side, or DELETE to cancel",
        });
      }

      const now = new Date();
      const updated = await db.friendship.update({
        where: { id: friendshipId },
        data: { status: "ACCEPTED", acceptedAt: now },
        include: friendshipInclude,
      });
      const myInfo = await db.user.findUnique({
        where: { id: me },
        select: { id: true, displayName: true, avatar: true },
      });
      if (myInfo) {
        emitFriendRequestAccepted(existing.requestedByUserId, {
          friendshipId: updated.id,
          by: myInfo,
          acceptedAt: now.toISOString(),
        });
      }
      return reply.status(200).send({ friendship: toDto(updated, me) });
    },
  );

  /**
   * DELETE /api/friends/:friendshipId — удалить friendship.
   *
   * Покрывает три UX-сценария по статусу:
   *   PENDING + я requester → cancel
   *   PENDING + я addressee → decline
   *   ACCEPTED → unfriend (любая сторона)
   *
   * BLOCKED НЕ удаляется через этот endpoint — для unblock есть отдельный
   * /api/friends/block/:userId DELETE, который проверяет, что caller — blocker
   * (другая сторона не должна уметь снять блок).
   */
  app.delete(
    "/api/friends/:friendshipId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      if (!me) return reply.status(401).send({ error: "Unauthorized" });
      const { friendshipId } = req.params as { friendshipId: string };

      const existing = await db.friendship.findUnique({
        where: { id: friendshipId },
      });
      if (!existing) return reply.status(404).send({ error: "Friendship not found" });

      const isParticipant = existing.userAId === me || existing.userBId === me;
      if (!isParticipant) {
        return reply.status(404).send({ error: "Friendship not found" });
      }
      if (existing.status === "BLOCKED") {
        return reply.status(403).send({
          error: "Use DELETE /api/friends/block/:userId to unblock",
        });
      }

      await db.friendship.delete({ where: { id: friendshipId } });
      emitFriendRemoved(otherUserId(existing, me), {
        friendshipId: existing.id,
        byUserId: me,
      });
      return reply.status(204).send();
    },
  );

  /**
   * POST /api/friends/block — заблокировать user'а.
   *
   * Создаёт новый BLOCKED row либо transition'ит существующий PENDING/ACCEPTED
   * в BLOCKED с blockedByUserId = me. Если уже BLOCKED:
   *   - blocker == me → idempotent return existing
   *   - blocker == other → 409 (он меня blocked первый; я не могу залезть)
   *
   * Rate limit: 30/15min — anti-spam, но не слишком жёстко.
   */
  app.post(
    "/api/friends/block",
    {
      onRequest: [requireJwt],
      config: {
        rateLimit: { max: 30, timeWindow: 15 * 60 * 1000 },
      },
    },
    async (req, reply) => {
      const me = getUserId(req);
      if (!me) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = blockBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", detail: parsed.error.format() });
      }
      const { userId: targetId } = parsed.data;
      if (targetId === me) {
        return reply.status(400).send({ error: "Cannot block yourself" });
      }

      const target = await db.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) return reply.status(404).send({ error: "User not found" });

      const [userAId, userBId] = sortIds(me, targetId);
      const existing = await db.friendship.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
        include: friendshipInclude,
      });

      if (existing && existing.status === "BLOCKED") {
        if (existing.blockedByUserId === me) {
          return reply.status(200).send({ friendship: toDto(existing, me) });
        }
        // Другая сторона уже blocked меня — я не могу «переблокировать»
        return reply.status(409).send({ error: "Already blocked by other side" });
      }

      const upserted = existing
        ? await db.friendship.update({
            where: { id: existing.id },
            data: {
              status: "BLOCKED",
              blockedByUserId: me,
              acceptedAt: null,
            },
            include: friendshipInclude,
          })
        : await db.friendship.create({
            data: {
              userAId,
              userBId,
              status: "BLOCKED",
              requestedByUserId: me,
              blockedByUserId: me,
            },
            include: friendshipInclude,
          });

      emitFriendBlocked(targetId, {
        friendshipId: upserted.id,
        byUserId: me,
      });
      return reply.status(200).send({ friendship: toDto(upserted, me) });
    },
  );

  /**
   * DELETE /api/friends/block/:userId — снять блок.
   *
   * Permission: только blocker (blockedByUserId == me). Если другая сторона
   * blocked меня — у меня нет права unblock, 403.
   *
   * Row удаляется полностью (relationship reset to нет — не возвращается в ACCEPTED).
   */
  app.delete(
    "/api/friends/block/:userId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      if (!me) return reply.status(401).send({ error: "Unauthorized" });
      const { userId: targetId } = req.params as { userId: string };

      const [userAId, userBId] = sortIds(me, targetId);
      const existing = await db.friendship.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
      });
      if (!existing || existing.status !== "BLOCKED") {
        return reply.status(404).send({ error: "Not blocked" });
      }
      if (existing.blockedByUserId !== me) {
        return reply.status(403).send({ error: "Only the blocker can unblock" });
      }

      await db.friendship.delete({ where: { id: existing.id } });
      // Не emit'им unblocked event — UX-дизайн: blocked user НЕ должен узнать,
      // что его разблокировали (та же логика, что Discord — silent unblock).
      return reply.status(204).send();
    },
  );

  /**
   * GET /api/friends — список всех моих friendships, grouped by status.
   *
   * Query ?status фильтрует только одну категорию (для tab-load), default ALL
   * возвращает все 5 групп одним response'ом (initial load).
   *
   * Группы:
   *   accepted    — ACCEPTED, я в паре
   *   pendingIn   — PENDING, я НЕ requestedByUserId (входящие, я могу accept/decline)
   *   pendingOut  — PENDING, я requestedByUserId (исходящие, я могу cancel)
   *   blocked     — BLOCKED, blockedByUserId == me (я заблокировал)
   *   blockedBy   — BLOCKED, blockedByUserId != me (меня заблокировали)
   *                  Frontend обычно скрывает эту группу — она для DM-write deny
   *                  check, не для UI display.
   */
  app.get("/api/friends", { onRequest: [requireJwt] }, async (req, reply) => {
    const me = getUserId(req);
    if (!me) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query", detail: parsed.error.format() });
    }
    const filter = parsed.data.status ?? "ALL";

    const all = await db.friendship.findMany({
      where: {
        OR: [{ userAId: me }, { userBId: me }],
      },
      include: friendshipInclude,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    const accepted: FriendshipDto[] = [];
    const pendingIn: FriendshipDto[] = [];
    const pendingOut: FriendshipDto[] = [];
    const blocked: FriendshipDto[] = [];
    const blockedBy: FriendshipDto[] = [];

    for (const row of all) {
      const dto = toDto(row, me);
      if (row.status === "ACCEPTED") {
        accepted.push(dto);
      } else if (row.status === "PENDING") {
        if (row.requestedByUserId === me) pendingOut.push(dto);
        else pendingIn.push(dto);
      } else if (row.status === "BLOCKED") {
        if (row.blockedByUserId === me) blocked.push(dto);
        else blockedBy.push(dto);
      }
    }

    if (filter === "ALL") {
      return { accepted, pendingIn, pendingOut, blocked, blockedBy };
    }
    if (filter === "ACCEPTED") return { accepted, pendingIn: [], pendingOut: [], blocked: [], blockedBy: [] };
    if (filter === "PENDING_IN") return { accepted: [], pendingIn, pendingOut: [], blocked: [], blockedBy: [] };
    if (filter === "PENDING_OUT") return { accepted: [], pendingIn: [], pendingOut, blocked: [], blockedBy: [] };
    if (filter === "BLOCKED") return { accepted: [], pendingIn: [], pendingOut: [], blocked, blockedBy };
    return { accepted, pendingIn, pendingOut, blocked, blockedBy };
  });
}
