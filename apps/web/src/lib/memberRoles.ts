/**
 * v0.78 #17 phase 1 — frontend mirror of server's lib/permissions.ts.
 *
 * Источник истины — backend MATRIX. Здесь дублируем для UI рендера матрицы
 * без отдельного fetch endpoint. Sync при изменении — manual (PR review).
 *
 * Если на backend меняется matrix — этот файл должен сменяться в том же
 * коммите (test guard будет добавлен в phase 2).
 */

import type { MemberRole } from "../hooks/useMembers";

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

export const PERMISSION_LABELS_RU: Record<Permission, string> = {
  ROOM_CREATE: "Создание комнат",
  ROOM_DELETE: "Удаление комнат",
  ROOM_EDIT: "Редактирование комнат",
  ROOM_VIEW_INTERNAL: "Видеть internal",
  MESSAGE_PIN: "Закрепление",
  MESSAGE_DELETE_OTHERS: "Удалять чужие",
  MESSAGE_POST_BROADCAST: "Постить в канал-вещание",
  TASK_CREATE: "Создание задач",
  TASK_ASSIGN: "Назначение",
  TASK_APPROVE: "Одобрение",
  TASK_DELETE_OTHERS: "Удалять чужие задачи",
  MEMBER_INVITE: "Инвайты",
  MEMBER_KICK: "Кик",
  MEMBER_ROLE_CHANGE: "Смена ролей",
  BOT_CREATE: "Создание ботов",
  BOT_DELETE: "Удаление ботов",
  BOT_KEY_VIEW: "API-ключи ботов",
  ANALYTICS_VIEW: "Аналитика",
  AUDIT_LOG_VIEW: "Audit-log",
  AI_USE: "AI-mention",
};

export const PERMISSION_GROUPS: Array<{ name: string; perms: Permission[] }> = [
  {
    name: "Комнаты",
    perms: ["ROOM_CREATE", "ROOM_DELETE", "ROOM_EDIT", "ROOM_VIEW_INTERNAL"],
  },
  {
    name: "Сообщения",
    perms: ["MESSAGE_PIN", "MESSAGE_DELETE_OTHERS", "MESSAGE_POST_BROADCAST"],
  },
  {
    name: "Задачи",
    perms: ["TASK_CREATE", "TASK_ASSIGN", "TASK_APPROVE", "TASK_DELETE_OTHERS"],
  },
  {
    name: "Участники",
    perms: ["MEMBER_INVITE", "MEMBER_KICK", "MEMBER_ROLE_CHANGE"],
  },
  {
    name: "Боты + AI",
    perms: ["BOT_CREATE", "BOT_DELETE", "BOT_KEY_VIEW", "AI_USE"],
  },
  {
    name: "Аналитика",
    perms: ["ANALYTICS_VIEW", "AUDIT_LOG_VIEW"],
  },
];

export const ROLE_ORDER: readonly MemberRole[] = [
  "OWNER",
  "ADMIN",
  "MODERATOR",
  "ARCHITECT",
  "DEVELOPER",
  "OPERATOR",
  "CLIENT",
  "VIEWER",
  "GUEST",
  "MEMBER",
] as const;

export const ROLE_LABELS_RU: Record<MemberRole, string> = {
  OWNER: "Владелец",
  ADMIN: "Админ",
  MODERATOR: "Модератор",
  ARCHITECT: "Архитектор",
  DEVELOPER: "Разработчик",
  OPERATOR: "Оператор",
  CLIENT: "Клиент",
  VIEWER: "Наблюдатель",
  GUEST: "Гость",
  MEMBER: "Участник",
};

export const ROLE_DESCRIPTIONS_RU: Record<MemberRole, string> = {
  OWNER: "Полный контроль. Может передать владение, удалить пространство.",
  ADMIN: "Управление настройками, ролями (кроме OWNER), участниками, ботами.",
  MODERATOR: "Модерация сообщений, закрепления, инвайты, удаление чужих.",
  ARCHITECT: "Редактирование комнат, одобрение решений. Без member-mgmt.",
  DEVELOPER: "Создание комнат + задач. Engineer-flow.",
  OPERATOR: "Triage задач, dispatch, moderation. Operational lead.",
  CLIENT: "Внешний клиент в CLIENT-mode. Чат + AI, без internal каналов.",
  VIEWER: "Read-only + аналитика. Reviewer / stakeholder.",
  GUEST: "Минимум: чтение TEXT + AI-mention. Для коротких визитов.",
  MEMBER: "Базовый участник. Чат, задачи, AI-mention.",
};

type RoleTone = { fg: string; bg: string; border: string };

export const ROLE_TONES: Record<MemberRole, RoleTone> = {
  OWNER: {
    fg: "hsl(38 95% 70%)",
    bg: "hsl(38 90% 60% / 0.14)",
    border: "hsl(38 90% 55% / 0.45)",
  },
  ADMIN: {
    fg: "hsl(195 85% 70%)",
    bg: "hsl(195 75% 60% / 0.14)",
    border: "hsl(195 75% 55% / 0.45)",
  },
  MODERATOR: {
    fg: "hsl(280 75% 75%)",
    bg: "hsl(280 65% 60% / 0.14)",
    border: "hsl(280 65% 55% / 0.45)",
  },
  ARCHITECT: {
    fg: "hsl(180 75% 65%)",
    bg: "hsl(180 55% 50% / 0.14)",
    border: "hsl(180 55% 45% / 0.45)",
  },
  DEVELOPER: {
    fg: "hsl(160 70% 65%)",
    bg: "hsl(160 60% 55% / 0.14)",
    border: "hsl(160 60% 50% / 0.45)",
  },
  OPERATOR: {
    fg: "hsl(20 85% 70%)",
    bg: "hsl(20 75% 60% / 0.14)",
    border: "hsl(20 75% 55% / 0.45)",
  },
  CLIENT: {
    fg: "hsl(215 85% 75%)",
    bg: "hsl(215 70% 65% / 0.14)",
    border: "hsl(215 70% 60% / 0.45)",
  },
  VIEWER: {
    fg: "hsl(0 0% 75%)",
    bg: "hsl(0 0% 30% / 0.16)",
    border: "hsl(0 0% 50% / 0.4)",
  },
  GUEST: {
    fg: "hsl(0 0% 65%)",
    bg: "hsl(0 0% 25% / 0.16)",
    border: "hsl(0 0% 40% / 0.35)",
  },
  MEMBER: {
    fg: "var(--ec-text-muted)",
    bg: "var(--ec-surface-2)",
    border: "var(--ec-border-subtle)",
  },
};

const ROLE_PERMISSIONS: Record<MemberRole, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>(PERMISSIONS),
  ADMIN: new Set<Permission>(PERMISSIONS),
  MODERATOR: new Set<Permission>([
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
  ARCHITECT: new Set<Permission>([
    "ROOM_VIEW_INTERNAL",
    "ROOM_EDIT",
    "MESSAGE_PIN",
    "TASK_CREATE",
    "TASK_ASSIGN",
    "TASK_APPROVE",
    "AI_USE",
    "ANALYTICS_VIEW",
  ]),
  DEVELOPER: new Set<Permission>([
    "ROOM_VIEW_INTERNAL",
    "ROOM_CREATE",
    "MESSAGE_PIN",
    "TASK_CREATE",
    "TASK_ASSIGN",
    "AI_USE",
    "ANALYTICS_VIEW",
  ]),
  OPERATOR: new Set<Permission>([
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
  CLIENT: new Set<Permission>(["TASK_CREATE", "AI_USE"]),
  VIEWER: new Set<Permission>(["ROOM_VIEW_INTERNAL", "AI_USE", "ANALYTICS_VIEW"]),
  GUEST: new Set<Permission>(["AI_USE"]),
  MEMBER: new Set<Permission>(["TASK_CREATE", "AI_USE", "MESSAGE_PIN"]),
};

export function hasPermission(role: MemberRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(perm) ?? false;
}
