import { beforeEach, describe, expect, it, vi } from "vitest";

const usageStore = vi.hoisted(() => {
  let requests: number | null = null;
  return {
    reset() { requests = null; },
    value() { return requests; },
    async updateMany({ where }: { where: { requests: { lt: number } } }) {
      if (requests === null || requests >= where.requests.lt) return { count: 0 };
      requests += 1;
      return { count: 1 };
    },
    async create() {
      if (requests !== null) throw Object.assign(new Error("unique constraint"), { code: "P2002" });
      requests = 1;
      return { requests };
    },
    async findUnique() { return requests === null ? null : { requests }; },
    async findUniqueOrThrow() {
      if (requests === null) throw new Error("missing usage row");
      return { requests };
    },
  };
});

vi.mock("../db.js", () => ({ db: { growthAiUsage: usageStore } }));

import { consumeGrowthBudget, getGrowthBudget } from "./growthBudget.js";

describe("Growth daily request budget", () => {
  beforeEach(() => usageStore.reset());

  it("does not exceed the daily limit during concurrent first-use races", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () => consumeGrowthBudget("user-1", 3, new Date("2026-08-13T10:00:00Z"))),
    );

    expect(attempts.filter(Boolean)).toHaveLength(3);
    expect(usageStore.value()).toBe(3);
    await expect(getGrowthBudget("user-1", 3, new Date("2026-08-13T23:59:00Z"))).resolves.toEqual({
      day: "2026-08-13",
      limit: 3,
      used: 3,
      remaining: 0,
    });
  });
});
