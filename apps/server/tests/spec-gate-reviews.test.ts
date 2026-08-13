import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { MAX_SPEC_GATE_IMPORT_BYTES } from "../src/lib/specGateContract.js";
import { registerSpecGateReviewRoutes, specGateReviewSelector } from "../src/routes/specGateReviews.js";

describe("Spec Gate review route security", () => {
  it("guards, rate-limits and bounds every endpoint", () => {
    const app = Fastify();
    const routes = new Map<string, { guards: string[]; max?: number; bodyLimit?: number }>();
    app.addHook("onRoute", (route) => {
      if (!route.url.includes("spec-gate-reviews")) return;
      const guards = Array.isArray(route.onRequest) ? route.onRequest : route.onRequest ? [route.onRequest] : [];
      routes.set(`${route.method}:${route.url}`, {
        guards: guards.map((guard) => guard.name),
        max: (route.config?.rateLimit as { max?: number } | undefined)?.max,
        bodyLimit: route.bodyLimit,
      });
    });
    registerSpecGateReviewRoutes(app);
    expect(routes.get("GET:/api/servers/:id/spec-gate-reviews")).toEqual({ guards: ["requireJwt"], max: 60, bodyLimit: undefined });
    expect(routes.get("POST:/api/servers/:id/spec-gate-reviews/import")).toEqual({
      guards: ["requireJwt"], max: 10, bodyLimit: MAX_SPEC_GATE_IMPORT_BYTES + 1_024,
    });
    expect(routes.get("PATCH:/api/servers/:id/spec-gate-reviews/:reviewId")).toEqual({ guards: ["requireJwt"], max: 30, bodyLimit: undefined });
  });

  it("binds every review lookup to the tenant", () => {
    expect(specGateReviewSelector("server-a", "review-b")).toEqual({ id: "review-b", serverId: "server-a" });
  });
});