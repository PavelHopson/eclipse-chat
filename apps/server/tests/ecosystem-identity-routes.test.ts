import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerEcosystemIdentityRoutes } from "../src/routes/ecosystemIdentity.js";
import { EcosystemIdentityService } from "../src/security/ecosystemIdentity.js";

describe("ecosystem identity routes", () => {
  it("authenticates consent, rate-limits both grants and keeps JWKS public", async () => {
    const app = Fastify();
    const routes = new Map<string, {
      guards: string[];
      rateLimit?: { max?: number; timeWindow?: number };
    }>();
    app.addHook("onRoute", (route) => {
      if (!route.url.startsWith("/api/ecosystem/")) return;
      const guards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      routes.set(`${route.method}:${route.url}`, {
        guards: guards.map((guard) => guard.name),
        rateLimit: route.config?.rateLimit as { max?: number; timeWindow?: number } | undefined,
      });
    });

    await registerEcosystemIdentityRoutes(app, new EcosystemIdentityService({
      ECOSYSTEM_IDENTITY_ISSUER: "https://chat.example.test",
      ECOSYSTEM_IDENTITY_REDIRECT_URIS: "https://dnd.example.test/",
    }));

    expect(routes.get("POST:/api/ecosystem/authorize")).toEqual({
      guards: ["requireJwt"],
      rateLimit: { max: 20, timeWindow: 5 * 60 * 1000 },
    });
    expect(routes.get("POST:/api/ecosystem/token")).toEqual({
      guards: [],
      rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 },
    });
    expect(routes.get("GET:/api/ecosystem/.well-known/jwks.json")?.guards).toEqual([]);
  });
});
