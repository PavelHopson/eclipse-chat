import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerServerRoutes } from "../src/routes/servers.js";
import { registerChannelRoutes } from "../src/routes/channels.js";
import { registerVisitRoutes } from "../src/routes/visits.js";
import { registerMemoryRoutes } from "../src/routes/memory.js";
import { registerPersonalDigestRoutes } from "../src/routes/personalDigest.js";
import { registerActionRoutes } from "../src/routes/actions.js";
import { registerPlatformRoutes } from "../src/routes/platform.js";
import { registerEcosystemIdentityRoutes } from "../src/routes/ecosystemIdentity.js";

describe("server route registration", () => {
  it("protects ecosystem authorization and rate-limits both PKCE steps", async () => {
    const app = Fastify();
    const routes = new Map<
      string,
      { guards: string[]; rateLimit?: { max?: number; timeWindow?: number } }
    >();
    app.addHook("onRoute", (route) => {
      if (!["/api/ecosystem/authorize", "/api/ecosystem/token"].includes(route.url)) return;
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      routes.set(route.url, {
        guards: routeGuards.map((guard) => guard.name),
        rateLimit: route.config?.rateLimit as
          | { max?: number; timeWindow?: number }
          | undefined,
      });
    });

    await registerEcosystemIdentityRoutes(app);
    expect(routes.get("/api/ecosystem/authorize")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 20, timeWindow: 5 * 60 * 1000 },
    });
    expect(routes.get("/api/ecosystem/token")).toEqual({
      guards: [],
      rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 },
    });
  });

  it("protects ecosystem health with owner auth and a bounded probe limit", async () => {
    const app = Fastify();
    let guards: string[] = [];
    let rateLimit: { max?: number; timeWindow?: number } | undefined;
    app.addHook("onRoute", (route) => {
      if (route.method !== "GET" || route.url !== "/api/platform/ecosystem/health") return;
      const routeGuards = Array.isArray(route.preHandler)
        ? route.preHandler
        : route.preHandler
          ? [route.preHandler]
          : [];
      guards = routeGuards.map((guard) => guard.name);
      rateLimit = route.config?.rateLimit as typeof rateLimit;
    });

    await registerPlatformRoutes(app);
    expect(guards).toEqual(["requireJwt", "requirePlatformOwner"]);
    expect(rateLimit).toEqual({ max: 12, timeWindow: 60 * 1000 });
  });

  it("protects platform user administration and rate-limits password recovery", async () => {
    const app = Fastify();
    const routes = new Map<
      string,
      { guards: string[]; rateLimit?: { max?: number; timeWindow?: number } }
    >();
    app.addHook("onRoute", (route) => {
      if (!route.url.startsWith("/api/platform/users")) return;
      const routeGuards = Array.isArray(route.preHandler)
        ? route.preHandler
        : route.preHandler
          ? [route.preHandler]
          : [];
      routes.set(`${route.method}:${route.url}`, {
        guards: routeGuards.map((guard) => guard.name),
        rateLimit: route.config?.rateLimit as
          | { max?: number; timeWindow?: number }
          | undefined,
      });
    });

    await registerPlatformRoutes(app);

    expect(routes.size).toBeGreaterThanOrEqual(6);
    for (const route of routes.values()) {
      expect(route.guards).toEqual(["requireJwt", "requirePlatformOwner"]);
    }
    expect(routes.get("POST:/api/platform/users/:id/reset-password")?.rateLimit).toEqual({
      max: 10,
      timeWindow: 15 * 60 * 1000,
    });
  });

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

  it("protects personal digest reads and cursor acknowledgement", async () => {
    const app = Fastify();
    const routes = new Map<
      string,
      { guards: string[]; rateLimit?: { max?: number; timeWindow?: number } }
    >();
    app.addHook("onRoute", (route) => {
      if (!["/api/me/digest", "/api/me/digest/acknowledge"].includes(route.url)) return;
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      routes.set(route.url, {
        guards: routeGuards.map((guard) => guard.name),
        rateLimit: route.config?.rateLimit as
          | { max?: number; timeWindow?: number }
          | undefined,
      });
    });

    await registerPersonalDigestRoutes(app);
    expect(routes.get("/api/me/digest")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 60, timeWindow: 60 * 1000 },
    });
    expect(routes.get("/api/me/digest/acknowledge")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 20, timeWindow: 5 * 60 * 1000 },
    });
  });

  it("protects action updates and atomic inbox claims with bounded mutation limits", async () => {
    const app = Fastify();
    const routes = new Map<
      string,
      { guards: string[]; rateLimit?: { max?: number; timeWindow?: number } }
    >();
    app.addHook("onRoute", (route) => {
      if (!["/api/actions/:id", "/api/actions/:id/claim"].includes(route.url)) return;
      if (route.method !== "PATCH" && route.method !== "POST") return;
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      routes.set(`${route.method}:${route.url}`, {
        guards: routeGuards.map((guard) => guard.name),
        rateLimit: route.config?.rateLimit as
          | { max?: number; timeWindow?: number }
          | undefined,
      });
    });

    await registerActionRoutes(app);
    expect(routes.get("PATCH:/api/actions/:id")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 },
    });
    expect(routes.get("POST:/api/actions/:id/claim")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 40, timeWindow: 5 * 60 * 1000 },
    });
  });

  it("protects message action creation with auth and a bounded mutation limit", async () => {
    const app = Fastify();
    let guards: string[] = [];
    let rateLimit: { max?: number; timeWindow?: number } | undefined;
    app.addHook("onRoute", (route) => {
      if (route.method !== "POST" || route.url !== "/api/messages/:id/actions") return;
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      guards = routeGuards.map((guard) => guard.name);
      rateLimit = route.config?.rateLimit as typeof rateLimit;
    });

    await registerActionRoutes(app);
    expect(guards).toEqual(["requireJwt"]);
    expect(rateLimit).toEqual({ max: 60, timeWindow: 5 * 60 * 1000 });
  });

  it("protects memory suggestions and writes with bounded rate limits", async () => {
    const app = Fastify();
    const routes = new Map<
      string,
      { guards: string[]; rateLimit?: { max?: number; timeWindow?: number } }
    >();
    app.addHook("onRoute", (route) => {
      if (
        route.method !== "POST" ||
        ![
          "/api/channels/:id/memory",
          "/api/channels/:id/memory/suggest",
          "/api/memory/:id/review",
          "/api/memory/:id/restore",
        ].includes(route.url)
      ) {
        return;
      }
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      routes.set(route.url, {
        guards: routeGuards.map((guard) => guard.name),
        rateLimit: route.config?.rateLimit as
          | { max?: number; timeWindow?: number }
          | undefined,
      });
    });

    await registerMemoryRoutes(app);
    expect(routes.get("/api/channels/:id/memory/suggest")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 20, timeWindow: 15 * 60 * 1000 },
    });
    expect(routes.get("/api/channels/:id/memory")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 },
    });
    expect(routes.get("/api/memory/:id/review")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 },
    });
    expect(routes.get("/api/memory/:id/restore")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 },
    });
  });

  it("protects memory update and archive endpoints with the same mutation limit", async () => {
    const app = Fastify();
    const routes = new Map<
      string,
      { guards: string[]; rateLimit?: { max?: number; timeWindow?: number } }
    >();
    app.addHook("onRoute", (route) => {
      if (route.url !== "/api/memory/:id") return;
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      const routeGuards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      for (const method of methods) {
        if (method !== "PATCH" && method !== "DELETE") continue;
        routes.set(method, {
          guards: routeGuards.map((guard) => guard.name),
          rateLimit: route.config?.rateLimit as
            | { max?: number; timeWindow?: number }
            | undefined,
        });
      }
    });

    await registerMemoryRoutes(app);
    for (const method of ["PATCH", "DELETE"]) {
      expect(routes.get(method)).toEqual({
        guards: ["requireJwt"],
        rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 },
      });
    }
  });
});
