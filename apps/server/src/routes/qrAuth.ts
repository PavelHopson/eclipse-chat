import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import QRCode from "qrcode";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { issueSession } from "./auth.js";
import { recordAudit } from "../security/audit.js";

const QR_TTL_MS = 2 * 60 * 1000;
const appOrigin = (process.env.PUBLIC_WEB_ORIGIN ?? process.env.CORS_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");
const appBasePath = appOrigin.endsWith("/eclipse-chat") ? appOrigin : `${appOrigin}/eclipse-chat`;

const attemptQuery = z.object({
  attemptId: z.string().cuid(),
  verifier: z.string().min(32).max(128),
});
const codeBody = z.object({ code: z.string().min(32).max(128) });
const exchangeBody = z.object({
  attemptId: z.string().cuid(),
  verifier: z.string().min(32).max(128),
});

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}

function sessionMeta(req: FastifyRequest): { userAgent: string | null; ipAddress: string | null } {
  const ua = req.headers["user-agent"];
  return {
    userAgent: typeof ua === "string" && ua.length > 0 ? ua.slice(0, 512) : null,
    ipAddress: req.ip || null,
  };
}

async function optionalUserId(req: FastifyRequest): Promise<string | null> {
  if (typeof req.headers.authorization !== "string") return null;
  try {
    await req.jwtVerify();
    return getUserId(req);
  } catch {
    return null;
  }
}

async function expireIfNeeded(id: string, expiresAt: Date, status: string): Promise<string> {
  if ((status === "PENDING" || status === "APPROVED") && expiresAt.getTime() <= Date.now()) {
    const changed = await db.qrLoginAttempt.updateMany({
      where: { id, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "EXPIRED" },
    });
    if (changed.count > 0) recordAudit("AUTH_QR_EXPIRED", { metadata: { attemptId: id } });
    return "EXPIRED";
  }
  return status;
}

function qrUrl(code: string): string {
  return `${appBasePath}/#qr-login?code=${encodeURIComponent(code)}`;
}

export async function registerQrAuthRoutes(app: FastifyInstance) {
  /**
   * Start a short-lived pairing. If the target device already has a valid
   * session, the challenge is bound to that account; otherwise the phone's
   * authenticated account becomes the target at approval time.
   */
  app.post(
    "/api/auth/qr/start",
    { config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (req, reply) => {
      // Keep the short-lived table bounded even when no background worker is
      // running. This is deliberately done before every new challenge and
      // only removes records that can no longer be exchanged.
      await db.qrLoginAttempt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      const targetUserId = await optionalUserId(req);
      const code = randomSecret();
      const verifier = randomSecret();
      const expiresAt = new Date(Date.now() + QR_TTL_MS);
      const meta = sessionMeta(req);
      const attempt = await db.qrLoginAttempt.create({
        data: {
          codeHash: hash(code),
          verifierHash: hash(verifier),
          targetUserId,
          expiresAt,
          targetUserAgent: meta.userAgent,
          targetIpAddress: meta.ipAddress,
        },
        select: { id: true, expiresAt: true },
      });
      const url = qrUrl(code);
      const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1 });
      recordAudit("AUTH_QR_STARTED", {
        userId: targetUserId,
        req,
        metadata: { attemptId: attempt.id, targetBound: Boolean(targetUserId) },
      });
      return {
        attemptId: attempt.id,
        verifier,
        qrUrl: url,
        qrDataUrl,
        expiresAt: attempt.expiresAt.toISOString(),
        status: "PENDING" as const,
      };
    },
  );

  app.post(
    "/api/auth/qr/status",
    { config: { rateLimit: { max: 60, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = attemptQuery.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-запрос" });
      const attempt = await db.qrLoginAttempt.findFirst({
        where: { id: parsed.data.attemptId, verifierHash: hash(parsed.data.verifier) },
        select: { id: true, status: true, expiresAt: true, approvedAt: true, claimedAt: true, claimUserAgent: true },
      });
      if (!attempt) return reply.status(404).send({ error: "QR-сессия не найдена" });
      const status = await expireIfNeeded(attempt.id, attempt.expiresAt, attempt.status);
      return {
        status,
        expiresAt: attempt.expiresAt.toISOString(),
        approvedAt: status === "APPROVED" ? attempt.approvedAt?.toISOString() ?? null : null,
        claimed: Boolean(attempt.claimedAt),
        claimedDevice: attempt.claimUserAgent ? attempt.claimUserAgent.slice(0, 180) : null,
      };
    },
  );

  /** Anonymous phone-side polling. Deliberately returns no identity or credentials. */
  app.post(
    "/api/auth/qr/phone-status",
    { config: { rateLimit: { max: 60, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = codeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-код" });
      const attempt = await db.qrLoginAttempt.findUnique({
        where: { codeHash: hash(parsed.data.code) },
        select: { id: true, status: true, expiresAt: true },
      });
      if (!attempt) return reply.status(404).send({ error: "QR-сессия не найдена" });
      const status = await expireIfNeeded(attempt.id, attempt.expiresAt, attempt.status);
      return { status, expiresAt: attempt.expiresAt.toISOString() };
    },
  );

  /** Anonymous phone claim for a QR displayed by an already-authenticated device. */
  app.post(
    "/api/auth/qr/claim",
    { config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = codeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-код" });
      const attempt = await db.qrLoginAttempt.findUnique({ where: { codeHash: hash(parsed.data.code) }, select: { id: true, targetUserId: true, status: true, expiresAt: true } });
      if (!attempt || !attempt.targetUserId) return reply.status(404).send({ error: "QR-сессия не найдена" });
      if (attempt.status !== "PENDING" || attempt.expiresAt.getTime() <= Date.now()) {
        if (attempt.status === "PENDING") await expireIfNeeded(attempt.id, attempt.expiresAt, attempt.status);
        return reply.status(409).send({ error: "QR-сессия уже недоступна" });
      }
      const claimed = await db.qrLoginAttempt.updateMany({
        where: { id: attempt.id, status: "PENDING", claimedAt: null, expiresAt: { gt: new Date() } },
        data: { claimedAt: new Date(), claimUserAgent: sessionMeta(req).userAgent, claimIpAddress: sessionMeta(req).ipAddress },
      });
      if (claimed.count !== 1) return reply.status(409).send({ error: "QR-сессия уже заявлена" });
      return { status: "CLAIMED" as const };
    },
  );

  /** Owner-side approval for the reverse flow (desktop -> phone). */
  app.post(
    "/api/auth/qr/approve-target",
    { onRequest: [requireJwt], config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = exchangeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-запрос" });
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const changed = await db.qrLoginAttempt.updateMany({
        where: { id: parsed.data.attemptId, verifierHash: hash(parsed.data.verifier), targetUserId: userId, status: "PENDING", claimedAt: { not: null }, expiresAt: { gt: new Date() } },
        data: { status: "APPROVED", approvedByUserId: userId, approvedAt: new Date(), approverUserAgent: sessionMeta(req).userAgent, approverIpAddress: sessionMeta(req).ipAddress },
      });
      if (changed.count !== 1) return reply.status(409).send({ error: "QR-сессия не готова к подтверждению" });
      recordAudit("AUTH_QR_APPROVED", { userId, req, metadata: { attemptId: parsed.data.attemptId, direction: "phone" } });
      return { status: "APPROVED" as const };
    },
  );

  /** Phone-side action. The phone must already have a regular JWT session. */
  app.post(
    "/api/auth/qr/approve",
    { onRequest: [requireJwt], config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = codeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-код" });
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const attempt = await db.qrLoginAttempt.findUnique({
        where: { codeHash: hash(parsed.data.code) },
        select: { id: true, targetUserId: true, status: true, expiresAt: true },
      });
      if (!attempt) return reply.status(404).send({ error: "QR-сессия не найдена" });
      const status = await expireIfNeeded(attempt.id, attempt.expiresAt, attempt.status);
      if (status !== "PENDING") return reply.status(409).send({ error: "QR-сессия уже недоступна" });
      if (attempt.targetUserId && attempt.targetUserId !== userId) {
        return reply.status(403).send({ error: "QR-код связан с другим профилем" });
      }
      const changed = await db.qrLoginAttempt.updateMany({
        where: {
          id: attempt.id,
          status: "PENDING",
          expiresAt: { gt: new Date() },
          approvedByUserId: null,
        },
        data: {
          status: "APPROVED",
          approvedByUserId: userId,
          approvedAt: new Date(),
          approverUserAgent: sessionMeta(req).userAgent,
          approverIpAddress: sessionMeta(req).ipAddress,
        },
      });
      if (changed.count !== 1) return reply.status(409).send({ error: "QR-сессия уже обработана" });
      recordAudit("AUTH_QR_APPROVED", { userId, req, metadata: { attemptId: attempt.id } });
      return { status: "APPROVED" as const };
    },
  );

  app.post(
    "/api/auth/qr/deny",
    { onRequest: [requireJwt], config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = codeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-код" });
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const attempt = await db.qrLoginAttempt.findUnique({ where: { codeHash: hash(parsed.data.code) }, select: { id: true, targetUserId: true, status: true, expiresAt: true } });
      if (!attempt) return reply.status(404).send({ error: "QR-сессия не найдена" });
      if (attempt.targetUserId && attempt.targetUserId !== userId) return reply.status(403).send({ error: "QR-код связан с другим профилем" });
      const changed = await db.qrLoginAttempt.updateMany({ where: { id: attempt.id, status: "PENDING", expiresAt: { gt: new Date() } }, data: { status: "DENIED", deniedAt: new Date(), approvedByUserId: userId } });
      if (changed.count !== 1) return reply.status(409).send({ error: "QR-сессия уже обработана" });
      recordAudit("AUTH_QR_DENIED", { userId, req, metadata: { attemptId: attempt.id } });
      return { status: "DENIED" as const };
    },
  );

  app.post(
    "/api/auth/qr/cancel",
    { config: { rateLimit: { max: 10, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = exchangeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-запрос" });
      const changed = await db.qrLoginAttempt.updateMany({ where: { id: parsed.data.attemptId, verifierHash: hash(parsed.data.verifier), status: "PENDING" }, data: { status: "CANCELLED" } });
      if (changed.count !== 1) return reply.status(404).send({ error: "QR-сессия не найдена" });
      recordAudit("AUTH_QR_CANCELLED", { metadata: { attemptId: parsed.data.attemptId } });
      return { status: "CANCELLED" as const };
    },
  );

  /** Phone-side exchange for a QR explicitly approved by the logged-in desktop. */
  app.post(
    "/api/auth/qr/exchange-code",
    { config: { rateLimit: { max: 3, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = codeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-код" });
      const user = await db.$transaction(async tx => {
        const attempt = await tx.qrLoginAttempt.findFirst({ where: { codeHash: hash(parsed.data.code) }, select: { id: true, status: true, expiresAt: true, claimedAt: true, targetUserId: true } });
        if (!attempt || !attempt.targetUserId || !attempt.claimedAt || attempt.status !== "APPROVED" || attempt.expiresAt.getTime() <= Date.now()) return null;
        const changed = await tx.qrLoginAttempt.updateMany({ where: { id: attempt.id, codeHash: hash(parsed.data.code), status: "APPROVED", consumedAt: null, expiresAt: { gt: new Date() } }, data: { status: "CONSUMED", consumedAt: new Date() } });
        if (changed.count !== 1) return null;
        return tx.user.findUnique({ where: { id: attempt.targetUserId }, select: { id: true, email: true, displayName: true, avatar: true, bio: true, status: true, createdAt: true, twoFactorEnabled: true, isPlatformOwner: true, bannedAt: true, deletedAt: true } });
      });
      if (!user || user.bannedAt || user.deletedAt) return reply.status(409).send({ error: "QR-сессия недоступна" });
      const session = await issueSession(reply, user, sessionMeta(req));
      recordAudit("AUTH_QR_EXCHANGED", { userId: user.id, req, metadata: { direction: "phone" } });
      return session;
    },
  );

  /** Target-side exchange. The verifier never leaves the target device. */
  app.post(
    "/api/auth/qr/exchange",
    { config: { rateLimit: { max: 3, timeWindow: 60_000 } } },
    async (req, reply) => {
      const parsed = exchangeBody.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Некорректный QR-запрос" });
      const meta = sessionMeta(req);
      const user = await db.$transaction(async tx => {
        const attempt = await tx.qrLoginAttempt.findFirst({
          where: { id: parsed.data.attemptId, verifierHash: hash(parsed.data.verifier) },
          select: { id: true, status: true, expiresAt: true, approvedByUserId: true },
        });
        if (!attempt || attempt.status !== "APPROVED" || attempt.expiresAt.getTime() <= Date.now() || !attempt.approvedByUserId) return null;
        const changed = await tx.qrLoginAttempt.updateMany({ where: { id: attempt.id, verifierHash: hash(parsed.data.verifier), status: "APPROVED", consumedAt: null, expiresAt: { gt: new Date() } }, data: { status: "CONSUMED", consumedAt: new Date() } });
        if (changed.count !== 1) return null;
        return tx.user.findUnique({ where: { id: attempt.approvedByUserId }, select: { id: true, email: true, displayName: true, avatar: true, bio: true, status: true, createdAt: true, twoFactorEnabled: true, isPlatformOwner: true, bannedAt: true, deletedAt: true } });
      });
      if (!user || user.bannedAt || user.deletedAt) return reply.status(409).send({ error: "QR-сессия недоступна" });
      const session = await issueSession(reply, user, meta);
      recordAudit("AUTH_QR_EXCHANGED", { userId: user.id, req, metadata: { attemptId: parsed.data.attemptId } });
      return session;
    },
  );
}

