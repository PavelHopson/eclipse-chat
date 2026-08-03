import { z } from "zod";
import { hasPermission } from "./permissions.js";

export const actionTypeSchema = z.enum([
  "TASK",
  "DECISION",
  "FOLLOW_UP",
  "RISK",
  "REQUIREMENT",
]);
export const actionPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
export type ActionItemTypeValue = z.infer<typeof actionTypeSchema>;

export function defaultActionPriority(
  type: ActionItemTypeValue,
): z.infer<typeof actionPrioritySchema> {
  return type === "RISK" ? "HIGH" : "NORMAL";
}

export const createActionBody = z
  .object({
    type: actionTypeSchema,
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    priority: actionPrioritySchema.optional(),
    assigneeUserId: z.string().trim().min(1).max(191).nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .strict();

type MemberRole = Parameters<typeof hasPermission>[0];

export function validateActionCreationAccess(
  role: MemberRole,
  assigneeUserId: string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!hasPermission(role, "TASK_CREATE")) {
    return { ok: false, error: "You do not have permission to create action items" };
  }
  if (assigneeUserId && !hasPermission(role, "TASK_ASSIGN")) {
    return { ok: false, error: "You do not have permission to assign action items" };
  }
  return { ok: true };
}

export function validateActionDueAt(
  value: string | null | undefined,
  nowMs = Date.now(),
): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (!value) return { ok: true, value: null };

  const dueAt = new Date(value);
  const dueMs = dueAt.getTime();
  if (!Number.isFinite(dueMs)) {
    return { ok: false, error: "Invalid due date" };
  }
  if (dueMs < nowMs - 5 * 60 * 1000) {
    return { ok: false, error: "Due date must be in the future" };
  }
  if (dueMs > nowMs + 10 * 365 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Due date is too far in the future" };
  }
  return { ok: true, value: dueAt };
}

export function deriveActionTitle(
  type: ActionItemTypeValue,
  content: string,
): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length > 0) {
    return compact.slice(0, 160);
  }

  if (type === "DECISION") return "Decision captured from message";
  if (type === "FOLLOW_UP") return "Follow-up captured from message";
  if (type === "RISK") return "Risk captured from message";
  if (type === "REQUIREMENT") return "Requirement captured from message";
  return "Task captured from message";
}
