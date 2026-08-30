import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(async () => ({ count: 1 })),
}));

vi.mock("../src/db.js", () => ({
  db: {
    refreshToken: {
      deleteMany: mocks.deleteMany,
    },
  },
}));

import { deleteRefreshByRawForUser } from "../src/auth/refresh.js";

describe("independent auth sessions", () => {
  it("scopes raw refresh revocation to the authenticated user", async () => {
    mocks.deleteMany.mockClear();
    await expect(deleteRefreshByRawForUser("refresh-session-a", "user-a")).resolves.toBe(1);
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
    const where = mocks.deleteMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.userId).toBe("user-a");
    expect(where.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not turn login or ordinary logout into global logout", async () => {
    const routePath = fileURLToPath(new URL("../src/routes/auth.ts", import.meta.url));
    const source = await readFile(routePath, "utf8");
    const login = source.slice(
      source.indexOf('"/api/auth/login"'),
      source.indexOf('"/api/auth/refresh"'),
    );
    const logout = source.slice(
      source.indexOf('"/api/auth/logout"'),
      source.indexOf('"/api/auth/me"'),
    );
    expect(login).not.toContain("deleteAllUserRefresh");
    expect(logout).toContain("deleteRefreshByRawForUser");
    expect(logout).not.toContain("deleteAllUserRefresh");
  });

  it("keeps global revocation for password security events", async () => {
    const routePath = fileURLToPath(new URL("../src/routes/auth.ts", import.meta.url));
    const source = await readFile(routePath, "utf8");
    expect(source.match(/deleteAllUserRefresh\(user\.id\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
