import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerServerRoutes } from "../src/routes/servers.js";

describe("server route registration", () => {
  it("registers every server route exactly once", async () => {
    const app = Fastify();

    await expect(registerServerRoutes(app)).resolves.toBeUndefined();
    expect(
      app.hasRoute({
        method: "GET",
        url: "/api/servers/:id/audit-log",
      }),
    ).toBe(true);
  });
});
