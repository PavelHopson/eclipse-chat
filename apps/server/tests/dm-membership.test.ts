import { describe, expect, it } from "vitest";
import { isDmMember } from "../src/routes/dm.js";

/**
 * Pure юнит-тест для membership-helper. Полная route-проверка с реальной
 * БД делается отдельно через ephemeral PG (см. ROADMAP integration-tests
 * follow-up). Здесь — гарантия что unified логика корректно классифицирует
 * 1-to-1 vs group без false-positive/negative.
 */

describe("isDmMember", () => {
  it("returns true для userA в 1-to-1", () => {
    expect(
      isDmMember({ memberUserIds: ["user-A", "user-B"] }, "user-A"),
    ).toBe(true);
  });

  it("returns true для userB в 1-to-1", () => {
    expect(
      isDmMember({ memberUserIds: ["user-A", "user-B"] }, "user-B"),
    ).toBe(true);
  });

  it("returns false для outsider в 1-to-1", () => {
    expect(
      isDmMember({ memberUserIds: ["user-A", "user-B"] }, "user-C"),
    ).toBe(false);
  });

  it("returns true для участника group (создатель)", () => {
    expect(
      isDmMember({ memberUserIds: ["host", "u1", "u2", "u3"] }, "host"),
    ).toBe(true);
  });

  it("returns true для не-host участника group", () => {
    expect(
      isDmMember({ memberUserIds: ["host", "u1", "u2", "u3"] }, "u2"),
    ).toBe(true);
  });

  it("returns false для outsider в group", () => {
    expect(
      isDmMember({ memberUserIds: ["host", "u1", "u2", "u3"] }, "outsider"),
    ).toBe(false);
  });

  it("returns true для self в Saved Messages (deduplicated set)", () => {
    // Self-conversation: loadConversationMembers возвращает Set([me]) — один элемент.
    expect(isDmMember({ memberUserIds: ["me"] }, "me")).toBe(true);
  });

  it("returns false для empty members (corner case — removed group)", () => {
    expect(isDmMember({ memberUserIds: [] }, "anyone")).toBe(false);
  });
});
