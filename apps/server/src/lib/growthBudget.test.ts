import { beforeEach, describe, expect, it, vi } from "vitest";

const budgetStore = vi.hoisted(() => {
  let requests: number | null = null;
  let transactionQueue = Promise.resolve();
  const charges = new Set<string>();

  const growthAiUsage = {
    async createMany() {
      if (requests === null) requests = 0;
      return { count: 1 };
    },
    async updateMany({ where }: { where: { requests: { lt: number } } }) {
      if (requests === null || requests >= where.requests.lt) return { count: 0 };
      requests += 1;
      return { count: 1 };
    },
    async findUnique() { return requests === null ? null : { requests }; },
    async findUniqueOrThrow() {
      if (requests === null) throw new Error("missing usage row");
      return { requests };
    },
  };
  const growthAiUsageCharge = {
    async findUnique({ where }: { where: { executionId: string } }) {
      return charges.has(where.executionId) ? { executionId: where.executionId } : null;
    },
    async create({ data }: { data: { executionId: string } }) {
      if (charges.has(data.executionId)) {
        throw Object.assign(new Error("unique constraint"), { code: "P2002" });
      }
      charges.add(data.executionId);
      return data;
    },
  };
  const database = {
    growthAiUsage,
    async $queryRaw() { return [{ pg_advisory_xact_lock: null }]; },
    growthAiUsageCharge,
    async $transaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
      let release!: () => void;
      const previous = transactionQueue;
      transactionQueue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await callback(database);
      } finally {
        release();
      }
    },
  };

  return {
    database,
    reset() {
      requests = null;
      charges.clear();
      transactionQueue = Promise.resolve();
    },
    value() { return requests; },
    chargeCount() { return charges.size; },
  };
});

vi.mock("../db.js", () => ({ db: budgetStore.database }));

import {
  consumeGrowthBudget,
  consumeGrowthBudgetOnce,
  consumeGrowthBudgetOnceWithClient,
  getGrowthBudget,
} from "./growthBudget.js";

describe("Growth daily request budget", () => {
  beforeEach(() => budgetStore.reset());

  it("does not exceed the daily limit during concurrent first-use races", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () => consumeGrowthBudget("user-1", 3, new Date("2026-08-13T10:00:00Z"))),
    );

    expect(attempts.filter(Boolean)).toHaveLength(3);
    expect(budgetStore.value()).toBe(3);
    await expect(getGrowthBudget("user-1", 3, new Date("2026-08-13T23:59:00Z"))).resolves.toEqual({
      day: "2026-08-13",
      limit: 3,
      used: 3,
      remaining: 0,
    });
  });

  it("charges one logical execution only once across concurrent retries", async () => {
    const executionId = "a".repeat(64);
    const receipts = await Promise.all(
      Array.from(
        { length: 10 },
        () => consumeGrowthBudgetOnce("user-1", 3, executionId, new Date("2026-08-13T10:00:00Z")),
      ),
    );

    expect(receipts.filter((receipt) => receipt?.charged)).toHaveLength(1);
    expect(receipts.filter((receipt) => receipt?.idempotent)).toHaveLength(9);
    expect(budgetStore.value()).toBe(1);
    expect(budgetStore.chargeCount()).toBe(1);
  });

  it("can join an existing start transaction without opening a nested transaction", async () => {
    const executionId = "b".repeat(64);
    const transactionSpy = vi.spyOn(budgetStore.database, "$transaction");

    await expect(consumeGrowthBudgetOnceWithClient(
      budgetStore.database as never,
      "user-1",
      3,
      executionId,
      new Date("2026-08-13T10:00:00Z"),
    )).resolves.toMatchObject({ charged: true, idempotent: false, used: 1 });

    expect(transactionSpy).not.toHaveBeenCalled();
    expect(budgetStore.value()).toBe(1);
    expect(budgetStore.chargeCount()).toBe(1);
  });
  it("rejects caller-controlled execution identifiers outside the fixed digest shape", async () => {
    await expect(consumeGrowthBudgetOnce("user-1", 3, "not-a-digest")).rejects.toThrow(
      "Growth execution id must be a SHA-256 digest",
    );
    expect(budgetStore.value()).toBeNull();
  });
});