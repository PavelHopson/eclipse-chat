/**
 * v0.78 #17 phase 1 — permission taxonomy.
 *
 * 9 permission groups × 10 roles = 90-cell hardcoded matrix. В phase 1 это
 * read-only: hasPermission() выдаёт правду из MATRIX. Phase 2 — custom
 * per-workspace overrides через RolePermission join table.
 *
 * Permission groups покрывают operational surface:
 *   - ROOM_*       — управление каналами
 *   - MESSAGE_*    — модерация сообщений
 *   - TASK_*       — ActionItem управление
 *   - MEMBER_*     — управление участниками
 *   - BOT_*        — управление ботами + API keys
 *   - ANALYTICS_*  — Team Health, audit, analytics tab
 *   - AI_USE       — может ли user mention'ить @ai / @pm и получать ответы
 *
 * Convention: name = `<DOMAIN>_<VERB>`. Verb типа CREATE / DELETE / VIEW /
 * EDIT / APPROVE. Negative permissions (BAN_*) не нужны — отсутствие
 * permission = deny.
 */

import type { MemberRole } from "../routes/servers.js";

export type Permission =
  | "ROOM_CREATE"
  | "ROOM_DELETE"
  | "ROOM_EDIT"
  | "ROOM_VIEW_INTERNAL"
  | "MESSAGE_PIN"
  | "MESSAGE_DELETE_OTHERS"
  | "MESSAGE_POST_BROADCAST"
  | "TASK_CREATE"
  | "TASK_ASSIGN"
  | "TASK_APPROVE"
  | "TASK_DELETE_OTHERS"
  | "MEMBER_INVITE"
  | "MEMBER_KICK"
  | "MEMBER_ROLE_CHANGE"
  | "BOT_CREATE"
  | "BOT_DELETE"
  | "BOT_KEY_VIEW"
  | "ANALYTICS_VIEW"
  | "AUDIT_LOG_VIEW"
  | "AI_USE";

export const PERMISSIONS: readonly Permission[] = [
  "ROOM_CREATE",
  "ROOM_DELETE",
  "ROOM_EDIT",
  "ROOM_VIEW_INTERNAL",
  "MESSAGE_PIN",
  "MESSAGE_DELETE_OTHERS",
  "MESSAGE_POST_BROADCAST",
  "TASK_CREATE",
  "TASK_ASSIGN",
  "TASK_APPROVE",
  "TASK_DELETE_OTHERS",
  "MEMBER_INVITE",
  "MEMBER_KICK",
  "MEMBER_ROLE_CHANGE",
  "BOT_CREATE",
  "BOT_DELETE",
  "BOT_KEY_VIEW",
  "ANALYTICS_VIEW",
  "AUDIT_LOG_VIEW",
  "AI_USE",
] as const;

/**
 * Matrix: для каждой роли — set permissions. Hardcoded в phase 1.
 *
 * Иерархия:
 *   OWNER       — ALL (включая destructive); единственная роль с TRANSFER
 *                 ownership путь (не permission, отдельный endpoint).
 *   ADMIN       — ALL минус MEMBER_ROLE_CHANGE на OWNER (separately enforced).
 *   MODERATOR   — moderation + pin + delete others' messages.
 *   ARCHITECT   — read all + ROOM_EDIT + TASK_APPROVE (decisions). Без member mgmt.
 *   DEVELOPER   — ROOM_CREATE + TASK_*. Engineer-flow.
 *   OPERATOR    — TASK_* + MESSAGE_DELETE_OTHERS (modulo MOD-level). Dispatcher.
 *   CLIENT      — только TASK_CREATE / AI_USE в CLIENT-mode. Internal каналы invisible.
 *   VIEWER      — read-only + ANALYTICS_VIEW.
 *   GUEST       — read TEXT only. Минимум.
 *   MEMBER      — default: TASK_CREATE + AI_USE + MESSAGE_PIN (own only —
 *                 backend hardcoded). Базовый participant.
 */
const ALL: Set<Permission> = new Set(PERMISSIONS);

const MATRIX: Record<MemberRole, Set<Permission>> = {
  OWNER: new Set(ALL),
  ADMIN: new Set(ALL),
  MODERATOR: new Set([
    "ROOM_VIEW_INTERNAL",
    "MESSAGE_PIN",
    "MESSAGE_DELETE_OTHERS",
    "MESSAGE_POST_BROADCAST",
    "TASK_CREATE",
    "TASK_ASSIGN",
    "TASK_APPROVE",
    "TASK_DELETE_OTHERS",
    "MEMBER_INVITE",
    "AI_USE",
    "ANALYTICS_VIEW",
  ]),
  ARCHITECT: new Set([
    "ROOM_VIEW_INTERNAL",
    "ROOM_EDIT",
    "MESSAGE_PIN",
    "TASK_CREATE",
    "TASK_ASSIGN",
    "TASK_APPROVE",
    "AI_USE",
    "ANALYTICS_VIEW",
  ]),
  DEVELOPER: new Set([
    "ROOM_VIEW_INTERNAL",
    "ROOM_CREATE",
    "MESSAGE_PIN",
    "TASK_CREATE",
    "TASK_ASSIGN",
    "AI_USE",
    "ANALYTICS_VIEW",
  ]),
  OPERATOR: new Set([
    "ROOM_VIEW_INTERNAL",
    "MESSAGE_PIN",
    "MESSAGE_DELETE_OTHERS",
    "TASK_CREATE",
    "TASK_ASSIGN",
    "TASK_APPROVE",
    "TASK_DELETE_OTHERS",
    "MEMBER_INVITE",
    "AI_USE",
    "ANALYTICS_VIEW",
  ]),
  CLIENT: new Set(["TASK_CREATE", "AI_USE"]),
  VIEWER: new Set(["ROOM_VIEW_INTERNAL", "AI_USE", "ANALYTICS_VIEW"]),
  GUEST: new Set(["AI_USE"]),
  MEMBER: new Set(["TASK_CREATE", "AI_USE", "MESSAGE_PIN"]),
};

export function hasPermission(role: MemberRole, perm: Permission): boolean {
  return MATRIX[role]?.has(perm) ?? false;
}

/** v0.78: list permissions для роли — для UI matrix viewer. */
export function permissionsForRole(role: MemberRole): Permission[] {
  const set = MATRIX[role];
  return set ? PERMISSIONS.filter((p) => set.has(p)) : [];
}

/**
 * Backward-compat helper: «is moderator-level или выше». Используется в
 * существующих route handlers где раньше было
 *   if (role === "OWNER" || role === "ADMIN" || role === "MODERATOR")
 * Теперь — `if (isModOrHigher(role))`. Включает новые operational роли
 * с moderation permissions.
 */
export function isModOrHigher(role: MemberRole): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "MODERATOR" ||
    role === "OPERATOR"
  );
}
