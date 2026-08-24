import { Prisma } from "@prisma/client";
import { db } from "../db.js";

type GrowthBudgetClient = Pick<Prisma.TransactionClient, "growthAiUsage" | "growthAiUsageCharge">;
export type GrowthBudgetTransactionClient = GrowthBudgetClient & Pick<Prisma.TransactionClient, "$queryRaw">;

export type GrowthBudgetReceipt = {
  day: string;
  limit: number;
  used: number;
  remaining: number;
};

export type IdempotentGrowthBudgetReceipt = GrowthBudgetReceipt & {
  charged: boolean;
  idempotent: boolean;
};

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isPrismaCode(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}

async function getGrowthBudgetWithClient(
  client: GrowthBudgetClient,
  userId: string,
  limit: number,
  day: string,
): Promise<GrowthBudgetReceipt> {
  const row = await client.growthAiUsage.findUnique({ where: { userId_day: { userId, day } } });
  const used = row?.requests ?? 0;
  return { day, limit, used, remaining: Math.max(0, limit - used) };
}

async function consumeGrowthBudgetWithClient(
  client: GrowthBudgetClient,
  userId: string,
  limit: number,
  day: string,
): Promise<GrowthBudgetReceipt | null> {
  await client.growthAiUsage.createMany({
    data: [{ userId, day, requests: 0 }],
    skipDuplicates: true,
  });
  const changed = await client.growthAiUsage.updateMany({
    where: { userId, day, requests: { lt: limit } },
    data: { requests: { increment: 1 } },
  });
  if (changed.count !== 1) return null;
  const row = await client.growthAiUsage.findUniqueOrThrow({
    where: { userId_day: { userId, day } },
  });
  return { day, limit, used: row.requests, remaining: Math.max(0, limit - row.requests) };
}

export async function getGrowthBudget(userId: string, limit: number, now = new Date()) {
  const day = utcDay(now);
  return getGrowthBudgetWithClient(db as unknown as GrowthBudgetClient, userId, limit, day);
}

export async function consumeGrowthBudget(userId: string, limit: number, now = new Date()) {
  const day = utcDay(now);
  return consumeGrowthBudgetWithClient(db as unknown as GrowthBudgetClient, userId, limit, day);
}

export async function consumeGrowthBudgetOnceWithClient(
  client: GrowthBudgetTransactionClient,
  userId: string,
  limit: number,
  executionId: string,
  now = new Date(),
): Promise<IdempotentGrowthBudgetReceipt | null> {
  if (!/^[a-f0-9]{64}$/.test(executionId)) {
    throw new Error("Growth execution id must be a SHA-256 digest");
  }
  const day = utcDay(now);
  await client.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${executionId}, 0))::text AS "lockReceipt"`);
  const existing = await client.growthAiUsageCharge.findUnique({ where: { executionId } });
  if (existing) {
    const budget = await getGrowthBudgetWithClient(client, userId, limit, day);
    return { ...budget, charged: false, idempotent: true };
  }

  const budget = await consumeGrowthBudgetWithClient(client, userId, limit, day);
  if (!budget) return null;
  await client.growthAiUsageCharge.create({
    data: { executionId, userId, day },
  });
  return { ...budget, charged: true, idempotent: false };
}

export async function consumeGrowthBudgetOnce(
  userId: string,
  limit: number,
  executionId: string,
  now = new Date(),
): Promise<IdempotentGrowthBudgetReceipt | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction((tx) => consumeGrowthBudgetOnceWithClient(
        tx as unknown as GrowthBudgetTransactionClient,
        userId,
        limit,
        executionId,
        now,
      ));
    } catch (error) {
      if (isPrismaCode(error, "P2002")) {
        const budget = await getGrowthBudget(userId, limit, now);
        return { ...budget, charged: false, idempotent: true };
      }
      if (isPrismaCode(error, "P2034") && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Growth budget transaction retry exhausted");
}