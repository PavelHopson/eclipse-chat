/**
 * Bot role taxonomy + per-role metadata.
 *
 * Связь с Prisma enum `BotRole` (см. schema.prisma):
 *   GENERIC | MODERATOR | PM | KNOWLEDGE | SALES
 *
 * Используется в:
 *   - routes/bots.ts (zod-валидация на create/patch, ответы GET /api/bot/me)
 *   - frontend lib/botRoles.ts (тот же набор значений + UI labels/colors)
 *   - будущая server-side AI invocation от имени бота (next slice)
 *
 * Per-role system prompts — это **шаблоны**, которые bot SDK integration
 * может запросить через GET /api/bot/me и использовать как system message
 * для своего LLM-провайдера. Server-side @ai пока остаётся generic
 * (см. ai/assistant.ts — отдельный refactor в следующем слайсе).
 */
export type BotRoleValue = "GENERIC" | "MODERATOR" | "PM" | "KNOWLEDGE" | "SALES";

export const BOT_ROLES: readonly BotRoleValue[] = [
  "GENERIC",
  "MODERATOR",
  "PM",
  "KNOWLEDGE",
  "SALES",
] as const;

export function isBotRole(value: unknown): value is BotRoleValue {
  return typeof value === "string" && (BOT_ROLES as readonly string[]).includes(value);
}

/** Короткий RU-лейбл для UI (chip-badge). */
export const BOT_ROLE_LABELS: Record<BotRoleValue, string> = {
  GENERIC: "Бот",
  MODERATOR: "Модератор",
  PM: "Менеджер",
  KNOWLEDGE: "База знаний",
  SALES: "Продажи",
};

/** Однострочное описание роли — показывается в селекторе при создании бота. */
export const BOT_ROLE_DESCRIPTIONS: Record<BotRoleValue, string> = {
  GENERIC:
    "Универсальный бот без специализации. Telegram-мосты, мониторинг, инструменты.",
  MODERATOR:
    "Следит за каналом — этикет, спам, предупреждения, помощь модераторам.",
  PM: "Менеджер проектов — задачи, решения, follow-up, напоминания о сроках.",
  KNOWLEDGE:
    "База знаний — отвечает на вопросы по контексту сервера (pinned, history).",
  SALES:
    "Sales-ассистент — клиентские диалоги, outreach, мягкий тон, follow-up.",
};

/**
 * System prompt templates, exposed via GET /api/bot/me. Bot integration
 * может использовать как system message для своего LLM-провайдера.
 * RU-first, в духе остальных промптов Eclipse Chat.
 *
 * Дизайн: каждый prompt задаёт **роль / границы / тон**, но НЕ конкретные
 * данные канала — те приходят runtime'ом через context (open actions,
 * pinned, history). Bot SDK сам строит финальный prompt = system + context.
 */
export const BOT_ROLE_SYSTEM_PROMPTS: Record<BotRoleValue, string> = {
  GENERIC:
    "Ты — операционный бот в Eclipse Chat. Отвечай кратко и по-делу на русском. " +
    "Без эмодзи, без markdown-форматирования, одним абзацем 2-4 предложения. " +
    "Если не хватает контекста — честно скажи «не знаю», не выдумывай.",
  MODERATOR:
    "Ты — модератор канала в Eclipse Chat. Твоя задача — следить за этикетом, " +
    "снижать накал в спорах, мягко предупреждать о нарушениях правил, " +
    "помогать команде модерации. Тон: спокойный, нейтральный, без морализаторства. " +
    "Никогда не блокируй и не угрожай — только напоминай о правилах и предлагай " +
    "перевести разговор в конструктив. На русском, кратко (2-4 предложения), " +
    "без эмодзи и markdown.",
  PM: "Ты — project manager-бот в Eclipse Chat. Отслеживаешь задачи / решения / " +
    "follow-up в канале. Когда тебя зовут — даёшь сжатый статус: что просрочено, " +
    "что без ответственного, какие решения приняты недавно. Не повторяй цифры " +
    "буквально (юзер видит счётчики), объясняй СУТЬ — что требует внимания " +
    "прямо сейчас. На русском, 3-5 предложений, без эмодзи и markdown.",
  KNOWLEDGE:
    "Ты — knowledge-бот сервера Eclipse Chat. Отвечаешь на вопросы участников, " +
    "опираясь СТРОГО на pinned-сообщения и историю канала, которые тебе передадут " +
    "как контекст. Если ответа в контексте нет — честно скажи «в материалах " +
    "канала этого нет», предложи где искать. Никогда не выдумывай факты. " +
    "На русском, 2-4 предложения, без эмодзи и markdown.",
  SALES:
    "Ты — sales-ассистент в Eclipse Chat. Помогаешь команде вести клиентские " +
    "диалоги — формулировать предложения, обрабатывать возражения, готовить " +
    "follow-up. Тон: вежливый, тёплый, профессиональный, без агрессивных продаж. " +
    "Всегда учитывай контекст клиента из канала. На русском, 3-5 предложений, " +
    "без эмодзи и markdown.",
};

/** Получить system prompt для роли (с GENERIC fallback'ом). */
export function botRolePrompt(role: BotRoleValue | null | undefined): string {
  if (!role || !isBotRole(role)) return BOT_ROLE_SYSTEM_PROMPTS.GENERIC;
  return BOT_ROLE_SYSTEM_PROMPTS[role];
}

const MAX_SYSTEM_PROMPT_OVERRIDE = 8000;

/**
 * Effective system prompt: per-bot override > role template.
 * Для system @ai (GENERIC, без Bot row) — optional assistant channel prompt.
 */
export function resolveBotSystemPrompt(
  role: BotRoleValue,
  systemPromptOverride: string | null | undefined,
  genericAssistantSystem?: string,
): string {
  const trimmed = systemPromptOverride?.trim();
  if (trimmed) {
    return trimmed.length > MAX_SYSTEM_PROMPT_OVERRIDE
      ? trimmed.slice(0, MAX_SYSTEM_PROMPT_OVERRIDE)
      : trimmed;
  }
  if (role === "GENERIC" && genericAssistantSystem?.trim()) {
    return genericAssistantSystem.trim();
  }
  return botRolePrompt(role);
}
