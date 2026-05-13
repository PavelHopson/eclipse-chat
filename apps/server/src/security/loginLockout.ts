import { db } from "../db.js";

/**
 * Brute-force protection: трекаем failed login attempts на user-level
 * (по email — даже если user не найден, всё равно constant-time bcrypt
 * чтобы не timing-leak'ить existence).
 *
 * Логика:
 *   - 5 неудачных подряд → lock 15 минут.
 *   - 10 неудачных → lock 1 час.
 *   - Каждый успех (включая 2FA verified) сбрасывает счётчик.
 *
 * Anti-enumeration: route /api/auth/login возвращает identical 401 для
 * «user not found» и «wrong password». Внутри лок учитываем только
 * если user exists (иначе attacker DOS'ит чужие email'ы).
 */

const LOCKOUT_THRESHOLDS = [
  { attempts: 5, lockoutMinutes: 15 },
  { attempts: 10, lockoutMinutes: 60 },
  { attempts: 20, lockoutMinutes: 24 * 60 },
];

export type LockoutStatus = {
  locked: boolean;
  lockoutUntil: Date | null;
  attempts: number;
};

export async function checkLockout(userId: string): Promise<LockoutStatus> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, lockoutUntil: true },
  });
  if (!u) return { locked: false, lockoutUntil: null, attempts: 0 };
  const now = new Date();
  const locked = Boolean(u.lockoutUntil && u.lockoutUntil > now);
  return {
    locked,
    lockoutUntil: u.lockoutUntil,
    attempts: u.failedLoginAttempts,
  };
}

export async function registerFailedLogin(userId: string): Promise<LockoutStatus> {
  const u = await db.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true, lockoutUntil: true },
  });
  // Подбираем самый высокий threshold который пройден
  let appliedMinutes: number | null = null;
  for (const t of LOCKOUT_THRESHOLDS) {
    if (u.failedLoginAttempts >= t.attempts) {
      appliedMinutes = t.lockoutMinutes;
    }
  }
  if (appliedMinutes !== null) {
    const lockoutUntil = new Date(Date.now() + appliedMinutes * 60 * 1000);
    await db.user.update({
      where: { id: userId },
      data: { lockoutUntil },
    });
    return {
      locked: true,
      lockoutUntil,
      attempts: u.failedLoginAttempts,
    };
  }
  return {
    locked: false,
    lockoutUntil: u.lockoutUntil,
    attempts: u.failedLoginAttempts,
  };
}

export async function resetLockout(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockoutUntil: null },
  });
}
