import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerServerRoutes } from "../src/routes/servers.js";
import { registerChannelRoutes } from "../src/routes/channels.js";
import { registerVisitRoutes } from "../src/routes/visits.js";

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

  it("protects expensive retrieval with auth and a bounded rate limit", async () => {
    const app = Fastify();
    let guards: string[] = [];
    let rateLimit: { max?: number; timeWindow?: number } | undefined;
    app.addHook("onRoute", (route) => {
      if (route.method !== "POST" || route.url !== "/api/servers/:id/search/semantic") return;
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      guards = routeGuards.map((guard) => guard.name);
      rateLimit = route.config?.rateLimit as typeof rateLimit;
    });

    await registerServerRoutes(app);
    expect(guards).toContain("requireJwt");
    expect(rateLimit).toEqual({ max: 30, timeWindow: 5 * 60 * 1000 });
  });

  it("does not expose channel history without authentication", async () => {
    const app = Fastify();
    let guards: string[] = [];
    app.addHook("onRoute", (route) => {
      if (route.method !== "GET" || route.url !== "/api/channels/:id/messages") return;
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      guards = routeGuards.map((guard) => guard.name);
    });

    await registerChannelRoutes(app);
    expect(guards).toContain("requireJwt");
  });

  it("protects digest generation with auth and a bounded rate limit", async () => {
    const app = Fastify();
    let guards: string[] = [];
    let rateLimit: { max?: number; timeWindow?: number } | undefined;
    app.addHook("onRoute", (route) => {
      if (route.method !== "POST" || route.url !== "/api/channels/:id/since-summary") return;
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      guards = routeGuards.map((guard) => guard.name);
      rateLimit = route.config?.rateLimit as typeof rateLimit;
    });

    await registerVisitRoutes(app);
    expect(guards).toContain("requireJwt");
    expect(rateLimit).toEqual({ max: 10, timeWindow: 5 * 60 * 1000 });
  });
});
