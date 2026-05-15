import { describe, expect, it } from "vitest";
import {
  aggregateTeamHealth,
  type DoneActionInput,
  type OpenActionInput,
  type UserInput,
} from "../src/routes/analytics.js";

/**
 * Юнит-тесты pure-функции aggregateTeamHealth (без DB / fastify).
 *
 * Покрытие:
 *   - count метрик (overdue / unassigned / total)
 *   - sort по openCount desc + лимит top-3
 *   - blocked threshold (>= 3)
 *   - avg resolution: empty / < 3 sample / >= 3
 *   - edge cases: empty inputs, all unassigned, single member
 *   - missing user в hydration (защита от orphan FK)
 */

const NOW = new Date("2026-05-15T12:00:00Z");
const past = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
const future = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

const u = (id: string, name: string): UserInput => ({
  id,
  displayName: name,
  avatar: null,
});

describe("aggregateTeamHealth", () => {
  it("пустые входы → нулевые метрики, null avg", () => {
    const result = aggregateTeamHealth([], [], [], NOW);
    expect(result.openTotal).toBe(0);
    expect(result.overdueTotal).toBe(0);
    expect(result.unassignedTotal).toBe(0);
    expect(result.resolvedInWindow).toBe(0);
    expect(result.avgResolutionDays).toBeNull();
    expect(result.topOverloaded).toEqual([]);
    expect(result.blockedMembers).toEqual([]);
  });

  it("считает overdue (dueAt < now)", () => {
    const open: OpenActionInput[] = [
      { assigneeUserId: "a", dueAt: past(2) }, // overdue
      { assigneeUserId: "a", dueAt: future(24) }, // не overdue
      { assigneeUserId: "b", dueAt: past(48) }, // overdue
      { assigneeUserId: null, dueAt: past(1) }, // overdue + unassigned
    ];
    const result = aggregateTeamHealth(
      open,
      [],
      [u("a", "Алиса"), u("b", "Боб")],
      NOW,
    );
    expect(result.overdueTotal).toBe(3);
    expect(result.unassignedTotal).toBe(1);
    expect(result.openTotal).toBe(4);
  });

  it("без dueAt — не overdue", () => {
    const result = aggregateTeamHealth(
      [{ assigneeUserId: "a", dueAt: null }],
      [],
      [u("a", "Алиса")],
      NOW,
    );
    expect(result.overdueTotal).toBe(0);
  });

  it("topOverloaded sorted by openCount desc, limit 3", () => {
    const open: OpenActionInput[] = [
      // a → 5 tasks
      ...Array(5).fill({ assigneeUserId: "a", dueAt: null }),
      // b → 2 tasks
      ...Array(2).fill({ assigneeUserId: "b", dueAt: null }),
      // c → 7 tasks
      ...Array(7).fill({ assigneeUserId: "c", dueAt: null }),
      // d → 1 task
      { assigneeUserId: "d", dueAt: null },
      // e → 3 tasks
      ...Array(3).fill({ assigneeUserId: "e", dueAt: null }),
    ];
    const result = aggregateTeamHealth(
      open,
      [],
      [u("a", "A"), u("b", "B"), u("c", "C"), u("d", "D"), u("e", "E")],
      NOW,
    );
    // Sorted desc: c=7, a=5, e=3, b=2, d=1 — top-3 = c, a, e
    expect(result.topOverloaded).toHaveLength(3);
    expect(result.topOverloaded[0]).toMatchObject({ userId: "c", openCount: 7 });
    expect(result.topOverloaded[1]).toMatchObject({ userId: "a", openCount: 5 });
    expect(result.topOverloaded[2]).toMatchObject({ userId: "e", openCount: 3 });
  });

  it("blockedMembers ВСЕ с >= 3 (не лимитированы топ-3)", () => {
    const open: OpenActionInput[] = [
      ...Array(5).fill({ assigneeUserId: "a", dueAt: null }),
      ...Array(4).fill({ assigneeUserId: "b", dueAt: null }),
      ...Array(3).fill({ assigneeUserId: "c", dueAt: null }),
      ...Array(3).fill({ assigneeUserId: "d", dueAt: null }),
      ...Array(2).fill({ assigneeUserId: "e", dueAt: null }), // не blocked
    ];
    const result = aggregateTeamHealth(
      open,
      [],
      [u("a", "A"), u("b", "B"), u("c", "C"), u("d", "D"), u("e", "E")],
      NOW,
    );
    // top-3 — a, b, c (или d, sort стабилен по insertion order Map)
    expect(result.topOverloaded).toHaveLength(3);
    // blocked включает ВСЕ 4 (a, b, c, d) — лимит топ-3 не применяется
    expect(result.blockedMembers.map((m) => m.userId).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    // 'e' с 2 tasks НЕ blocked
    expect(result.blockedMembers.find((m) => m.userId === "e")).toBeUndefined();
  });

  it("avgResolutionDays: < 3 closures → null", () => {
    const done: DoneActionInput[] = [
      { createdAt: past(48), updatedAt: past(24) },
      { createdAt: past(72), updatedAt: past(24) },
    ];
    const result = aggregateTeamHealth([], done, [], NOW);
    expect(result.avgResolutionDays).toBeNull();
    expect(result.resolvedInWindow).toBe(2);
  });

  it("avgResolutionDays: 3+ closures → корректное среднее", () => {
    // 3 actions, все закрыты ровно через сутки
    const done: DoneActionInput[] = [
      { createdAt: past(48), updatedAt: past(24) },
      { createdAt: past(72), updatedAt: past(48) },
      { createdAt: past(96), updatedAt: past(72) },
    ];
    const result = aggregateTeamHealth([], done, [], NOW);
    // Каждое 24h = 1d, среднее 1.0
    expect(result.avgResolutionDays).toBe(1);
  });

  it("avgResolutionDays округляется до 1 dp", () => {
    // 5 actions со средним 2.16 дня → round → 2.2
    const done: DoneActionInput[] = [
      { createdAt: past(48), updatedAt: past(0) }, // 2d
      { createdAt: past(72), updatedAt: past(24) }, // 2d
      { createdAt: past(96), updatedAt: past(36) }, // 2.5d
      { createdAt: past(120), updatedAt: past(48) }, // 3d
      { createdAt: past(48), updatedAt: past(24) }, // 1d
    ];
    const result = aggregateTeamHealth([], done, [], NOW);
    // sum: 2 + 2 + 2.5 + 3 + 1 = 10.5 / 5 = 2.1
    expect(result.avgResolutionDays).toBe(2.1);
  });

  it("orphan assignee (нет в users[]) → не попадает в topOverloaded", () => {
    const open: OpenActionInput[] = [
      ...Array(5).fill({ assigneeUserId: "ghost", dueAt: null }),
      ...Array(2).fill({ assigneeUserId: "a", dueAt: null }),
    ];
    const result = aggregateTeamHealth(open, [], [u("a", "Алиса")], NOW);
    // ghost не в users → отфильтрован
    expect(result.topOverloaded).toHaveLength(1);
    expect(result.topOverloaded[0].userId).toBe("a");
  });

  it("все unassigned → unassignedTotal=N, topOverloaded пустой", () => {
    const open: OpenActionInput[] = [
      { assigneeUserId: null, dueAt: null },
      { assigneeUserId: null, dueAt: null },
      { assigneeUserId: null, dueAt: null },
    ];
    const result = aggregateTeamHealth(open, [], [], NOW);
    expect(result.unassignedTotal).toBe(3);
    expect(result.openTotal).toBe(3);
    expect(result.topOverloaded).toEqual([]);
    expect(result.blockedMembers).toEqual([]);
  });

  it("один member с 1 task → topOverloaded.length=1, не blocked", () => {
    const result = aggregateTeamHealth(
      [{ assigneeUserId: "a", dueAt: null }],
      [],
      [u("a", "Алиса")],
      NOW,
    );
    expect(result.topOverloaded).toHaveLength(1);
    expect(result.topOverloaded[0].openCount).toBe(1);
    expect(result.blockedMembers).toEqual([]);
  });
});
