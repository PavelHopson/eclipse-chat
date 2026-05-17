/**
 * Унифицированная сериализация User для frontend (v0.63 cascade policy B).
 *
 * После того как Message.userId / ActionItemComment.userId стали nullable
 * + SetNull, любая выборка с `include: { user: ... }` возвращает `user`
 * как `User | null`. Frontend исторически не ожидает null — там везде
 * `m.user.displayName` / `m.user.avatar` напрямую.
 *
 * Решение: backend serializer ВСЕГДА отдаёт стабильную shape — для
 * удалённых юзеров возвращаем placeholder с фиксированным id и именем
 * «Удалённый пользователь». Frontend не трогаем. Это standard chat-app
 * паттерн (Slack/Discord-style preservation).
 *
 * Дополнительный бонус: централизованная логика «is bot?» — раньше она
 * inline дублировалась в 8+ местах серверного кода.
 */

import type { BotRoleValue } from "../ai/botRoles.js";
import { BOT_ROLES } from "../ai/botRoles.js";

const DELETED_USER_ID = "__deleted__";
const DELETED_USER_NAME = "Удалённый пользователь";
const SYSTEM_AI_BOT_EMAIL = "system@eclipse-chat.local";

/**
 * Input shape — то, что приходит из Prisma `select: { id, displayName,
 * avatar, botProfile, email }` (email опционально, нужен для system AI bot).
 */
export type RawUserView = {
  id: string;
  displayName: string;
  avatar: string | null;
  email?: string | null;
  botProfile?: { id: string; role: string } | null;
} | null;

export interface UserView {
  id: string;
  displayName: string;
  avatar: string | null;
  isBot: boolean;
  /// Bot role enum value, либо null для не-ботов. Narrowed на runtime
  /// против BOT_ROLES whitelist — unknown role'и сваливаются в null.
  botRole: BotRoleValue | null;
}

function asBotRole(value: string | null | undefined): BotRoleValue | null {
  if (!value) return null;
  return (BOT_ROLES as readonly string[]).includes(value)
    ? (value as BotRoleValue)
    : null;
}

/**
 * Конвертирует raw user (с Prisma include) в UserView для API response.
 * null → placeholder для удалённого юзера.
 */
export function serializeUser(u: RawUserView): UserView {
  if (!u) {
    return {
      id: DELETED_USER_ID,
      displayName: DELETED_USER_NAME,
      avatar: null,
      isBot: false,
      botRole: null,
    };
  }
  const isBot = u.botProfile != null || u.email === SYSTEM_AI_BOT_EMAIL;
  return {
    id: u.id,
    displayName: u.displayName,
    avatar: u.avatar,
    isBot,
    botRole: asBotRole(u.botProfile?.role),
  };
}

/**
 * Безопасное displayName для internal usage (например, в AI prompt
 * context, в email notifications). Не путать с serializeUser() —
 * это для server-side use, не для API response.
 */
export function userDisplayName(u: { displayName: string } | null | undefined): string {
  return u?.displayName ?? DELETED_USER_NAME;
}
