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

export async function storeRefreshToken(userId: string, tokenHash: string) {
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await db.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return { expiresAt };
}

/** Валидный refresh-ряд: id записи + userId, иначе null. Просроченный — удаляется. */
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
  return { id: row.id, userId: row.userId };
}

export async function deleteRefreshByRaw(raw: string) {
  const h = hashToken(raw);
  await db.refreshToken.deleteMany({ where: { tokenHash: h } });
}

export async function deleteAllUserRefresh(userId: string) {
  await db.refreshToken.deleteMany({ where: { userId } });
}
