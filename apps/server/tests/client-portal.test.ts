import { describe, expect, it } from "vitest";
import {
  aggregatePortalCounts,
  canAccessClientPortal,
} from "../src/routes/clientPortal.js";

/**
 * v0.83 #24 phase 1 — unit tests для Client Portal pure helpers.
 *
 * Не покрывает route handler (нужна DB / fastify). Покрывает logic
 * permission gate + counts aggregation — то что реально может сломаться
 * при будущих изменениях roles taxonomy / status enum.
 */

describe("canAccessClientPortal", () => {
  it("CLIENT — primary user, не preview", () => {
    expect(canAccessClientPortal("CLIENT")).toEqual({
      allowed: true,
      isPreview: false,
    });
  });

  it("OWNER и ADMIN — preview mode", () => {
    expect(canAccessClientPortal("OWNER")).toEqual({
      allowed: true,
      isPreview: true,
    });
    expect(canAccessClientPortal("ADMIN")).toEqual({
      allowed: true,
      isPreview: true,
    });
  });

  it.each([
    "MODERATOR",
    "ARCHITECT",
    "DEVELOPER",
    "OPERATOR",
    "VIEWER",
    "GUEST",
    "MEMBER",
  ] as const)("%s — отказ (portal не для них)", (role) => {
    expect(canAccessClientPortal(role)).toEqual({
      allowed: false,
      isPreview: false,
    });
  });

  it("preview-flag отличается между primary и admin при allowed=true", () => {
    const clientAccess = canAccessClientPortal("CLIENT");
    const adminAccess = canAccessClientPortal("ADMIN");
    expect(clientAccess.allowed).toBe(true);
    expect(adminAccess.allowed).toBe(true);
    expect(clientAccess.isPreview).toBe(false);
    expect(adminAccess.isPreview).toBe(true);
  });
});

describe("aggregatePortalCounts", () => {
  it("пустой массив → все нули", () => {
    expect(aggregatePortalCounts([])).toEqual({
      open: 0,
      inProgress: 0,
      review: 0,
      done: 0,
    });
  });

  it("каждый status считается отдельно", () => {
    const result = aggregatePortalCounts([
      { status: "OPEN" },
      { status: "OPEN" },
      { status: "IN_PROGRESS" },
      { status: "REVIEW" },
      { status: "DONE" },
      { status: "DONE" },
      { status: "DONE" },
    ]);
    expect(result).toEqual({
      open: 2,
      inProgress: 1,
      review: 1,
      done: 3,
    });
  });

  it("все одного status", () => {
    const result = aggregatePortalCounts(
      Array.from({ length: 5 }, () => ({ status: "OPEN" as const })),
    );
    expect(result.open).toBe(5);
    expect(result.inProgress).toBe(0);
    expect(result.review).toBe(0);
    expect(result.done).toBe(0);
  });

  it("counts сохраняют монотонность при росте input'а", () => {
    const a = aggregatePortalCounts([{ status: "OPEN" }, { status: "DONE" }]);
    const b = aggregatePortalCounts([
      { status: "OPEN" },
      { status: "DONE" },
      { status: "DONE" },
    ]);
    expect(b.done).toBeGreaterThan(a.done);
    expect(b.open).toBe(a.open);
  });
});
