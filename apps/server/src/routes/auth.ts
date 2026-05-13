import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
} from "../security/twoFactor.js";

const registerBody = z.object({
  email: z.string().email().max(320),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .max(128)
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), {
      message: "Пароль должен содержать буквы и цифры",
    }),
  displayName: z.string().min(1).max(64),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
  /** TOTP 6-digit code, обязателен если у user 2FA включён. */
  totpCode: z.string().regex(/^\d{6}$/).optional(),
  /** Recovery code (формат XXXXX-XXXXX) — alternative к TOTP. */
  recoveryCode: z.string().max(40).optional(),
});

const refreshBody = z.object({
  refreshToken: z.string().min(10),
});

const ACCESS_TTL = "15m";

function publicUser(u: {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  status?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
  createdAt: Date;
  twoFactorEnabled?: boolean;
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
  };
}

export type AuthResponseBody = {
  accessToken: string;
  refreshToken: string;
  /** Совместимость: короткоживущий access, как раньше поле `token` */
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
): Promise<AuthResponseBody> {
  const accessToken = await reply.jwtSign(
    { sub: user.id, email: user.email },
    { expiresIn: ACCESS_TTL },
  );
  const { raw: refreshToken, hash } = makeRefreshTokenPair();
  await storeRefreshToken(user.id, hash);
  return {
    accessToken,
    refreshToken,
    token: accessToken,
    user: publicUser(user),
  };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * Rate-limit auth routes:
   *   - register: 5 / 15 min per IP
   *   - login: 10 / 15 min per IP (с учётом lockout per user в БД)
   *   - refresh: 60 / 5 min per IP (token rotation)
   */
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
      const { email, password, displayName } = parsed.data;
      const exists = await db.user.findUnique({ where: { email } });
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
      return await issueSession(reply, user);
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
      const { email, password, totpCode, recoveryCode } = parsed.data;
      const user = await db.user.findUnique({ where: { email } });

      // Identical error для «не найден» и «неверный пароль» —
      // anti-enumeration. Lockout трекаем только если user exists.
      if (!user) {
        // Симулируем bcrypt с фейк-хэшем — constant-time anti-timing.
        await bcrypt.compare(password, "$2a$12$fakehashtotallyfakedontuse.....");
        recordAudit("AUTH_LOGIN_FAILED", {
          userId: null,
          req,
          metadata: { email, reason: "user_not_found" },
        });
        return reply.status(401).send({ error: "Неверный email или пароль" });
      }

      // Проверка lockout — если залочен, не даём даже пробовать пароль.
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
          error: `Аккаунт временно заблокирован после ${lockStatus.attempts} неудачных попыток. Попробуй через ${minsLeft} мин.`,
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

      // 2FA gate: если включён — требуем totpCode или recoveryCode
      if (user.twoFactorEnabled) {
        if (!totpCode && !recoveryCode) {
          // Special response: «нужен 2FA код». Клиент должен показать поле.
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

      // Успех: сброс lockout + audit + rotate refresh
      await resetLockout(user.id);
      await deleteAllUserRefresh(user.id);
      recordAudit("AUTH_LOGIN", { userId: user.id, req });
      return await issueSession(reply, user);
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
      await storeRefreshToken(user.id, hash);
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
}
