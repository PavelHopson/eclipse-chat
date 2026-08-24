import { describe, expect, it } from "vitest";
import { TenantOfficeEventBus } from "./eventBus.js";

describe("TenantOfficeEventBus", () => {
  it("keeps workspace streams isolated and ordered", () => {
    const bus = new TenantOfficeEventBus(10);
    bus.publish({ workspaceId: "alpha", type: "task.created", subject: { kind: "task", id: "a-1" }, summary: "Создана задача" });
    bus.publish({ workspaceId: "beta", type: "task.created", subject: { kind: "task", id: "b-1" }, summary: "Создана задача" });
    bus.publish({ workspaceId: "alpha", type: "task.started", subject: { kind: "task", id: "a-1" }, summary: "Задача запущена" });

    expect(bus.list("alpha").map((event) => event.sequence)).toEqual([1, 2]);
    expect(bus.list("beta").map((event) => event.sequence)).toEqual([1]);
    expect(bus.list("alpha", { after: 1 })).toHaveLength(1);
  });

  it("rejects secret-shaped metadata keys", () => {
    const bus = new TenantOfficeEventBus(10);
    expect(() => bus.publish({
      workspaceId: "alpha",
      type: "task.created",
      subject: { kind: "task", id: "a-1" },
      summary: "Создана задача",
      metadata: { apiToken: "must-not-leak" },
    })).toThrow(/Sensitive metadata key/);
  });

  it("bounds retained events without resetting the monotonic cursor", () => {
    const bus = new TenantOfficeEventBus(10);
    for (let index = 0; index < 14; index += 1) {
      bus.publish({ workspaceId: "alpha", type: "task.progressed", subject: { kind: "task", id: "a-1" }, summary: `Шаг ${index}` });
    }
    expect(bus.list("alpha", { limit: 100 }).map((event) => event.sequence)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(bus.cursor("alpha")).toBe(14);
  });
});
