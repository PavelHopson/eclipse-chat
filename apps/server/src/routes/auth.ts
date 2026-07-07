import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import {
  deleteAllUserRefresh,
  findValidRefreshTokenRow,
  makeRefreshTokenPair,
  storeRefreshToken,
} from "../auth/refresh.js";
import {
  checkLockout,
  registerFailedLogin,
  resetLockout,
} from "../security/loginLockout.js";
import { recordAudit } from "../security/audit.js";
import {
  decryptSecret,
  verifyCode,
  verifyRecoveryCode,
  generateRecoveryCodes,
} from "../security/twoFactor.js";

const registerBody = z.object({
  email: z.string().trim().email().max(320),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .max(128)
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), {
      message: "Пароль должен содержать буквы и цифры",
    }),
  displayName: z.string().trim().min(1).max(64),
});

const loginBody = z.object({
  email: z.string().trim().email(),
  password: z.string(),
  totpCode: z.string().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().max(40).optional(),
});

const refreshBody = z.object({
  refreshToken: z.string().min(10),
});

const changePasswordBody = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: registerBody.shape.password,
});

// v1.6.68 — self-serve password recovery codes (forgot-password без email).
const genRecoveryBody = z.object({
  password: z.string().min(1, "Введите пароль"),
});

const recoveryResetBody = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(1, "Введите код восстановления").max(40),
  newPassword: registerBody.shape.password,
});

const ACCESS_TTL = "15m";
const FAKE_PASSWORD_HASH = "$2a$12$fakehashtotallyfakedontuse.....";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

function isUniqueEmailError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  );
}

function publicUser(u: {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  status?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
  createdAt: Date;
  twoFactorEnabled?: boolean;
  /// v1.2.6 Platform Admin (trek P1) — глобальный super-admin флаг.
  /// Фронт по нему включает иконку Platform Admin в топбаре.
  isPlatformOwner?: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatar: u.avatar,
    bio: u.bio,
    status: u.status ?? "ONLINE",
    twoFactorEnabled: u.twoFactorEnabled ?? false,
    createdAt: u.createdAt.toISOString(),
    isPlatformOwner: u.isPlatformOwner ?? false,
  };
}

export type AuthResponseBody = {
  accessToken: string;
  refreshToken: string;
  token: string;
  user: ReturnType<typeof publicUser>;
};

async function requireJwt(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    void reply.status(401).send({ error: "Unauthorized" });
  }
}

async function issueSession(
  reply: FastifyReply,
  user: {
    id: string;
    email: string;
    displayName: string;
    avatar: string | null;
    bio: string | null;
    status?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
    createdAt: Date;
    twoFactorEnabled?: boolean;
  },
  meta?: { userAgent?: string | null; ipAddress?: string | null },
): Promise<AuthResponseBody> {
  const accessToken = await reply.jwtSign(
    { sub: user.id, email: user.email },
    { expiresIn: ACCESS_TTL },
  );
  const { raw: refreshToken, hash } = makeRefreshTokenPair();
  await storeRefreshToken(user.id, hash, meta);
  return {
    accessToken,
    refreshToken,
    token: accessToken,
    user: publicUser(user),
  };
}

/**
 * v1.5.52 B2: extract session metadata из request — UA + origin IP.
 * UA trimmed app-layer'ом до 512 chars. IP extracted via X-Forwarded-For
 * (nginx ставит) либо fallback req.ip.
 */
function sessionMetaFromReq(req: FastifyRequest): { userAgent: string | null; ipAddress: string | null } {
  const ua = req.headers["user-agent"];
  const userAgent = typeof ua === "string" && ua.length > 0 ? ua : null;
  const fwd = req.headers["x-forwarded-for"];
  let ipAddress: string | null = null;
  if (typeof fwd === "string") {
    ipAddress = fwd.split(",")[0]?.trim() || null;
  }
  if (!ipAddress) ipAddress = req.ip || null;
  return { userAgent, ipAddress };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post(
    "/api/auth/register",
    {
      config: {
        rateLimit: { max: 5, timeWindow: 15 * 60 * 1000 },
      },
    },
    async (req, reply) => {
      const parsed = registerBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid body",
          details: parsed.error.flatten(),
        });
      }

      const email = normalizeEmail(parsed.data.email);
      const displayName = normalizeDisplayName(parsed.data.displayName);
      const { password } = parsed.data;

      try {
        const exists = await db.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (exists) {
          return reply.status(409).send({ error: "Email уже зарегистрирован" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await db.user.create({
          data: { email, passwordHash, displayName },
        });

        recordAudit("AUTH_REGISTER", {
          userId: user.id,
          req,
          metadata: { email },
        });

        return await issueSession(reply, user, sessionMetaFromReq(req));
      } catch (err) {
        if (isUniqueEmailError(err)) {
          return reply.status(409).send({ error: "Email уже зарегистрирован" });
        }

        app.log.error({ err, email }, "auth register failed");
        return reply.status(503).send({
          error: "Сервис регистрации временно недоступен. Попробуйте позже.",
        });
      }
    },
  );

  app.post(
    "/api/auth/login",
    {
      config: {
        rateLimit: { max: 10, timeWindow: 15 * 60 * 1000 },
      },
    },
    async (req, reply) => {
      const parsed = loginBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const email = normalizeEmail(parsed.data.email);
      const { password, totpCode, recoveryCode } = parsed.data;

      try {
        const user = await db.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (!user) {
          await bcrypt.compare(password, FAKE_PASSWORD_HASH);
          recordAudit("AUTH_LOGIN_FAILED", {
            userId: null,
            req,
            metadata: { email, reason: "user_not_found" },
          });
          return reply.status(401).send({ error: "Неверный email или пароль" });
        }

        const lockStatus = await checkLockout(user.id);
        if (lockStatus.locked) {
          const minsLeft = Math.ceil(
            ((lockStatus.lockoutUntil?.getTime() ?? 0) - Date.now()) / 60_000,
          );
          recordAudit("AUTH_LOGIN_LOCKED", {
            userId: user.id,
            req,
            metadata: { minutesLeft: minsLeft, attempts: lockStatus.attempts },
          });
          return reply.status(423).send({
            error: `Аккаунт временно заблокирован после ${lockStatus.attempts} неудачных попыток. Попробуйте через ${minsLeft} мин.`,
          });
        }

        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) {
          const after = await registerFailedLogin(user.id);
          recordAudit("AUTH_LOGIN_FAILED", {
            userId: user.id,
            req,
            metadata: { reason: "wrong_password", attempts: after.attempts },
          });
          return reply.status(401).send({ error: "Неверный email или пароль" });
        }

        // v1.2.6 Platform Admin (trek P1) + v1.2.7 (P2) — ban/delete-gate.
        // Password уже проверили (чтобы не утекать "user X banned/deleted"
        // перебором email'ов без пароля). Soft-delete и ban — оба отбивают
        // login 403; разные сообщения по причине.
        if (user.deletedAt !== null) {
          recordAudit("AUTH_LOGIN_FAILED", {
            userId: user.id,
            req,
            metadata: {
              reason: "deleted",
              deletedAt: user.deletedAt.toISOString(),
            },
          });
          return reply.status(403).send({
            error: user.deletedReason
              ? `Аккаунт удалён администратором: ${user.deletedReason}`
              : "Аккаунт удалён администратором.",
          });
        }
        if (user.bannedAt !== null) {
          recordAudit("AUTH_LOGIN_FAILED", {
            userId: user.id,
            req,
            metadata: {
              reason: "banned",
              bannedAt: user.bannedAt.toISOString(),
            },
          });
          return reply.status(403).send({
            error: user.bannedReason
              ? `Аккаунт заблокирован администратором: ${user.bannedReason}`
              : "Аккаунт заблокирован администратором.",
          });
        }

        if (user.twoFactorEnabled) {
          if (!totpCode && !recoveryCode) {
            return reply.status(401).send({
              error: "Требуется код 2FA",
              twoFactorRequired: true,
            });
          }

          let totpOk = false;

          if (totpCode && user.twoFactorSecret) {
            try {
              const secret = decryptSecret(user.twoFactorSecret);
              totpOk = await verifyCode(secret, totpCode);
            } catch (err) {
              app.log.warn({ err, userId: user.id }, "2FA decrypt failed");
            }
          }

          if (!totpOk && recoveryCode) {
            const used = await verifyRecoveryCode(
              recoveryCode,
              user.twoFactorRecoveryCodes,
            );

            if (used) {
              await db.user.update({
                where: { id: user.id },
                data: { twoFactorRecoveryCodes: used.remainingJson },
              });
              recordAudit("TWOFA_RECOVERY_USED", {
                userId: user.id,
                req,
                metadata: { remaining: JSON.parse(used.remainingJson).length },
              });
              totpOk = true;
            }
          }

          if (!totpOk) {
            await registerFailedLogin(user.id);
            recordAudit("AUTH_LOGIN_FAILED", {
              userId: user.id,
              req,
              metadata: { reason: "2fa_failed" },
            });
            return reply.status(401).send({
              error: "Неверный 2FA код",
              twoFactorRequired: true,
            });
          }

          recordAudit("TWOFA_VERIFIED", { userId: user.id, req });
        }

        await resetLockout(user.id);
        await deleteAllUserRefresh(user.id);
        recordAudit("AUTH_LOGIN", { userId: user.id, req });
        return await issueSession(reply, user, sessionMetaFromReq(req));
      } catch (err) {
        app.log.error({ err, email }, "auth login failed");
        return reply.status(503).send({
          error: "Сервис входа временно недоступен. Попробуйте позже.",
        });
      }
    },
  );

  app.post(
    "/api/auth/refresh",
    {
      config: {
        rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 },
      },
    },
    async (req, reply) => {
      const parsed = refreshBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }

      const row = await findValidRefreshTokenRow(parsed.data.refreshToken);
      if (!row) {
        return reply.status(401).send({ error: "Invalid refresh token" });
      }

      const user = await db.user.findUnique({ where: { id: row.userId } });
      if (!user) {
        await db.refreshToken.delete({ where: { id: row.id } });
        return reply.status(401).send({ error: "User not found" });
      }

      await db.refreshToken.delete({ where: { id: row.id } });
      const { raw: refreshToken, hash } = makeRefreshTokenPair();
      await storeRefreshToken(user.id, hash, sessionMetaFromReq(req));
      const accessToken = await reply.jwtSign(
        { sub: user.id, email: user.email },
        { expiresIn: ACCESS_TTL },
      );

      return {
        accessToken,
        refreshToken,
        token: accessToken,
      };
    },
  );

  app.post(
    "/api/auth/logout",
    { onRequest: [requireJwt] },
    async (req) => {
      const payload = req.user as { sub: string; email: string } | undefined;
      const sub = payload?.sub;
      if (sub) {
        await deleteAllUserRefresh(sub);
        recordAudit("AUTH_LOGOUT", { userId: sub, req });
      }
      return { ok: true as const };
    },
  );

  app.get(
    "/api/auth/me",
    { onRequest: [requireJwt] },
    async (req) => {
      const payload = req.user as { sub: string; email: string } | undefined;
      const sub = payload?.sub;
      if (!sub) {
        return { user: null as null };
      }

      const user = await db.user.findUnique({ where: { id: sub } });
      if (!user) {
        return { user: null as null };
      }

      return { user: publicUser(user) };
    },
  );

  app.post(
    "/api/auth/change-password",
    {
      onRequest: [requireJwt],
      config: {
        rateLimit: { max: 10, timeWindow: 15 * 60 * 1000 },
      },
    },
    async (req, reply) => {
      const parsed = changePasswordBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid body",
        });
      }

      const payload = req.user as { sub: string; email: string } | undefined;
      const sub = payload?.sub;
      if (!sub) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const user = await db.user.findUnique({ where: { id: sub } });
      if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { currentPassword, newPassword } = parsed.data;
      const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!currentOk) {
        return reply.status(400).send({ error: "Текущий пароль неверен" });
      }

      if (newPassword === currentPassword) {
        return reply
          .status(400)
          .send({ error: "Новый пароль совпадает с текущим" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      const updated = await db.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      recordAudit("AUTH_PASSWORD_CHANGE", { userId: user.id, req });
      await deleteAllUserRefresh(user.id);
      return await issueSession(reply, updated, sessionMetaFromReq(req));
    },
  );

  /**
   * v1.6.68 — self-serve восстановление пароля через одноразовые коды (без
   * email/SMTP). Два эндпоинта:
   *
   * 1) POST /api/auth/password-recovery/generate — authed + re-confirm пароля
   *    (коды обходят пароль → sensitive). Возвращает 10 plaintext-кодов ОДИН
   *    РАЗ, хранит bcrypt-хэши в User.passwordRecoveryCodes. Старые коды
   *    инвалидируются (перезапись).
   */
  app.post(
    "/api/auth/password-recovery/generate",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 10, timeWindow: 15 * 60 * 1000 } },
    },
    async (req, reply) => {
      const parsed = genRecoveryBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Требуется пароль" });
      }
      const sub = (req.user as { sub: string } | undefined)?.sub;
      if (!sub) return reply.status(401).send({ error: "Unauthorized" });
      const user = await db.user.findUnique({
        where: { id: sub },
        select: { id: true, passwordHash: true },
      });
      if (!user) return reply.status(401).send({ error: "Unauthorized" });
      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!ok) return reply.status(401).send({ error: "Неверный пароль" });
      const recovery = await generateRecoveryCodes();
      await db.user.update({
        where: { id: user.id },
        data: { passwordRecoveryCodes: recovery.hashedJson },
      });
      return { ok: true, recoveryCodes: recovery.plain }; // показываем 1 раз!
    },
  );

  /**
   * 2) POST /api/auth/password-recovery/reset — UNAUTHED. email + recovery code
   *    + новый пароль. Verify code (one-time consume), ставит новый пароль,
   *    снимает lockout, инвалидирует все сессии. Anti-enumeration: одинаковый
   *    generic-ответ и constant-ish time для несуществующего user'а.
   */
  app.post(
    "/api/auth/password-recovery/reset",
    { config: { rateLimit: { max: 10, timeWindow: 15 * 60 * 1000 } } },
    async (req, reply) => {
      const parsed = recoveryResetBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid body",
        });
      }
      const email = normalizeEmail(parsed.data.email);
      const { code, newPassword } = parsed.data;
      const genericError = "Неверный email или код восстановления";

      const user = await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (!user) {
        // anti-enumeration: тратим сопоставимое время
        await bcrypt.compare(code, FAKE_PASSWORD_HASH);
        return reply.status(400).send({ error: genericError });
      }
      if (user.deletedAt !== null || user.bannedAt !== null) {
        return reply.status(403).send({ error: "Аккаунт недоступен." });
      }
      const verified = await verifyRecoveryCode(code, user.passwordRecoveryCodes);
      if (!verified) {
        recordAudit("AUTH_LOGIN_FAILED", {
          userId: user.id,
          req,
          metadata: { reason: "recovery_code_invalid" },
        });
        return reply.status(400).send({ error: genericError });
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordRecoveryCodes: verified.remainingJson },
      });
      await resetLockout(user.id);
      await deleteAllUserRefresh(user.id); // безопасность: гасим старые сессии
      recordAudit("AUTH_PASSWORD_CHANGE", {
        userId: user.id,
        req,
        metadata: { via: "recovery_code" },
      });
      return { ok: true };
    },
  );

  /**
   * v1.5.52 Discord-parity B2: GET /api/auth/sessions — list active sessions.
   *
   * Возвращает все non-expired refresh-token rows этого user'а с metadata
   * (userAgent, ipAddress, createdAt, lastSeenAt). Frontend в Settings tree
   * «Сессии и устройства» рендерит row per session с revoke button.
   *
   * Expired rows опускаются — они lazy-cleanup'аются на findValid hit, но
   * на момент GET могут ещё быть в БД. Sorted by lastSeenAt DESC чтобы
   * recently-active вверху.
   *
   * tokenHash НЕ возвращается — это secret. id используется для revoke.
   */
  app.get(
    "/api/auth/sessions",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const payload = req.user as { sub: string } | undefined;
      const userId = payload?.sub;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const now = new Date();
      const rows = await db.refreshToken.findMany({
        where: { userId, expiresAt: { gt: now } },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
        },
        orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      });
      return {
        sessions: rows.map((r) => ({
          id: r.id,
          userAgent: r.userAgent,
          ipAddress: r.ipAddress,
          createdAt: r.createdAt.toISOString(),
          lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
          expiresAt: r.expiresAt.toISOString(),
        })),
      };
    },
  );

  /**
   * v1.5.52 B2: DELETE /api/auth/sessions/:id — revoke single session.
   *
   * Permission: только владелец session'а (RefreshToken.userId == caller).
   * 404 если не существует ИЛИ принадлежит другому user'у (не leak'аем
   * существование).
   *
   * После revoke'а: целевая session становится invalid (next refresh
   * вернёт 401). Если revoke'нули current session — current access token
   * остаётся валидным до его JWT expiry (15 min типично), потом clients
   * без refresh-возможности теряют auth. Это OK — user явно revoked.
   */
  app.delete(
    "/api/auth/sessions/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const payload = req.user as { sub: string } | undefined;
      const userId = payload?.sub;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id } = req.params as { id: string };
      const row = await db.refreshToken.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });
      if (!row || row.userId !== userId) {
        return reply.status(404).send({ error: "Session not found" });
      }
      await db.refreshToken.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
