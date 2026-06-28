/**
 * v1.6.99 — одноразовые / истекающие server-invites (SimpleX-inspired privacy
 * slice B). Чистая логика валидности инвайта — без БД, чтобы юнит-тестить
 * (CI гоняет vitest без PG). Роуты (`routes/invites.ts`) и join-путь
 * (`routes/servers.ts`) дергают эти хелперы.
 *
 * Отличие от legacy `Server.inviteCode` (вечный, многоразовый): ServerInvite —
 * отдельные коды с лимитом использований (`maxUses`) и/или сроком (`expiresAt`),
 * отзываемые (`revokedAt`). Legacy-код продолжает работать параллельно.
 */

import { randomBytes } from "node:crypto";

/** Минимальный снимок инвайта для проверки валидности (subset ServerInvite). */
export interface InviteState {
  maxUses: number | null;
  uses: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/** Почему инвайт нельзя принять. null — инвайт валиден. */
export type InviteRejectReason = "revoked" | "expired" | "exhausted";

export function inviteRejectReason(inv: InviteState, now: Date): InviteRejectReason | null {
  if (inv.revokedAt !== null) return "revoked";
  if (inv.expiresAt !== null && inv.expiresAt.getTime() <= now.getTime()) return "expired";
  if (inv.maxUses !== null && inv.uses >= inv.maxUses) return "exhausted";
  return null;
}

export function isInviteJoinable(inv: InviteState, now: Date): boolean {
  return inviteRejectReason(inv, now) === null;
}

// Границы срока жизни инвайта: минимум 1 минута, максимум 30 дней.
export const INVITE_MIN_AGE_SECONDS = 60;
export const INVITE_MAX_AGE_SECONDS = 30 * 24 * 3600;
// Потолок числа использований одного кода (защита от абсурдных значений).
export const INVITE_MAX_USES_CAP = 1000;

/**
 * Срок истечения из переданного TTL в секундах. null/undefined → бессрочный
 * инвайт. Значение клампится в [INVITE_MIN_AGE_SECONDS, INVITE_MAX_AGE_SECONDS].
 */
export function resolveInviteExpiry(expiresInSeconds: number | null | undefined, now: Date): Date | null {
  if (expiresInSeconds === null || expiresInSeconds === undefined) return null;
  const clamped = Math.min(
    Math.max(Math.floor(expiresInSeconds), INVITE_MIN_AGE_SECONDS),
    INVITE_MAX_AGE_SECONDS,
  );
  return new Date(now.getTime() + clamped * 1000);
}

/** Нормализует maxUses: null → без лимита; иначе клампится в [1, CAP]. */
export function resolveInviteMaxUses(maxUses: number | null | undefined): number | null {
  if (maxUses === null || maxUses === undefined) return null;
  return Math.min(Math.max(Math.floor(maxUses), 1), INVITE_MAX_USES_CAP);
}

/** URL-safe код инвайта (12 символов base64url). Уникальность — через @unique + retry. */
export function generateInviteCode(): string {
  return randomBytes(9).toString("base64url");
}
