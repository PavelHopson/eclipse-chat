import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { requirePlatformOwner } from "../auth/requirePlatformOwner.js";
import { recordAudit } from "../security/audit.js";
import { deleteAllUserRefresh } from "../auth/refresh.js";
import { disconnectUser } from "../realtime.js";

/**
 * v1.2.6 Platform Admin (trek P1) — глобальная super-admin панель для
 * владельца платформы Eclipse Chat. Все эндпоинты за двумя preHandler'ами:
 * requireJwt + requirePlatformOwner (User.isPlatformOwner = true И не
 * забанен).
 *
 * P1 scope (users-only):
 *   GET  /api/platform/users                        — список с пагинацией
 *   POST /api/platform/users/:id/ban                — забанить
 *   POST /api/platform/users/:id/unban              — разбанить
 *   POST /api/platform/users/:id/reset-password     — сбросить пароль
 *
 * Servers/suspend + audit-view-tab — P2 отдельным слайсом.
 *
 * Безопасность:
 *   - Cannot self-ban / self-reset (защита от случайного блока себя).
 *   - Cannot ban / reset другого platform-owner'а (same-level immunity).
 *   - Ban: bannedAt + reason + bannedByUserId; revoke refresh tokens +
 *     disconnect WS-сокеты сразу.
 *   - Reset: crypto-random 16-char temp pw; bcrypt-hash; revoke refresh.
 *     Plaintext возвращается ОДИН РАЗ в response; никогда не пишется в
 *     audit metadata.
 */

// URL-safe alphabet без визуально-неоднозначных символов (0/O, 1/l/I).
const TEMP_PW_ALPHABET =
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEMP_PW_LENGTH = 16;

function generateTempPassword(): string {
  const bytes = randomBytes(TEMP_PW_LENGTH);
  let out = "";
  for (let i = 0; i < TEMP_PW_LENGTH; i += 1) {
    out += TEMP_PW_ALPHABET[bytes[i] % TEMP_PW_ALPHABET.length];
  }
  return out;
}

const PLATFORM_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  avatar: true,
  createdAt: true,
  isPlatformOwner: true,
  bannedAt: true,
  bannedReason: true,
  bannedByUserId: true,
  bannedBy: {
    select: { id: true, email: true, displayName: true },
  },
} as const;

type DbPlatformUser = Prisma.UserGetPayload<{
  select: typeof PLATFORM_USER_SELECT;
}>;

type PlatformUserView = {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  createdAt: string;
  isPlatformOwner: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  bannedBy: { id: string; email: string; displayName: string } | null;
};

function toView(u: DbPlatformUser): PlatformUserView {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatar: u.avatar,
    createdAt: u.createdAt.toISOString(),
    isPlatformOwner: u.isPlatformOwner,
    bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
    bannedReason: u.bannedReason,
    bannedBy: u.bannedBy
      ? {
          id: u.bannedBy.id,
          email: u.bannedBy.email,
          displayName: u.bannedBy.displayName,
        }
      : null,
  };
}

const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  banned: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const banBody = z.object({
  reason: z.string().trim().min(1).max(280),
});

const idParam = z.object({ id: z.string().min(1).max(60) });

export async function registerPlatformRoutes(app: FastifyInstance) {
  // Все routes — за двумя preHandler'ами.
  const guard = { preHandler: [requireJwt, requirePlatformOwner] };

  // GET /api/platform/users — список с пагинацией.
  app.get("/api/platform/users", guard, async (req, reply) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query" });
    }
    const { q, banned, limit, offset } = parsed.data;

    const where: Prisma.UserWhereInput = {};
    if (q) {
      // PG case-insensitive contains через mode: "insensitive".
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }
    if (banned === "true") where.bannedAt = { not: null };
    if (banned === "false") where.bannedAt = null;

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: PLATFORM_USER_SELECT,
        orderBy: [{ bannedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      db.user.count({ where }),
    ]);

    return reply.send({
      users: users.map(toView),
      total,
      limit,
      offset,
    });
  });

  // POST /api/platform/users/:id/ban — забанить пользователя.
  app.post("/api/platform/users/:id/ban", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });
    const body = banBody.safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Укажите причину бана (1..280 символов)." });
    }

    const adminId = getUserId(req);
    if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
    const { id: targetId } = params.data;

    if (targetId === adminId) {
      return reply
        .status(400)
        .send({ error: "Нельзя забанить себя." });
    }

    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, isPlatformOwner: true, bannedAt: true },
    });
    if (!target) return reply.status(404).send({ error: "Пользователь не найден." });
    if (target.isPlatformOwner) {
      return reply
        .status(403)
        .send({ error: "Нельзя забанить другого platform-owner'а." });
    }
    if (target.bannedAt !== null) {
      return reply.status(409).send({ error: "Пользователь уже забанен." });
    }

    const updated = await db.user.update({
      where: { id: targetId },
      data: {
        bannedAt: new Date(),
        bannedReason: body.data.reason,
        bannedByUserId: adminId,
      },
      select: PLATFORM_USER_SELECT,
    });

    // Forced sign-out: refresh tokens мертвы + WS-сокеты дисконнект.
    await deleteAllUserRefresh(targetId);
    const dropped = disconnectUser(targetId);

    recordAudit("PLATFORM_USER_BANNED", {
      userId: adminId,
      req,
      metadata: {
        targetUserId: targetId,
        reason: body.data.reason,
        socketsDropped: dropped,
      },
    });

    return reply.send({ user: toView(updated) });
  });

  // POST /api/platform/users/:id/unban — снять бан.
  app.post("/api/platform/users/:id/unban", guard, async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid id" });

    const adminId = getUserId(req);
    if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
    const { id: targetId } = params.data;

    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, bannedAt: true },
    });
    if (!target) return reply.status(404).send({ error: "Пользователь не найден." });
    if (target.bannedAt === null) {
      return reply.status(409).send({ error: "Пользователь не забанен." });
    }

    const updated = await db.user.update({
      where: { id: targetId },
      data: {
        bannedAt: null,
        bannedReason: null,
        bannedByUserId: null,
      },
      select: PLATFORM_USER_SELECT,
    });

    recordAudit("PLATFORM_USER_UNBANNED", {
      userId: adminId,
      req,
      metadata: { targetUserId: targetId },
    });

    return reply.send({ user: toView(updated) });
  });

  // POST /api/platform/users/:id/reset-password — сбросить пароль.
  // Возвращает crypto-random temp pw ОДИН РАЗ. UI показывает в модалке,
  // Pavel передаёт юзеру out-of-band.
  app.post(
    "/api/platform/users/:id/reset-password",
    guard,
    async (req, reply) => {
      const params = idParam.safeParse(req.params);
      if (!params.success) return reply.status(400).send({ error: "Invalid id" });

      const adminId = getUserId(req);
      if (!adminId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: targetId } = params.data;

      if (targetId === adminId) {
        return reply.status(400).send({
          error:
            "Нельзя сбросить собственный пароль через эту панель — используй обычный flow смены пароля.",
        });
      }

      const target = await db.user.findUnique({
        where: { id: targetId },
        select: { id: true, isPlatformOwner: true },
      });
      if (!target) return reply.status(404).send({ error: "Пользователь не найден." });
      if (target.isPlatformOwner) {
        return reply
          .status(403)
          .send({ error: "Нельзя сбросить пароль другого platform-owner'а." });
      }

      const tempPassword = generateTempPassword();
      const hash = await bcrypt.hash(tempPassword, 10);

      const updated = await db.user.update({
        where: { id: targetId },
        data: { passwordHash: hash, failedLoginAttempts: 0, lockoutUntil: null },
        select: PLATFORM_USER_SELECT,
      });

      // Все рефреш-токены — выкинуть; пусть user логинится временным паролем.
      await deleteAllUserRefresh(targetId);

      recordAudit("PLATFORM_USER_PASSWORD_RESET", {
        userId: adminId,
        req,
        metadata: {
          targetUserId: targetId,
          // ⚠️ Никогда не логируем сам пароль.
        },
      });

      return reply.send({
        user: toView(updated),
        tempPassword,
      });
    },
  );
}
