import { db } from "../db.js";

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getGrowthBudget(userId: string, limit: number, now = new Date()) {
  const day = utcDay(now);
  const row = await db.growthAiUsage.findUnique({ where: { userId_day: { userId, day } } });
  const used = row?.requests ?? 0;
  return { day, limit, used, remaining: Math.max(0, limit - used) };
}

export async function consumeGrowthBudget(userId: string, limit: number, now = new Date()) {
  const day = utcDay(now);
  const where = { userId, day, requests: { lt: limit } } as const;
  let changed = await db.growthAiUsage.updateMany({ where, data: { requests: { increment: 1 } } });
  if (changed.count === 0) {
    try {
      const created = await db.growthAiUsage.create({ data: { userId, day, requests: 1 } });
      return { day, limit, used: created.requests, remaining: Math.max(0, limit - created.requests) };
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== "P2002") throw error;
      changed = await db.growthAiUsage.updateMany({ where, data: { requests: { increment: 1 } } });
    }
  }
  if (changed.count !== 1) return null;
  const row = await db.growthAiUsage.findUniqueOrThrow({ where: { userId_day: { userId, day } } });
  return { day, limit, used: row.requests, remaining: Math.max(0, limit - row.requests) };
}
