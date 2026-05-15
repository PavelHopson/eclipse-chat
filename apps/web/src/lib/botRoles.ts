/**
 * Bot role taxonomy — frontend mirror of apps/server/src/ai/botRoles.ts.
 * Держим источник в обоих местах, потому что нет shared package'а (избегаем
 * новой инфры в monorepo'е). При изменении enum — синхронизировать оба файла
 * вручную + миграцию в schema.prisma.
 */
export type BotRole = "GENERIC" | "MODERATOR" | "PM" | "KNOWLEDGE" | "SALES";

export const BOT_ROLES: readonly BotRole[] = [
  "GENERIC",
  "MODERATOR",
  "PM",
  "KNOWLEDGE",
  "SALES",
] as const;

/** Короткий RU-лейбл (chip-badge). */
export const BOT_ROLE_LABELS: Record<BotRole, string> = {
  GENERIC: "Бот",
  MODERATOR: "Модератор",
  PM: "Менеджер",
  KNOWLEDGE: "База знаний",
  SALES: "Продажи",
};

/** Однострочное описание роли — для help-text'а в селекторе при создании. */
export const BOT_ROLE_DESCRIPTIONS: Record<BotRole, string> = {
  GENERIC: "Универсальный бот. Telegram-мосты, мониторинг, инструменты.",
  MODERATOR: "Следит за этикетом и помогает модераторам канала.",
  PM: "Отслеживает задачи, решения, follow-up. Напоминает о сроках.",
  KNOWLEDGE: "Отвечает на вопросы по контексту сервера.",
  SALES: "Sales-ассистент: клиентские диалоги, мягкий тон.",
};

/**
 * Цветовая семантика per-role — берётся из semantic status palette
 * Eclipse Chat. Не вводим новые токены, переиспользуем существующие.
 *
 * Формат: HSL-tuple (string) — для composing background / border / text
 * с разной opacity без переопределения hue/sat.
 */
type RoleColor = {
  /** HSL без `hsl()` wrapper, для composing с opacity */
  hsl: string;
  /** Готовая обёртка с дефолтной opacity */
  fg: string;
  bg: string;
  border: string;
};

export const BOT_ROLE_COLORS: Record<BotRole, RoleColor> = {
  GENERIC: {
    hsl: "252 70% 70%",
    fg: "hsl(252 80% 78%)",
    bg: "hsl(252 70% 70% / 0.14)",
    border: "hsl(252 70% 60% / 0.45)",
  },
  MODERATOR: {
    // amber/warn — авторитетный, но не агрессивный
    hsl: "38 90% 60%",
    fg: "hsl(38 95% 70%)",
    bg: "hsl(38 90% 60% / 0.14)",
    border: "hsl(38 90% 55% / 0.45)",
  },
  PM: {
    // cyan/exec — operational
    hsl: "195 75% 60%",
    fg: "hsl(195 85% 70%)",
    bg: "hsl(195 75% 60% / 0.14)",
    border: "hsl(195 75% 55% / 0.45)",
  },
  KNOWLEDGE: {
    // sky/idle — спокойный, исследовательский
    hsl: "215 70% 65%",
    fg: "hsl(215 85% 75%)",
    bg: "hsl(215 70% 65% / 0.14)",
    border: "hsl(215 70% 60% / 0.45)",
  },
  SALES: {
    // mint/ok — тёплый, дружелюбный
    hsl: "160 60% 55%",
    fg: "hsl(160 70% 65%)",
    bg: "hsl(160 60% 55% / 0.14)",
    border: "hsl(160 60% 50% / 0.45)",
  },
};

export function isBotRole(v: unknown): v is BotRole {
  return typeof v === "string" && (BOT_ROLES as readonly string[]).includes(v);
}
