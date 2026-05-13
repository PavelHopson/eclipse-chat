import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  buildOtpAuthUrl,
  decryptSecret,
  encryptSecret,
  generateQrDataUrl,
  generateRecoveryCodes,
  generateSecret,
  verifyCode,
} from "../security/twoFactor.js";
import { recordAudit } from "../security/audit.js";

const enableConfirmBody = z.object({
  code: z.string().regex(/^\d{6}$/),
});

const disableBody = z.object({
  password: z.string().min(1).max(128),
});

/**
 * 2FA endpoints:
 *   POST /api/auth/2fa/setup    — issue secret + QR (pre-enable)
 *   POST /api/auth/2fa/enable   — confirm 6-digit code + generate recovery codes
 *   POST /api/auth/2fa/disable  — verify password + disable
 *   POST /api/auth/2fa/regenerate-recovery — generate new recovery codes
 */
export async function registerTwoFactorRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/2fa/setup
   * Запрашивает QR + base32 secret. Secret ВРЕМЕННО хранится в БД с
   * twoFactorEnabled=false до подтверждения /enable.
   */
  app.post(
    "/api/auth/2fa/setup",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, twoFactorEnabled: true },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });
      if (user.twoFactorEnabled) {
        return reply.status(409).send({
          error: "2FA уже включён. Сначала отключи через /api/auth/2fa/disable.",
        });
      }
      const secret = generateSecret();
      let encrypted: string;
      try {
        encrypted = encryptSecret(secret);
      } catch (err) {
        app.log.error({ err }, "2FA encryption key not configured");
        return reply.status(503).send({
          error: "2FA не настроен на сервере. Admin должен задать TWOFA_ENCRYPTION_KEY в .env.",
        });
      }
      await db.user.update({
        where: { id: userId },
        data: { twoFactorSecret: encrypted, twoFactorEnabled: false },
      });
      const otpUrl = buildOtpAuthUrl(secret, user.email);
      const qr = await generateQrDataUrl(otpUrl);
      return {
        secret, // plaintext, показываем 1 раз (manual entry alternative)
        otpAuthUrl: otpUrl,
        qrDataUrl: qr,
      };
    },
  );

  /**
   * POST /api/auth/2fa/enable — confirm 6-digit code + generate recovery codes.
   * Только после успешного подтверждения 2FA активируется.
   */
  app.post(
    "/api/auth/2fa/enable",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = enableConfirmBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Код должен быть 6 цифр" });
      }
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, twoFactorSecret: true, twoFactorEnabled: true },
      });
      if (!user || !user.twoFactorSecret) {
        return reply.status(400).send({
          error: "Сначала вызови /api/auth/2fa/setup чтобы получить secret",
        });
      }
      if (user.twoFactorEnabled) {
        return reply.status(409).send({ error: "2FA уже включён" });
      }
      let secret: string;
      try {
        secret = decryptSecret(user.twoFactorSecret);
      } catch {
        return reply.status(500).send({ error: "Сбой 2FA" });
      }
      if (!(await verifyCode(secret, parsed.data.code))) {
        return reply.status(400).send({ error: "Неверный код" });
      }
      const recovery = await generateRecoveryCodes();
      await db.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorRecoveryCodes: recovery.hashedJson,
        },
      });
      recordAudit("TWOFA_ENABLED", { userId, req });
      return {
        ok: true,
        recoveryCodes: recovery.plain, // показываем 1 раз!
      };
    },
  );

  /**
   * POST /api/auth/2fa/disable — отключить 2FA. Требует password confirmation
   * (anti-CSRF defense-in-depth).
   */
  app.post(
    "/api/auth/2fa/disable",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = disableBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Требуется пароль" });
      }
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true, twoFactorEnabled: true },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });
      if (!user.twoFactorEnabled) {
        return { ok: true, alreadyDisabled: true };
      }
      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!ok) {
        return reply.status(401).send({ error: "Неверный пароль" });
      }
      await db.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorRecoveryCodes: null,
        },
      });
      recordAudit("TWOFA_DISABLED", { userId, req });
      return { ok: true };
    },
  );

  /**
   * POST /api/auth/2fa/regenerate-recovery — новые 10 recovery codes.
   * Старые сразу инвалидируются.
   */
  app.post(
    "/api/auth/2fa/regenerate-recovery",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });
      if (!user || !user.twoFactorEnabled) {
        return reply.status(400).send({ error: "Сначала включи 2FA" });
      }
      const recovery = await generateRecoveryCodes();
      await db.user.update({
        where: { id: userId },
        data: { twoFactorRecoveryCodes: recovery.hashedJson },
      });
      return {
        ok: true,
        recoveryCodes: recovery.plain,
      };
    },
  );
}
