import type { ActionItemType } from "@prisma/client";

export const PERSONAL_DIGEST_FIRST_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PERSONAL_DIGEST_MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type DigestImportance = "CRITICAL" | "HIGH" | "NORMAL";

export type DigestActionInput = {
  type: ActionItemType;
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt: Date | null;
  escalatedAt: Date | null;
  approvalStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  approverUserId: string | null;
  assigneeUserId: string | null;
};

export function resolvePersonalDigestSince(
  acknowledgedAt: Date | null,
  userCreatedAt: Date,
  now = new Date(),
): { since: Date; initialized: boolean; truncated: boolean } {
  const maxWindowStart = new Date(now.getTime() - PERSONAL_DIGEST_MAX_WINDOW_MS);
  if (acknowledgedAt) {
    return {
      since: acknowledgedAt < maxWindowStart ? maxWindowStart : acknowledgedAt,
      initialized: true,
      truncated: acknowledgedAt < maxWindowStart,
    };
  }

  const firstWindowStart = new Date(now.getTime() - PERSONAL_DIGEST_FIRST_WINDOW_MS);
  return {
    since: userCreatedAt > firstWindowStart ? userCreatedAt : firstWindowStart,
    initialized: false,
    truncated: false,
  };
}

export function classifyDigestAction(
  action: DigestActionInput,
  userId: string,
  now = new Date(),
): DigestImportance {
  if (
    action.approvalStatus === "PENDING" &&
    action.approverUserId === userId
  ) {
    return "CRITICAL";
  }
  if (
    action.escalatedAt ||
    action.priority === "URGENT" ||
    (action.status !== "DONE" && action.dueAt != null && action.dueAt < now)
  ) {
    return "CRITICAL";
  }
  if (
    action.priority === "HIGH" ||
    action.type === "DECISION" ||
    action.type === "RISK" ||
    (action.status !== "DONE" && action.assigneeUserId === userId)
  ) {
    return "HIGH";
  }
  return "NORMAL";
}

export function digestImportanceRank(importance: DigestImportance): number {
  if (importance === "CRITICAL") return 0;
  if (importance === "HIGH") return 1;
  return 2;
}

export function personalDigestExcerpt(value: string, limit = 180): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function monotonicDigestCursor(
  current: Date | null,
  requested: Date,
  now = new Date(),
): Date | null {
  if (requested > now) return null;
  if (current && current > requested) return current;
  return requested;
}
