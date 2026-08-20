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
  { id: "workspace.status", label: "Статус workspace", description: "Показать безопасные границы текущего пространства.", effect: "read-only" },
  { id: "memory.preview", label: "Preview Markdown memory", description: "Подготовить preview без записи в память.", effect: "read-only" },
  { id: "skills.status", label: "Статус навыков", description: "Показать allowlist и причины блокировки.", effect: "read-only" },
];

export function buildVoiceOpsPlan(command: string, skillId: VoiceOpsSkillId): VoiceOpsPlan {
  const normalized = command.trim().replace(/\s+/g, " ").slice(0, 500);
  return {
    command: normalized || "Показать безопасный статус workspace",
    skillId,
    steps: ["Проверить fixed allowlist", "Собрать локальный read-only результат", "Сформировать receipt без отправки в Sentinel"],
    diff: ["Файлы и Markdown memory: без изменений", "Shell, сеть и provider API: не используются", "Sentinel bridge: disconnected, команда остаётся в браузере"],
  };
}

export function executeVoiceOpsPlan(plan: VoiceOpsPlan, workspaceName: string): VoiceOpsReceipt {
  if (plan.skillId === "memory.preview") {
    return {
      title: "Markdown preview готов",
      lines: [`# ${workspaceName} voice note`, `- Command: ${plan.command}`, "- Persistence: blocked"],
    };
  }
  if (plan.skillId === "skills.status") {
    return {
      title: "Allowlist проверен",
      lines: [`Allowed: ${VOICE_OPS_SKILLS.map((skill) => skill.id).join(", ")}`, "Blocked: shell, writes, installs, deploy, secrets"],
    };
  }
  return {
    title: "Workspace проверен",
    lines: [`Workspace: ${workspaceName}`, "Execution: local read-only", "Sentinel bridge: disconnected", "Voice I/O: not attested"],
  };
}
