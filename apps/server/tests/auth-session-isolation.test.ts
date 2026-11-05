import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(), userFind: vi.fn(), userFindFirst: vi.fn(),
  userUpdate: vi.fn(), userUpdateMany: vi.fn(), refreshCreate: vi.fn(),
  transaction: vi.fn(), queryRaw: vi.fn(), verifyRecovery: vi.fn(), findSession: vi.fn(), disconnectUser: vi.fn(),
}));
vi.mock("../src/db.js", () => ({ db: {
  refreshToken: { deleteMany: mocks.deleteMany, findUnique: mocks.findSession },
  user: { findUnique: mocks.userFind, findFirst: mocks.userFindFirst, update: mocks.userUpdate },
  $transaction: mocks.transaction,
} }));
vi.mock("../src/realtime.js", () => ({ disconnectSession: vi.fn(), disconnectUserSockets: mocks.disconnectUser }));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(async () => true), hash: vi.fn(async () => "new-password-hash") } }));
vi.mock("../src/security/audit.js", () => ({ recordAudit: vi.fn() }));
vi.mock("../src/security/twoFactor.js", () => ({
  decryptSecret: vi.fn(), verifyCode: vi.fn(), verifyRecoveryCode: mocks.verifyRecovery,
  generateRecoveryCodes: vi.fn(),
}));

import { deleteRefreshByRawForUser } from "../src/auth/refresh.js";
import { registerAuthRoutes } from "../src/routes/auth.js";

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("independent auth sessions", () => {
  it("scopes raw refresh revocation to the authenticated user", async () => {
    mocks.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(deleteRefreshByRawForUser("refresh-session-a", "user-a")).resolves.toBe(1);
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
    const where = mocks.deleteMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.userId).toBe("user-a");
    expect(where.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not turn login or ordinary logout into global logout", async () => {
    const routePath = fileURLToPath(new URL("../src/routes/auth.ts", import.meta.url));
    const source = await readFile(routePath, "utf8");
    const login = source.slice(source.indexOf('"/api/auth/login"'), source.indexOf('"/api/auth/refresh"'));
    const logout = source.slice(source.indexOf('"/api/auth/logout"'), source.indexOf('"/api/auth/me"'));
    expect(login).not.toContain("deleteAllUserRefresh");
    expect(logout).toContain("deleteRefreshByRawForUser");
    expect(logout).not.toContain("deleteAllUserRefresh");
  });

  it.each([
    ["change-password", false, false], ["password-recovery/reset", false, false],
    ["change-password", true, false], ["password-recovery/reset", true, false],
    ["change-password", true, true], ["password-recovery/reset", true, true],
  ] as const)("revokes the owner sessions after %s (gate=%s conflict=%s)", async (route, gate, conflict) => {
    vi.stubEnv("JWT_SECRET", "isolated-session-test-secret");
    vi.stubEnv("AUTH_PROTOCOL_V2_REQUIRED", gate ? "true" : "false");
    const state = {
      user: { id: "user-a", email: "a@example.invalid", displayName: "A", avatar: null, bio: null,
        passwordHash: "old-password-hash", passwordRecoveryCodes: '["recovery-hash"]', twoFactorEnabled: false,
        twoFactorSecret: null, bannedAt: null, deletedAt: null, createdAt: new Date() },
      sessions: [{ id: "a1", userId: "user-a" }, { id: "a2", userId: "user-a" }, { id: "b1", userId: "user-b" }],
    };
    const trace: Array<{ tx: number; kind: string; userId?: string }> = [];
    let transactionId = 0;
    mocks.findSession.mockResolvedValue({ userId: "user-a", expiresAt: new Date(Date.now()+60_000), user: { bannedAt: null, deletedAt: null } });
    mocks.disconnectUser.mockImplementation((id: string) => trace.push({ tx: transactionId, kind: "disconnect", userId: id }));
    const findUser = async () => ({ ...state.user });
    mocks.userFind.mockImplementation(findUser);
    mocks.userFindFirst.mockImplementation(findUser);
    mocks.verifyRecovery.mockResolvedValue({ remainingJson: "[]" });
    mocks.userUpdate.mockResolvedValue({ id: "user-a" });
    mocks.transaction.mockImplementation(async (action: (tx: unknown) => Promise<unknown>) => {
      const tx = ++transactionId;
      const result = await action({
        $queryRaw: async () => [],
        user: {
          findUnique: findUser,
          updateMany: async ({ where, data }: { where: { id: string; passwordHash: string }; data: Record<string, unknown> }) => {
            trace.push({ tx, kind: "update", userId: where.id });
            if (conflict || where.id !== state.user.id || where.passwordHash !== state.user.passwordHash) return { count: 0 };
            Object.assign(state.user, data);
            return { count: 1 };
          },
        },
        refreshToken: {
          deleteMany: async ({ where }: { where: { userId: string } }) => {
            trace.push({ tx, kind: "revoke", userId: where.userId });
            const before = state.sessions.length;
            state.sessions = state.sessions.filter(session => session.userId !== where.userId);
            return { count: before - state.sessions.length };
          },
          create: async ({ data }: { data: { id: string; userId: string } }) => {
            trace.push({ tx, kind: "issue", userId: data.userId });
            state.sessions.push({ id: data.id, userId: data.userId });
            return { id: data.id };
          },
        },
      });
      trace.push({ tx, kind: "commit" });
      return result;
    });
    const app = Fastify();
    try {
      await app.register(fastifyJwt, { secret: "isolated-session-test-secret" });
      await registerAuthRoutes(app);
      const token = app.jwt.sign({ sub: "user-a", email: "a@example.invalid", ...(gate ? { sid: "a1", authProtocol: 2 } : {}) }, { expiresIn: "1h" });
      const recovery = route === "password-recovery/reset";
      const response = await app.inject({
        method: "POST", url: `/api/auth/${route}`,
        headers: recovery ? {} : { authorization: `Bearer ${token}` },
        payload: recovery ? { email: state.user.email, code: "fixture-code", newPassword: "NewPass123" }
          : { currentPassword: "OldPass123", newPassword: "NewPass123" },
      });
      if (conflict) {
        expect(response.statusCode).toBe(409);
        expect(mocks.disconnectUser).not.toHaveBeenCalled();
        expect(state.sessions).toHaveLength(3);
        return;
      }
      expect(response.statusCode).toBe(200);
      if (gate) {
        expect(mocks.disconnectUser).toHaveBeenCalledExactlyOnceWith("user-a");
        expect(trace.findIndex(event => event.kind === "disconnect")).toBeGreaterThan(trace.findIndex(event => event.kind === "commit"));
        if (!recovery) expect(trace.findIndex(event => event.kind === "disconnect")).toBeLessThan(trace.findIndex(event => event.kind === "issue"));
      } else expect(mocks.disconnectUser).not.toHaveBeenCalled();
      expect(state.sessions.filter(session => session.userId === "user-b")).toEqual([{ id: "b1", userId: "user-b" }]);
      expect(state.sessions.some(session => session.id === "a1" || session.id === "a2")).toBe(false);
      expect(state.sessions.filter(session => session.userId === "user-a")).toHaveLength(recovery ? 0 : 1);
      const update = trace.find(event => event.kind === "update");
      const revoke = trace.find(event => event.kind === "revoke");
      expect(update).toMatchObject({ userId: "user-a" });
      expect(revoke).toMatchObject({ userId: "user-a", tx: update?.tx });
    } finally {
      await app.close();
    }
  });
});
