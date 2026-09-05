import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() }));
vi.mock("../db.js", () => ({ db: { userAppearance: mocks } }));
vi.mock("../auth/requireJwt.js", () => ({
  getUserId: (request: FastifyRequest) => request.headers["x-test-user"] ?? null,
  requireJwt: async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.headers["x-test-user"]) return reply.code(401).send({ error: "Unauthorized" });
  },
}));
import { appearanceBody, registerAppearanceRoutes } from "./appearance.js";
const palette = { accent: "#6ba3ff", secondary: "#d4af37", background: "#05070a", surface: "#0c1117", text: "#f2f5f9", border: "#1c2536" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue({});
  mocks.deleteMany.mockResolvedValue({ count: 0 });
});
async function request(method: "GET" | "PUT", body?: unknown, user: string | null = "alice", query = "") {
  const app = Fastify({ logger: false });
  await registerAppearanceRoutes(app);
  try {
    return await app.inject({ method, url: "/api/users/me/appearance" + query,
      headers: { ...(user ? { "x-test-user": user } : {}), ...(method === "PUT" ? { "content-type": "application/json" } : {}) },
      ...(method === "PUT" ? { payload: JSON.stringify(body) } : {}),
    });
  } finally { await app.close(); }
}
describe("private account appearance", () => {
  it.each(["GET", "PUT"] as const)("requires authentication for %s", async method => {
    expect((await request(method, { palette }, null)).statusCode).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("reads only the authenticated account, ignoring foreign query IDs", async () => {
    const response = await request("GET", undefined, "alice", "?userId=bob");
    expect(response.json()).toEqual({ palette: null });
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { userId: "alice" }, select: { palette: true } });
  });
  it("saves exactly six colors only for the authenticated account", async () => {
    const response = await request("PUT", { palette }, "bob");
    expect(response.statusCode).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith({ where: { userId: "bob" }, create: { userId: "bob", palette: JSON.stringify(palette) }, update: { palette: JSON.stringify(palette) } });
  });
  it("resets only the current account and is idempotent", async () => {
    expect((await request("PUT", { palette: null })).statusCode).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "alice" } });
  });
  it.each([undefined, {}, { palette, userId: "bob" }, { palette: { ...palette, isAdmin: true } }, { palette: { accent: "#123456" } }])("rejects missing or extra fields: %j", async body => {
    expect((await request("PUT", body)).statusCode).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it.each(["<svg onload=alert(1)>", "url(https://invalid.test)", "#ffffff;--x:red", "#fff", "red", "#ffffff00", 123, null])("rejects CSS/HTML and non-HEX colors: %s", value => {
    expect(appearanceBody.safeParse({ palette: { ...palette, accent: value } }).success).toBe(false);
  });
  it.each([{ background: "#ffffff" }, { surface: "#eeeeee" }, { text: "#111111" }])("rejects light or unreadable palettes: %j", async change => {
    expect((await request("PUT", { palette: { ...palette, ...change } })).statusCode).toBe(400);
  });
  it.each(["broken-json", '{"accent":"url(evil)"}'])("recovers safely from corrupt stored settings: %s", async stored => {
    mocks.findUnique.mockResolvedValue({ palette: stored });
    expect((await request("GET")).json()).toEqual({ palette: null });
  });
  it("normalizes upper-case HEX", () => {
    expect(appearanceBody.parse({ palette: { ...palette, accent: "#ABCDEF" } }).palette?.accent).toBe("#abcdef");
  });
  it("limits body size", async () => {
    expect((await request("PUT", { palette, excess: "x".repeat(1100) })).statusCode).toBe(413);
  });
  it("rate limits preference requests", async () => {
    const app = Fastify({ logger: false });
    await app.register(rateLimit, { global: false });
    await registerAppearanceRoutes(app);
    try {
      for (let i = 0; i < 30; i++) expect((await app.inject({ url: "/api/users/me/appearance", headers: { "x-test-user": "alice" } })).statusCode).toBe(200);
      expect((await app.inject({ url: "/api/users/me/appearance", headers: { "x-test-user": "alice" } })).statusCode).toBe(429);
    } finally { await app.close(); }
  });
});
