import { describe, expect, it } from "vitest";

/**
 * Юнит-тесты на applyBoardFilters (apps/web/src/components/StatusBoard.tsx).
 *
 * Inline-копия pure-функции — нельзя импортировать из web workspace
 * (нет vitest config + React deps на module-level). Source-of-truth — в
 * StatusBoard.tsx. Pattern такой же как bot-key.test.ts.
 *
 * Если applyBoardFilters в StatusBoard.tsx меняется — синхронизировать
 * эту копию. v0.32+: extract в `apps/web/src/lib/boardFilters.ts` +
 * setup web vitest workspace.
 */

type ActionItem = {
  id: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  status: "OPEN" | "DONE";
  dueAt: string | null;
  assignee: { id: string; displayName: string; avatar: string | null } | null;
};

type Filters = {
  type: "ALL" | "TASK" | "DECISION" | "FOLLOW_UP";
  mineOnly: boolean;
  overdueOnly: boolean;
  unassignedOnly: boolean;
  assigneeUserId: string | null;
};

function applyBoardFilters(
  actions: ActionItem[],
  filters: Filters,
  currentUserId: string,
  now: number,
): ActionItem[] {
  return actions.filter((a) => {
    if (filters.type !== "ALL" && a.type !== filters.type) return false;
    if (filters.mineOnly && a.assignee?.id !== currentUserId) return false;
    if (filters.overdueOnly) {
      if (!a.dueAt) return false;
      if (new Date(a.dueAt).getTime() >= now) return false;
      if (a.status === "DONE") return false;
    }
    if (filters.unassignedOnly && a.assignee != null) return false;
    if (filters.assigneeUserId && a.assignee?.id !== filters.assigneeUserId) {
      return false;
    }
    return true;
  });
}

// ─── Fixture builders ────────────────────────────────────────────────────
const NOW = new Date("2026-05-15T12:00:00Z").getTime();
const past = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const future = (h: number) => new Date(NOW + h * 3_600_000).toISOString();
const u = (id: string, name = id): { id: string; displayName: string; avatar: null } => ({
  id,
  displayName: name,
  avatar: null,
});
const ai = (
  id: string,
  opts: Partial<ActionItem> = {},
): ActionItem => ({
  id,
  type: "TASK",
  status: "OPEN",
  dueAt: null,
  assignee: null,
  ...opts,
});

const NO_FILTERS: Filters = {
  type: "ALL",
  mineOnly: false,
  overdueOnly: false,
  unassignedOnly: false,
  assigneeUserId: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────
describe("applyBoardFilters", () => {
  it("без фильтров возвращает всё", () => {
    const items = [ai("1"), ai("2", { type: "DECISION" }), ai("3", { status: "DONE" })];
    expect(applyBoardFilters(items, NO_FILTERS, "me", NOW)).toHaveLength(3);
  });

  it("type filter оставляет только matching", () => {
    const items = [
      ai("t", { type: "TASK" }),
      ai("d", { type: "DECISION" }),
      ai("f", { type: "FOLLOW_UP" }),
    ];
    const r = applyBoardFilters(items, { ...NO_FILTERS, type: "DECISION" }, "me", NOW);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("d");
  });

  it("mineOnly — только actions с assignee.id == currentUserId", () => {
    const items = [
      ai("1", { assignee: u("me") }),
      ai("2", { assignee: u("other") }),
      ai("3", { assignee: null }),
    ];
    const r = applyBoardFilters(items, { ...NO_FILTERS, mineOnly: true }, "me", NOW);
    expect(r.map((a) => a.id)).toEqual(["1"]);
  });

  it("overdueOnly — dueAt в прошлом + status=OPEN", () => {
    const items = [
      ai("1", { dueAt: past(2), status: "OPEN" }), // ✓ overdue OPEN
      ai("2", { dueAt: past(2), status: "DONE" }), // ✗ DONE
      ai("3", { dueAt: future(2), status: "OPEN" }), // ✗ future
      ai("4", { dueAt: null, status: "OPEN" }), // ✗ no due
    ];
    const r = applyBoardFilters(items, { ...NO_FILTERS, overdueOnly: true }, "me", NOW);
    expect(r.map((a) => a.id)).toEqual(["1"]);
  });

  it("unassignedOnly — только actions без assignee", () => {
    const items = [
      ai("1", { assignee: u("a") }),
      ai("2", { assignee: null }),
      ai("3", { assignee: null }),
    ];
    const r = applyBoardFilters(items, { ...NO_FILTERS, unassignedOnly: true }, "me", NOW);
    expect(r.map((a) => a.id)).toEqual(["2", "3"]);
  });

  it("assigneeUserId — только actions assigned to конкретного user'а", () => {
    const items = [
      ai("1", { assignee: u("alice") }),
      ai("2", { assignee: u("bob") }),
      ai("3", { assignee: u("alice") }),
      ai("4", { assignee: null }),
    ];
    const r = applyBoardFilters(
      items,
      { ...NO_FILTERS, assigneeUserId: "alice" },
      "me",
      NOW,
    );
    expect(r.map((a) => a.id)).toEqual(["1", "3"]);
  });

  it("combined: TASK + overdue + assignee должны все совпасть", () => {
    const items = [
      ai("1", { type: "TASK", dueAt: past(1), assignee: u("alice") }), // ✓
      ai("2", { type: "DECISION", dueAt: past(1), assignee: u("alice") }), // ✗ type
      ai("3", { type: "TASK", dueAt: future(1), assignee: u("alice") }), // ✗ not overdue
      ai("4", { type: "TASK", dueAt: past(1), assignee: u("bob") }), // ✗ assignee
    ];
    const r = applyBoardFilters(
      items,
      {
        type: "TASK",
        mineOnly: false,
        overdueOnly: true,
        unassignedOnly: false,
        assigneeUserId: "alice",
      },
      "me",
      NOW,
    );
    expect(r.map((a) => a.id)).toEqual(["1"]);
  });

  it("mineOnly + overdueOnly — два независимых AND'а", () => {
    const items = [
      ai("1", { assignee: u("me"), dueAt: past(1), status: "OPEN" }), // ✓
      ai("2", { assignee: u("me"), dueAt: future(1) }), // ✗ not overdue
      ai("3", { assignee: u("other"), dueAt: past(1) }), // ✗ not mine
    ];
    const r = applyBoardFilters(
      items,
      { ...NO_FILTERS, mineOnly: true, overdueOnly: true },
      "me",
      NOW,
    );
    expect(r.map((a) => a.id)).toEqual(["1"]);
  });

  it("unassignedOnly + assigneeUserId — взаимоисключающие, всегда пусто", () => {
    const items = [ai("1", { assignee: u("alice") }), ai("2", { assignee: null })];
    const r = applyBoardFilters(
      items,
      { ...NO_FILTERS, unassignedOnly: true, assigneeUserId: "alice" },
      "me",
      NOW,
    );
    expect(r).toEqual([]);
  });

  it("empty input — empty output", () => {
    expect(applyBoardFilters([], NO_FILTERS, "me", NOW)).toEqual([]);
  });
});
