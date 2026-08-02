import { describe, expect, it } from "vitest";
import { hasPermission } from "../src/lib/permissions.js";

describe("internal room permissions", () => {
  it("keeps external and default participant roles out of client internal rooms", () => {
    for (const role of ["CLIENT", "GUEST", "MEMBER"] as const) {
      expect(hasPermission(role, "ROOM_VIEW_INTERNAL"), role).toBe(false);
    }
  });

  it("allows only roles explicitly granted internal-room visibility", () => {
    for (const role of [
      "OWNER",
      "ADMIN",
      "MODERATOR",
      "ARCHITECT",
      "DEVELOPER",
      "OPERATOR",
      "VIEWER",
    ] as const) {
      expect(hasPermission(role, "ROOM_VIEW_INTERNAL"), role).toBe(true);
    }
  });

  it("limits workspace-wide memory governance to accountable operational roles", () => {
    for (const role of ["OWNER", "ADMIN", "ARCHITECT", "OPERATOR"] as const) {
      expect(hasPermission(role, "MEMORY_MANAGE"), role).toBe(true);
    }
    for (const role of ["MODERATOR", "DEVELOPER", "CLIENT", "VIEWER", "GUEST", "MEMBER"] as const) {
      expect(hasPermission(role, "MEMORY_MANAGE"), role).toBe(false);
    }
  });
});
