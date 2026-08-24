import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerSafeErrorHandler } from "./safeErrorHandler.js";

describe("safe Fastify error boundary", () => {
  it("never returns an internal exception message or stack", async () => {
    const app = Fastify({ logger: false });
    registerSafeErrorHandler(app);
    app.get("/boom", async () => {
      throw new Error("postgres://admin:secret-password@internal-db/private");
    });

    const response = await app.inject({ method: "GET", url: "/boom" });
    await app.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "Internal Server Error",
      code: "internal_error",
    });
    expect(response.body).not.toMatch(/secret|password|postgres|internal-db|stack/i);
  });

  it("preserves safe client status while replacing attacker-controlled messages", async () => {
    const app = Fastify({ logger: false });
    registerSafeErrorHandler(app);
    app.get("/invalid", async () => {
      const error = new Error("client supplied private payload") as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 400;
      error.code = "FST_ERR_VALIDATION";
      throw error;
    });

    const response = await app.inject({ method: "GET", url: "/invalid" });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid request",
      code: "FST_ERR_VALIDATION",
    });
    expect(response.body).not.toContain("private payload");
  });
});