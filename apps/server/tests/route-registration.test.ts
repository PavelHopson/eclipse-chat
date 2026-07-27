import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerServerRoutes } from "../src/routes/servers.js";

describe("server route registration", () => {
  it("registers every server route exactly once", async () => {
    const app = Fastify();
    let createServerGuards: string[] = [];
    app.addHook("onRoute", (route) => {
      if (route.method === "POST" && route.url === "/api/servers") {
        const guards = Array.isArray(route.onRequest)
          ? route.onRequest
          : route.onRequest
            ? [route.onRequest]
            : [];
        createServerGuards = guards.map((guard) => guard.name);
      }
    });

    await expect(registerServerRoutes(app)).resolves.toBeUndefined();
    expect(
      app.hasRoute({
        method: "GET",
        url: "/api/servers/:id/audit-log",
      }),
    ).toBe(true);
    expect(createServerGuards).toEqual(["requireJwt", "requirePlatformOwner"]);
  });
});
