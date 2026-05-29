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

export async function storeRefreshToken(
  userId: string,
  tokenHash: string,
  meta?: SessionMeta,
) {
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const sanitized = sanitizeMeta(meta);
  await db.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: sanitized.userAgent ?? null,
      ipAddress: sanitized.ipAddress ?? null,
      lastSeenAt: new Date(),
    },
  });
  return { expiresAt };
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
    await db.refreshToken.delete({ where: { id: row.id } });
    return null;
  }
  // Best-effort bump — concurrent refresh может проигнорировать update race,
  // не критично. Не блокируем основную логику refresh'а.
  void db.refreshToken
    .update({ where: { id: row.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
  return { id: row.id, userId: row.userId };
}

export async function deleteRefreshByRaw(raw: string) {
  const h = hashToken(raw);
  await db.refreshToken.deleteMany({ where: { tokenHash: h } });
}

export async function deleteAllUserRefresh(userId: string) {
  await db.refreshToken.deleteMany({ where: { userId } });
}
