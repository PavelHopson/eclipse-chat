import { createHash, randomBytes } from "node:crypto";
import { db } from "../db.js";

const REFRESH_DAYS = 7;

function hashToken(raw: string) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function makeRefreshTokenPair() {
  const raw = randomBytes(48).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

/**
 * v1.5.52 B2: session metadata. userAgent + ipAddress capture'ятся на
 * store (login + refresh-rotate) для UI «Активные сеансы». lastSeenAt
 * bump'ается на каждый findValid hit чтобы UI знал когда session
 * последний раз использовалась.
 *
 * userAgent truncate до 512 chars — типичный UA 150-250, защищаемся от
 * arbitrarily-long header'ов (Headers v2 spec не лимитирует).
 */
export type SessionMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

const UA_MAX = 512;

function sanitizeMeta(meta: SessionMeta | undefined): SessionMeta {
  if (!meta) return {};
  return {
    userAgent: meta.userAgent ? meta.userAgent.slice(0, UA_MAX) : null,
    ipAddress: meta.ipAddress ?? null,
  };
}

export type SessionProof = { passwordHash: string; twoFactorEnabled: boolean; twoFactorSecret: string | null; qr?: { attemptId: string; approvedBySessionId: string }; recovery?: { expectedJson: string; remainingJson: string }; login?: boolean };

export async function storeRefreshToken(
  userId: string,
  tokenHash: string,
  meta: SessionMeta | undefined,
  sessionId: string | undefined,
  proof: SessionProof,
) {
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const sanitized = sanitizeMeta(meta);
  const row = await db.$transaction(async tx => {
    if (proof.recovery || proof.login) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    else await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR SHARE`;
    const current = await tx.user.findUnique({ where: { id: userId }, select: { passwordHash: true, twoFactorEnabled: true, twoFactorSecret: true, twoFactorRecoveryCodes: true, bannedAt: true, deletedAt: true } });
    if (!current || current.bannedAt || current.deletedAt || current.passwordHash !== proof.passwordHash ||
        current.twoFactorEnabled !== proof.twoFactorEnabled || current.twoFactorSecret !== proof.twoFactorSecret) throw new Error("AUTH_STATE_CHANGED");
    if (proof.recovery) {
      if (current.twoFactorRecoveryCodes !== proof.recovery.expectedJson) throw new Error("RECOVERY_CODE_ALREADY_USED");
      await tx.user.update({ where: { id: userId }, data: { twoFactorRecoveryCodes: proof.recovery.remainingJson }, select: { id: true } });
    }
    if (proof.qr) {
      await tx.$queryRaw`SELECT "id" FROM "RefreshToken" WHERE "id" = ${proof.qr.approvedBySessionId} FOR SHARE`;
      const approver = await tx.refreshToken.findUnique({ where: { id: proof.qr.approvedBySessionId }, select: { userId: true, expiresAt: true } });
      const attempts = await tx.$queryRaw<Array<{ approvedByUserId: string | null; approvedBySessionId: string | null; status: string; expiresAt: Date }>>`SELECT "approvedByUserId", "approvedBySessionId", "status", "expiresAt" FROM "QrLoginAttempt" WHERE "id" = ${proof.qr.attemptId}`;
      const attempt = attempts[0];
      if (!approver || approver.userId !== userId || approver.expiresAt <= new Date() || !attempt ||
          attempt.approvedByUserId !== userId || attempt.approvedBySessionId !== proof.qr.approvedBySessionId ||
          attempt.status !== "CONSUMED" || attempt.expiresAt <= new Date()) throw new Error("QR_AUTH_EXPIRED");
    }
    const created = await tx.refreshToken.create({
      data: { ...(sessionId ? { id: sessionId } : {}), userId, tokenHash, expiresAt,
        userAgent: sanitized.userAgent ?? null, ipAddress: sanitized.ipAddress ?? null, lastSeenAt: new Date() },
    });
    if (proof.login) await tx.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockoutUntil: null }, select: { id: true } });
    return created;
  });
  return { id: row.id, expiresAt };
}

/**
 * Валидный refresh-ряд: id записи + userId, иначе null. Просроченный — удаляется.
 *
 * v1.5.52 B2: при успешном hit'е bump'аем lastSeenAt (best-effort, ignore
 * race на concurrent refresh). Используется для UI «Активна сейчас» indicator'а.
 */
export async function findValidRefreshTokenRow(raw: string) {
  const h = hashToken(raw);
  const row = await db.refreshToken.findUnique({ where: { tokenHash: h } });
  if (!row) {
    return null;
  }
  if (row.expiresAt < new Date()) {
    await db.refreshToken.deleteMany({ where: { tokenHash: h, expiresAt: { lte: new Date() } } });
    return null;
  }
  // Best-effort bump — concurrent refresh может проигнорировать update race,
  // не критично. Не блокируем основную логику refresh'а.
  void db.refreshToken
    .updateMany({ where: { id: row.id, tokenHash: h }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
  return { id: row.id, userId: row.userId, tokenHash: row.tokenHash };
}

export async function deleteRefreshByRaw(raw: string) {
  const h = hashToken(raw);
  await db.refreshToken.deleteMany({ where: { tokenHash: h } });
}

/**
 * Revoke one refresh session only when it belongs to the authenticated user.
 * The compound filter is intentional: a leaked/guessed token for another
 * account must never let the caller terminate somebody else's session.
 */
export async function deleteRefreshByRawForUser(raw: string, userId: string) {
  const h = hashToken(raw);
  const result = await db.refreshToken.deleteMany({
    where: { tokenHash: h, userId },
  });
  return result.count;
}

export async function deleteAllUserRefresh(userId: string) {
  await db.refreshToken.deleteMany({ where: { userId } });
}

/** Atomic CAS on the original session; a revoked row cannot be recreated. */
export async function rotateRefreshToken(raw: string, nextHash: string, meta?: SessionMeta) {
  const previousHash = hashToken(raw);
  const candidate = await db.refreshToken.findUnique({ where: { tokenHash: previousHash }, select: { id: true, userId: true } });
  if (!candidate) return null;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${candidate.userId} FOR SHARE`;
    const user = await tx.user.findUnique({ where: { id: candidate.userId }, select: { id: true, email: true, bannedAt: true, deletedAt: true } });
    if (!user || user.bannedAt || user.deletedAt) return null;
    const sanitized = sanitizeMeta(meta);
    const now = new Date();
    const updated = await tx.refreshToken.updateMany({
      where: { id: candidate.id, userId: candidate.userId, tokenHash: previousHash, expiresAt: { gt: now } },
      data: { tokenHash: nextHash, expiresAt: new Date(now.getTime() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
        userAgent: sanitized.userAgent ?? null, ipAddress: sanitized.ipAddress ?? null, lastSeenAt: now },
    });
    if (updated.count !== 1) return null;
    return { id: candidate.id, userId: candidate.userId, email: user.email };
  });
}

/** A signed session id permits revocation across refresh rotation. */
export async function deleteRefreshBySessionForUser(sessionId: string, userId: string) {
  return (await db.refreshToken.deleteMany({ where: { id: sessionId, userId } })).count;
}
