import { describe, expect, it } from "vitest";
import {
  classifyDigestAction,
  monotonicDigestCursor,
  personalDigestExcerpt,
  resolvePersonalDigestSince,
} from "../src/lib/personalDigest.js";

const now = new Date("2026-08-03T12:00:00.000Z");

describe("personal command digest", () => {
  it("starts new users with a bounded 24 hour window", () => {
    const result = resolvePersonalDigestSince(
      null,
      new Date("2026-01-01T00:00:00.000Z"),
      now,
    );

    expect(result).toEqual({
      since: new Date("2026-08-02T12:00:00.000Z"),
      initialized: false,
      truncated: false,
    });
  });

  it("caps stale cursors at 30 days", () => {
    const result = resolvePersonalDigestSince(
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2025-01-01T00:00:00.000Z"),
      now,
    );

    expect(result.since).toEqual(new Date("2026-07-04T12:00:00.000Z"));
    expect(result.initialized).toBe(true);
    expect(result.truncated).toBe(true);
  });

  it("prioritizes approvals and overdue assigned work", () => {
    const base = {
      type: "TASK" as const,
      status: "OPEN" as const,
      priority: "NORMAL" as const,
      dueAt: null,
      escalatedAt: null,
      approvalStatus: "NONE" as const,
      approverUserId: null,
      assigneeUserId: null,
    };

    expect(
      classifyDigestAction(
        { ...base, approvalStatus: "PENDING", approverUserId: "me" },
        "me",
        now,
      ),
    ).toBe("CRITICAL");
    expect(
      classifyDigestAction(
        { ...base, dueAt: new Date("2026-08-02T00:00:00.000Z") },
        "me",
        now,
      ),
    ).toBe("CRITICAL");
    expect(
      classifyDigestAction({ ...base, assigneeUserId: "me" }, "me", now),
    ).toBe("HIGH");
    expect(classifyDigestAction({ ...base, type: "RISK" }, "me", now)).toBe("HIGH");
    expect(classifyDigestAction({ ...base, type: "REQUIREMENT" }, "me", now)).toBe("NORMAL");
  });

  it("never moves the acknowledged cursor backwards or into the future", () => {
    const current = new Date("2026-08-03T10:00:00.000Z");
    expect(
      monotonicDigestCursor(current, new Date("2026-08-03T09:00:00.000Z"), now),
    ).toEqual(current);
    expect(
      monotonicDigestCursor(current, new Date("2026-08-03T12:00:00.001Z"), now),
    ).toBeNull();
  });

  it("normalizes and bounds untrusted message excerpts", () => {
    expect(personalDigestExcerpt("  hello\n\nworld  ", 20)).toBe("hello world");
    expect(personalDigestExcerpt("123456789", 6)).toBe("12345…");
  });
});
