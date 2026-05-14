/**
 * AI prompts для Eclipse Chat.
 *
 * Все промпты на русском, поскольку product RU-first.
 * Структурированные digest/assistant snapshots сериализуются в plain text
 * перед скармливанием LLM — это и лучше для context (LLM лучше читает структуру)
 * и кэшируется провайдерами (одинаковые prefixes).
 */

type ActionForPrompt = {
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  title: string;
  dueAt: string | null;
  assignee: { displayName: string } | null;
  status: "OPEN" | "DONE";
};

type PinnedForPrompt = {
  content: string;
  user: { displayName: string };
};

type DigestSnapshot = {
  channelName: string;
  windowDays: number;
  openActions: {
    total: number;
    overdue: ActionForPrompt[];
    dueToday: ActionForPrompt[];
    dueTomorrow: ActionForPrompt[];
    unassigned: ActionForPrompt[];
  };
  decisions: ActionForPrompt[];
  followUps: ActionForPrompt[];
  pinned: PinnedForPrompt[];
  stats: { messages: number; uniqueAuthors: number };
};

function formatActionLine(a: ActionForPrompt, idx: number): string {
  const due = a.dueAt
    ? new Date(a.dueAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    : "";
  const owner = a.assignee?.displayName ?? "без ответственного";
  return `  ${idx + 1}. ${a.title} — ${owner}${due ? `, до ${due}` : ""}`;
}

export function digestSummaryPrompt(d: DigestSnapshot): {
  system: string;
  user: string;
} {
  const lines: string[] = [];
  lines.push(`Канал: ${d.channelName}`);
  lines.push(`Период: последние ${d.windowDays} дней`);
  lines.push(`Активность: ${d.stats.messages} сообщений, ${d.stats.uniqueAuthors} участников`);
  lines.push("");
  lines.push(`Всего открытых пунктов: ${d.openActions.total}`);

  if (d.openActions.overdue.length > 0) {
    lines.push("");
    lines.push("Просрочено:");
    d.openActions.overdue.slice(0, 8).forEach((a, i) => lines.push(formatActionLine(a, i)));
  }
  if (d.openActions.dueToday.length > 0) {
    lines.push("");
    lines.push("Сегодня:");
    d.openActions.dueToday.slice(0, 8).forEach((a, i) => lines.push(formatActionLine(a, i)));
  }
  if (d.openActions.dueTomorrow.length > 0) {
    lines.push("");
    lines.push("Завтра:");
    d.openActions.dueTomorrow.slice(0, 5).forEach((a, i) => lines.push(formatActionLine(a, i)));
  }
  if (d.openActions.unassigned.length > 0) {
    lines.push("");
    lines.push("Без ответственного:");
    d.openActions.unassigned.slice(0, 5).forEach((a, i) => lines.push(formatActionLine(a, i)));
  }
  if (d.decisions.length > 0) {
    lines.push("");
    lines.push(`Недавние решения (${d.decisions.length}):`);
    d.decisions.slice(0, 6).forEach((a, i) => lines.push(formatActionLine(a, i)));
  }
  if (d.followUps.length > 0) {
    lines.push("");
    lines.push(`Follow-up (${d.followUps.length}):`);
    d.followUps.slice(0, 6).forEach((a, i) => lines.push(formatActionLine(a, i)));
  }
  if (d.pinned.length > 0) {
    lines.push("");
    lines.push("Закреплённые сообщения:");
    d.pinned.slice(0, 5).forEach((p, i) => {
      const c = p.content.replace(/\s+/g, " ").trim().slice(0, 140);
      lines.push(`  ${i + 1}. (${p.user.displayName}) ${c}`);
    });
  }

  return {
    system:
      "Ты — операционный ассистент Eclipse Chat. Твоя задача — сформулировать компактное " +
      "человеческое резюме статуса канала на русском в 3-5 предложениях. Фокус на том, что " +
      "требует внимания сейчас: просрочки, срочные задачи, важные решения. Не повторяй цифры " +
      "буквально, объясняй смысл. Без эмодзи. Без markdown. Без воды.",
    user:
      "Снимок канала:\n\n" +
      lines.join("\n") +
      "\n\nКраткое резюме (3-5 предложений):",
  };
}

type MessageForPrompt = {
  displayName: string;
  content: string;
  createdAt: string;
};

type AssistantContext = {
  channelName: string;
  /** Текст обращения после удаления @ai. */
  userQuery: string;
  /** Кто спросил. */
  userDisplayName: string;
  /** Последние ~20 сообщений канала, oldest first. */
  recentMessages: MessageForPrompt[];
  /** Текущие открытые actions. */
  openActions: ActionForPrompt[];
  /** Закреплённое — fixture канала. */
  pinned: PinnedForPrompt[];
};

type IncidentPostMortemContext = {
  title: string;
  openedAt: string;
  resolvedAt: string;
  openedByName: string;
  /** Все decisions из incident-канала. */
  decisions: ActionForPrompt[];
  /** Все tasks/follow-ups из incident-канала. */
  actionItems: ActionForPrompt[];
  /** Закреплённые сообщения — ключевые факты. */
  pinned: PinnedForPrompt[];
  /** Сообщения incident-канала, oldest first (до ~40). */
  messages: MessageForPrompt[];
};

/**
 * Post-mortem генерится при resolve инцидента. Собирает timeline
 * incident-канала (decisions + actions + pinned + messages) → структурированный
 * markdown-разбор. В отличие от digest/assistant — здесь markdown РАЗРЕШЁН
 * (post-mortem рендерится как RichContent в IncidentPanel).
 */
export function incidentPostMortemPrompt(c: IncidentPostMortemContext): {
  system: string;
  user: string;
} {
  const openedMs = new Date(c.openedAt).getTime();
  const resolvedMs = new Date(c.resolvedAt).getTime();
  const durationMin = Math.max(1, Math.round((resolvedMs - openedMs) / 60_000));
  const durationLabel =
    durationMin < 60
      ? `${durationMin} мин`
      : `${Math.floor(durationMin / 60)} ч ${durationMin % 60} мин`;

  const lines: string[] = [];
  lines.push(`Инцидент: ${c.title}`);
  lines.push(`Открыл: ${c.openedByName}`);
  lines.push(`Длительность: ${durationLabel}`);
  lines.push("");

  if (c.decisions.length > 0) {
    lines.push("Принятые решения:");
    c.decisions.slice(0, 12).forEach((a, i) => lines.push(formatActionLine(a, i)));
    lines.push("");
  }
  if (c.actionItems.length > 0) {
    lines.push("Задачи и follow-up:");
    c.actionItems.slice(0, 16).forEach((a, i) => lines.push(formatActionLine(a, i)));
    lines.push("");
  }
  if (c.pinned.length > 0) {
    lines.push("Закреплённые факты:");
    c.pinned.slice(0, 8).forEach((p, i) => {
      const cont = p.content.replace(/\s+/g, " ").trim().slice(0, 200);
      lines.push(`  ${i + 1}. (${p.user.displayName}) ${cont}`);
    });
    lines.push("");
  }
  if (c.messages.length > 0) {
    lines.push("Хронология обсуждения (старые → новые):");
    for (const m of c.messages.slice(-40)) {
      const time = new Date(m.createdAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const text = m.content.replace(/\s+/g, " ").trim().slice(0, 240);
      if (text) lines.push(`  [${time}] ${m.displayName}: ${text}`);
    }
  }

  return {
    system:
      "Ты — операционный аналитик Eclipse Chat. По данным incident-канала " +
      "составь компактный post-mortem на русском в markdown. Структура строго:\n" +
      "## Что произошло\n(2-4 предложения — суть инцидента)\n" +
      "## Хронология\n(маркированный список ключевых моментов с временем)\n" +
      "## Принятые решения\n(маркированный список — что решили)\n" +
      "## Action items\n(маркированный список незакрытых задач — что доделать)\n" +
      "## Выводы\n(1-3 предложения — что улучшить чтобы не повторилось)\n\n" +
      "Будь конкретным, опирайся только на данные. Если раздел пустой — напиши " +
      "«—». Без воды, без эмодзи. Markdown заголовки и списки — обязательны.",
    user:
      "Данные инцидента:\n\n" + lines.join("\n") + "\n\nPost-mortem (markdown):",
  };
}

export function assistantPrompt(c: AssistantContext): {
  system: string;
  user: string;
} {
  const lines: string[] = [];
  lines.push(`Канал: #${c.channelName}`);
  lines.push("");
  if (c.openActions.length > 0) {
    lines.push("Открытые пункты в канале:");
    c.openActions.slice(0, 12).forEach((a, i) => lines.push(formatActionLine(a, i)));
    lines.push("");
  }
  if (c.pinned.length > 0) {
    lines.push("Закреплённое:");
    c.pinned.slice(0, 4).forEach((p, i) => {
      const cont = p.content.replace(/\s+/g, " ").trim().slice(0, 200);
      lines.push(`  ${i + 1}. (${p.user.displayName}) ${cont}`);
    });
    lines.push("");
  }
  if (c.recentMessages.length > 0) {
    lines.push("Последние сообщения канала (старые → новые):");
    for (const m of c.recentMessages.slice(-20)) {
      const time = new Date(m.createdAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const text = m.content.replace(/\s+/g, " ").trim().slice(0, 280);
      lines.push(`  [${time}] ${m.displayName}: ${text}`);
    }
    lines.push("");
  }
  lines.push(`${c.userDisplayName} @ai: ${c.userQuery.trim()}`);

  return {
    system:
      "Ты — Eclipse Chat AI Assistant, ассистент внутри корпоративного чата. " +
      "Тебя упомянули в канале (@ai). Отвечай кратко, по-делу, на русском, " +
      "одним абзацем 2-5 предложений. Если просят что-то сделать (создать задачу, " +
      "найти инфо, объяснить решение) — отвечай в формате «вот контекст: ...». " +
      "Если не хватает информации в канале — честно скажи «не знаю» вместо галлюцинаций. " +
      "Без эмодзи. Без markdown-форматирования (это будет в plain-text сообщении).",
    user: lines.join("\n"),
  };
}
