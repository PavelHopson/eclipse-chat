import { describe, expect, it } from "vitest";
import {
  createActionBody,
  defaultActionPriority,
  deriveActionTitle,
  validateActionCreationAccess,
  validateActionDueAt,
} from "../src/lib/actionCreate.js";

describe("message action creation policy", () => {
  it("allows creators but protects assignment with TASK_ASSIGN", () => {
    expect(validateActionCreationAccess("MEMBER", null)).toEqual({ ok: true });
    expect(validateActionCreationAccess("CLIENT", "user-2")).toEqual({
      ok: false,
      error: "You do not have permission to assign action items",
    });
    expect(validateActionCreationAccess("VIEWER", null)).toEqual({
      ok: false,
      error: "You do not have permission to create action items",
    });
    expect(validateActionCreationAccess("OPERATOR", "user-2")).toEqual({ ok: true });
  });

  it("accepts a bounded reviewed draft and rejects hidden fields", () => {
    expect(
      createActionBody.safeParse({
        type: "TASK",
        title: "Подготовить релиз",
        description: "Проверить build и smoke test",
        priority: "HIGH",
        assigneeUserId: "user-2",
        dueAt: "2026-08-04T10:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      createActionBody.safeParse({ type: "TASK", title: "Релиз", serverId: "other" }).success,
    ).toBe(false);
    expect(createActionBody.safeParse({ type: "RISK", title: "Проверить лимит API" }).success).toBe(true);
    expect(
      createActionBody.safeParse({ type: "REQUIREMENT", title: "Хранить аудит 90 дней" }).success,
    ).toBe(true);
  });

  it("bounds due dates and keeps a small clock-skew allowance", () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    expect(validateActionDueAt("2026-08-03T11:58:00.000Z", now).ok).toBe(true);
    expect(validateActionDueAt("2026-08-03T11:00:00.000Z", now)).toEqual({
      ok: false,
      error: "Due date must be in the future",
    });
    expect(validateActionDueAt("2040-08-03T12:00:00.000Z", now)).toEqual({
      ok: false,
      error: "Due date is too far in the future",
    });
  });

  it("makes risks high priority by default without escalating other types", () => {
    expect(defaultActionPriority("RISK")).toBe("HIGH");
    expect(defaultActionPriority("REQUIREMENT")).toBe("NORMAL");
    expect(defaultActionPriority("TASK")).toBe("NORMAL");
  });

  it("derives a compact title without trusting markup layout", () => {
    expect(deriveActionTitle("TASK", "  Проверить\n\nсборку  ")).toBe("Проверить сборку");
    expect(deriveActionTitle("FOLLOW_UP", "")).toBe("Follow-up captured from message");
    expect(deriveActionTitle("RISK", "")).toBe("Risk captured from message");
    expect(deriveActionTitle("REQUIREMENT", "")).toBe("Requirement captured from message");
  });
});
