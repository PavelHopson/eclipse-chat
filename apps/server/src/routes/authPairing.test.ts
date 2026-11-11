import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/requireJwt.js", () => ({
  getUserId: (request: FastifyRequest) => request.headers["x-test-user"] ?? null,
  requireJwt: async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.headers["x-test-user"]) return reply.code(401).send({ error: "Unauthorized" });
  },
}));

import { InMemoryPairingStore, PAIRING_TTL_MS } from "../auth/pairing.js";
import { registerAuthPairingRoutes } from "./authPairing.js";

const targetKey = "ephemeral-public-key-0123456789";

async function makeApp(store = new InMemoryPairingStore()) {
  const app = Fastify({ logger: false });
  await registerAuthPairingRoutes(app, { store });
  return { app, store };
}

async function createChallenge(app: Awaited<ReturnType<typeof makeApp>>["app"], key = targetKey) {
  return app.inject({
    method: "POST",
    url: "/api/auth/pairing/challenge",
    headers: { "x-forwarded-for": "198.51.100.10", "content-type": "application/json" },
    payload: JSON.stringify({ targetKey: key }),
  });
}

describe("QR pairing contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an ephemeral key and returns only an opaque handle, UI code and expiry", async () => {
    const { app } = await makeApp();
    try {
      const invalid = await app.inject({ method: "POST", url: "/api/auth/pairing/challenge", payload: { targetKey: "too-short" } });
      expect(invalid.statusCode).toBe(400);
      const response = await createChallenge(app);
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.challengeHandle).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(body.confirmationCode).toMatch(/^\d{6}$/);
      expect(body.expiresAt).toBeTruthy();
      expect(body).not.toHaveProperty("accessToken");
      expect(body).not.toHaveProperty("refreshToken");
      expect(body).not.toHaveProperty("targetKey");
      expect(response.headers["cache-control"]).toBe("no-store");
    } finally { await app.close(); }
  });

  it("requires an authorized session for explicit approval and exchanges once for the bound key", async () => {
    const { app } = await makeApp();
    try {
      const created = await createChallenge(app);
      const { challengeHandle, confirmationCode } = created.json();
      const unauthenticated = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/approve`, payload: { code: confirmationCode } });
      expect(unauthenticated.statusCode).toBe(401);
      const approved = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/approve`, headers: { "x-test-user": "user-1" }, payload: { code: confirmationCode } });
      expect(approved.statusCode).toBe(200);
      expect(approved.json()).toEqual({ ok: true, status: "approved" });
      const exchanged = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/exchange`, payload: { targetKey } });
      expect(exchanged.statusCode).toBe(200);
      expect(exchanged.json()).toMatchObject({ status: "exchanged", targetKeyBound: true, sessionTransfer: "not_issued" });
      expect(exchanged.json()).not.toHaveProperty("accessToken");
      expect(exchanged.json()).not.toHaveProperty("refreshToken");
      const replay = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/exchange`, payload: { targetKey } });
      expect(replay.statusCode).toBe(409);
    } finally { await app.close(); }
  });

  it("rejects a different target key before consuming the approved challenge", async () => {
    const { app } = await makeApp();
    try {
      const created = await createChallenge(app);
      const { challengeHandle, confirmationCode } = created.json();
      await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/approve`, headers: { "x-test-user": "user-1" }, payload: { code: confirmationCode } });
      const mismatch = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/exchange`, payload: { targetKey: "another-ephemeral-key-0123456789" } });
      expect(mismatch.statusCode).toBe(400);
      const valid = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/exchange`, payload: { targetKey } });
      expect(valid.statusCode).toBe(200);
    } finally { await app.close(); }
  });

  it("expires and can be revoked only by the approving user", async () => {
    let now = 1_000_000;
    const store = new InMemoryPairingStore(() => now);
    const { app } = await makeApp(store);
    try {
      const created = await createChallenge(app);
      const { challengeHandle, confirmationCode } = created.json();
      const wrongRevoke = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/revoke`, headers: { "x-test-user": "other" } });
      expect(wrongRevoke.statusCode).toBe(403);
      const revoked = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/revoke`, headers: { "x-test-user": "user-1" } });
      expect(revoked.statusCode).toBe(403);
      await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/approve`, headers: { "x-test-user": "user-1" }, payload: { code: confirmationCode } });
      const approvedRevoke = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/revoke`, headers: { "x-test-user": "user-1" } });
      expect(approvedRevoke.statusCode).toBe(200);
      const revokedExchange = await app.inject({ method: "POST", url: `/api/auth/pairing/${challengeHandle}/exchange`, payload: { targetKey } });
      expect(revokedExchange.statusCode).toBe(410);

      const second = await createChallenge(app, "ephemeral-public-key-abcdefghijk");
      now += PAIRING_TTL_MS + 1;
      const expired = await app.inject({ method: "POST", url: `/api/auth/pairing/${second.json().challengeHandle}/exchange`, payload: { targetKey: "ephemeral-public-key-abcdefghijk" } });
      expect(expired.statusCode).toBe(410);
    } finally { await app.close(); }
  });

  it("rate-limits challenge creation per source without exposing stored state", async () => {
    const { app } = await makeApp();
    try {
      for (let i = 0; i < 5; i++) expect((await createChallenge(app, `ephemeral-key-${String(i).padStart(2, "0")}-abcdefghijk`)).statusCode).toBe(200);
      const limited = await createChallenge(app, "ephemeral-key-limited-abcdefghijk");
      expect(limited.statusCode).toBe(429);
    } finally { await app.close(); }
  });

  it("bounds the in-memory store and evicts the least recently used challenge", () => {
    const store = new InMemoryPairingStore(() => Date.now(), { maxChallenges: 2 });
    const first = store.create(targetKey, "source-1");
    const second = store.create("ephemeral-public-key-abcdefghijk", "source-2");

    // Touch the first entry so the second becomes the eviction candidate.
    store.approve(first.handle, first.code, "user-1");
    const third = store.create("ephemeral-public-key-third-123456", "source-3");

    expect(store.challengeCount).toBe(2);
    expect(() => store.exchange(second.handle, "ephemeral-public-key-abcdefghijk")).toThrowError("not_found");
    expect(() => store.exchange(third.handle, "ephemeral-public-key-third-123456")).toThrowError("not_approved");
    expect(store.challengeCount).toBe(2);
  });

  it("declares route-level abuse limits and suppresses raw handle request logs", async () => {
    const routes = new Map<string, { max?: number; timeWindow?: number; logLevel?: string }>();
    const app = Fastify({ logger: false });
    app.addHook("onRoute", (route) => {
      if (!route.url.includes("/api/auth/pairing")) return;
      const rateLimit = route.config?.rateLimit as { max?: number; timeWindow?: number } | undefined;
      routes.set(`${route.method}:${route.url}`, { ...rateLimit, logLevel: route.logLevel });
    });
    await registerAuthPairingRoutes(app);
    try {
      expect(routes.get("POST:/api/auth/pairing/challenge")).toMatchObject({ max: 10, timeWindow: 60_000, logLevel: "silent" });
      expect(routes.get("POST:/api/auth/pairing/:handle/approve")).toMatchObject({ max: 20, timeWindow: 60_000, logLevel: "silent" });
      expect(routes.get("POST:/api/auth/pairing/:handle/exchange")).toMatchObject({ max: 20, timeWindow: 60_000, logLevel: "silent" });
      expect(routes.get("POST:/api/auth/pairing/:handle/revoke")).toMatchObject({ max: 30, timeWindow: 60_000, logLevel: "silent" });
    } finally { await app.close(); }
  });
});
