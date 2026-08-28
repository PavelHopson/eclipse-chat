import type { CreateActionItemInput } from "../hooks/useMessages";
import type { ActionItemPriority, ActionItemType } from "./socket";
import type { EclipseUiIconName } from "../components/icons/EclipseUiIcon";

export const ACTION_KIND: Record<ActionItemType, { label: string; icon: EclipseUiIconName; cta: string }> = {
  TASK: { label: "Задача", icon: "task", cta: "Создать задачу" },
  DECISION: { label: "Решение", icon: "decision", cta: "Зафиксировать решение" },
  FOLLOW_UP: { label: "Контроль", icon: "followup", cta: "Поставить контроль" },
  RISK: { label: "Риск", icon: "risk", cta: "Зафиксировать риск" },
  REQUIREMENT: { label: "Требование", icon: "requirement", cta: "Добавить требование" },
};

export function actionDraftTitle(content: string): string {
  return content.replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

export function localActionDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function actionDuePreset(days: number, now = new Date()): string {
  const due = new Date(now);
  due.setDate(due.getDate() + days);
  due.setHours(days === 0 ? 18 : 10, 0, 0, 0);
  if (due.getTime() <= now.getTime() + 30 * 60_000) {
    due.setTime(now.getTime() + 2 * 60 * 60_000);
    due.setMinutes(0, 0, 0);
  }
  return localActionDate(due);
}

export type ActionDraft = {
  type: ActionItemType; title: string; description: string;
  priority: ActionItemPriority; assigneeUserId: string; dueAt: string;
};

export function prepareActionDraft(draft: ActionDraft, options: {
  canAssign: boolean; existingTypes: Iterable<ActionItemType>; now?: number;
}): { ok: true; input: CreateActionItemInput } | { ok: false; field: "title" | "dueAt" | "type" | "description"; error: string } {
  if (new Set(options.existingTypes).has(draft.type))
    return { ok: false, field: "type", error: "Такой объект уже связан с сообщением. Откройте его в переписке." };
  const title = draft.title.trim();
  if (!title || title.length > 160)
    return { ok: false, field: "title", error: "Укажите название — до 160 символов." };
  if (draft.description.trim().length > 4000)
    return { ok: false, field: "description", error: "Сократите описание до 4000 символов." };
  let dueAt: string | null = null;
  if (draft.dueAt && draft.type !== "DECISION") {
    const parsed = new Date(draft.dueAt);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() < (options.now ?? Date.now()) - 60_000)
      return { ok: false, field: "dueAt", error: "Выберите будущую дату или уберите срок." };
    dueAt = parsed.toISOString();
  }
  return { ok: true, input: {
    type: draft.type, title, description: draft.description.trim() || null,
    priority: draft.priority, dueAt,
    assigneeUserId: options.canAssign && draft.type !== "DECISION" && draft.assigneeUserId ? draft.assigneeUserId : null,
  } };
}
