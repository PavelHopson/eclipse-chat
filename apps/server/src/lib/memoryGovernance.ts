import { hasPermission } from "./permissions.js";
import type { MemberRole } from "../routes/servers.js";

export type MemoryLifecycleStatus = "ACTIVE" | "REVIEW_DUE" | "EXPIRED" | "ARCHIVED";
export type MemoryVisibilityValue = "ROOM" | "WORKSPACE";

export type MemoryLifecycleInput = {
  visibility: MemoryVisibilityValue;
  archivedAt: Date | null;
  reviewDueAt: Date | null;
  expiresAt: Date | null;
};

export function getMemoryLifecycle(
  entry: MemoryLifecycleInput,
  now = new Date(),
): {
  status: MemoryLifecycleStatus;
  contextEligible: boolean;
  contextReason: string;
} {
  if (entry.archivedAt) {
    return {
      status: "ARCHIVED",
      contextEligible: false,
      contextReason: "Запись находится в архиве и не передаётся AI.",
    };
  }
  if (entry.expiresAt && entry.expiresAt <= now) {
    return {
      status: "EXPIRED",
      contextEligible: false,
      contextReason: "Срок актуальности истёк. Подтвердите или обновите запись.",
    };
  }
  if (entry.reviewDueAt && entry.reviewDueAt <= now) {
    return {
      status: "REVIEW_DUE",
      contextEligible: false,
      contextReason: "Запись ожидает проверки владельцем и временно исключена из AI-контекста.",
    };
  }
  return {
    status: "ACTIVE",
    contextEligible: true,
    contextReason:
      entry.visibility === "WORKSPACE"
        ? "Проверенная запись доступна AI во всех открытых комнатах пространства."
        : "Проверенная запись доступна AI только в этой комнате.",
  };
}

export function canManageMemoryEntry(
  userId: string,
  role: MemberRole,
  entry: { ownerUserId: string | null; createdByUserId: string | null },
): boolean {
  return (
    entry.ownerUserId === userId ||
    entry.createdByUserId === userId ||
    hasPermission(role, "MEMORY_MANAGE")
  );
}

export function memoryContextEligibilityWhere(now = new Date()) {
  return {
    archivedAt: null,
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ reviewDueAt: null }, { reviewDueAt: { gt: now } }] },
    ],
  };
}
