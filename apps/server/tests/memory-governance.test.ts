import { describe, expect, it } from "vitest";
import {
  canManageMemoryEntry,
  getMemoryLifecycle,
  memoryContextEligibilityWhere,
} from "../src/lib/memoryGovernance.js";

const NOW = new Date("2026-08-02T12:00:00.000Z");

describe("memory governance", () => {
  it("includes only active reviewed memory in AI context", () => {
    expect(getMemoryLifecycle({
      visibility: "ROOM",
      archivedAt: null,
      reviewDueAt: new Date("2026-09-01T00:00:00.000Z"),
      expiresAt: null,
    }, NOW)).toMatchObject({ status: "ACTIVE", contextEligible: true });

    expect(getMemoryLifecycle({
      visibility: "ROOM",
      archivedAt: null,
      reviewDueAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: null,
    }, NOW)).toMatchObject({ status: "REVIEW_DUE", contextEligible: false });

    expect(getMemoryLifecycle({
      visibility: "WORKSPACE",
      archivedAt: null,
      reviewDueAt: null,
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
    }, NOW)).toMatchObject({ status: "EXPIRED", contextEligible: false });

    expect(getMemoryLifecycle({
      visibility: "ROOM",
      archivedAt: new Date("2026-07-30T00:00:00.000Z"),
      reviewDueAt: null,
      expiresAt: null,
    }, NOW)).toMatchObject({ status: "ARCHIVED", contextEligible: false });
  });

  it("allows the owner, creator, and explicit managers to mutate an entry", () => {
    const entry = { ownerUserId: "owner", createdByUserId: "creator" };
    expect(canManageMemoryEntry("owner", "MEMBER", entry)).toBe(true);
    expect(canManageMemoryEntry("creator", "MEMBER", entry)).toBe(true);
    expect(canManageMemoryEntry("architect", "ARCHITECT", entry)).toBe(true);
    expect(canManageMemoryEntry("operator", "OPERATOR", entry)).toBe(true);
    expect(canManageMemoryEntry("stranger", "MEMBER", entry)).toBe(false);
    expect(canManageMemoryEntry("moderator", "MODERATOR", entry)).toBe(false);
  });

  it("builds an active-context query that excludes stale and expired rows", () => {
    expect(memoryContextEligibilityWhere(NOW)).toEqual({
      archivedAt: null,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }] },
        { OR: [{ reviewDueAt: null }, { reviewDueAt: { gt: NOW } }] },
      ],
    });
  });
});
