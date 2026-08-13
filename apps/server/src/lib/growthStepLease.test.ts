import { describe, expect, it } from "vitest";
import { GrowthStepLeaseRegistry } from "./growthStepLease.js";

describe("Growth step execution lease", () => {
  it("allows at most one provider request reservation per run", () => {
    const leases = new GrowthStepLeaseRegistry();
    const first = new AbortController();
    const duplicate = new AbortController();

    expect(leases.reserve("run-1", { userId: "user-1", step: "research", controller: first })).toBe(true);
    expect(leases.reserve("run-1", { userId: "user-1", step: "research", controller: duplicate })).toBe(false);
    expect(leases.get("run-1")?.controller).toBe(first);

    leases.release("run-1", duplicate);
    expect(leases.get("run-1")?.controller).toBe(first);
    leases.release("run-1", first);
    expect(leases.get("run-1")).toBeUndefined();
  });
});
