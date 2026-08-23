export type VoiceOpsSkillId = "workspace.status" | "memory.preview" | "skills.status";

export type VoiceOpsPlan = {
  command: string;
  skillId: VoiceOpsSkillId;
  steps: readonly string[];
  diff: readonly string[];
};

export type VoiceOpsReceipt = {
  title: string;
  lines: readonly string[];
};

export const VOICE_OPS_SKILLS: ReadonlyArray<{
  id: VoiceOpsSkillId;
  label: string;
  description: string;
  effect: "read-only";
}> = [
  { id: "workspace.status", label: "Статус пространства", description: "Показать безопасные границы текущего пространства.", effect: "read-only" },
  { id: "memory.preview", label: "Предпросмотр Markdown-памяти", description: "Подготовить предпросмотр без записи в память.", effect: "read-only" },
  { id: "skills.status", label: "Статус навыков", description: "Показать разрешённый список и причины блокировки.", effect: "read-only" },
];

export function buildVoiceOpsPlan(command: string, skillId: VoiceOpsSkillId): VoiceOpsPlan {
  const normalized = command.trim().replace(/\s+/g, " ").slice(0, 500);
  return {
    command: normalized || "Показать безопасный статус пространства",
    skillId,
    steps: ["Проверить фиксированный список разрешений", "Собрать локальный результат только для чтения", "Сформировать квитанцию без отправки в Sentinel"],
    diff: ["Файлы и Markdown-память: без изменений", "Командная строка, сеть и API провайдера: не используются", "Мост Sentinel: не подключён, команда остаётся в браузере"],
  };
}

export function executeVoiceOpsPlan(plan: VoiceOpsPlan, workspaceName: string): VoiceOpsReceipt {
  if (plan.skillId === "memory.preview") {
    return {
      title: "Markdown preview готов",
      lines: [`# Голосовая заметка · ${workspaceName}`, `- Команда: ${plan.command}`, "- Сохранение: заблокировано"],
    };
  }
  if (plan.skillId === "skills.status") {
    return {
      title: "Список разрешений проверен",
      lines: [`Разрешено: ${VOICE_OPS_SKILLS.map((skill) => skill.id).join(", ")}`, "Заблокировано: командная строка, запись, установка, развёртывание, секреты"],
    };
  }
  return {
    title: "Пространство проверено",
    lines: [`Пространство: ${workspaceName}`, "Выполнение: локально, только чтение", "Мост Sentinel: не подключён", "Голосовой ввод и вывод: не аттестованы"],
  };
}
