import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { builderReviewSelector, registerBuilderReviewRoutes } from "../src/routes/builderReviews.js";

describe("builder review route security", () => {
  it("guards and rate-limits every endpoint", () => {
    const app = Fastify();
    const routes = new Map<string, { guards: string[]; max?: number; bodyLimit?: number }>();
    app.addHook("onRoute", (route) => {
      if (!route.url.includes("builder-reviews")) return;
      const guards = Array.isArray(route.onRequest) ? route.onRequest : route.onRequest ? [route.onRequest] : [];
      routes.set(`${route.method}:${route.url}`, {
        guards: guards.map((guard) => guard.name),
        max: (route.config?.rateLimit as { max?: number } | undefined)?.max,
        bodyLimit: route.bodyLimit,
      });
    });
    registerBuilderReviewRoutes(app);
    expect(routes.get("GET:/api/servers/:id/builder-reviews")).toEqual({ guards: ["requireJwt"], max: 60, bodyLimit: undefined });
    expect(routes.get("POST:/api/servers/:id/builder-reviews/import")).toEqual({
      guards: ["requireJwt"],
      max: 10,
      bodyLimit: 128 * 1024 + 1_024,
    });
    expect(routes.get("PATCH:/api/servers/:id/builder-reviews/:reviewId")).toEqual({ guards: ["requireJwt"], max: 30, bodyLimit: undefined });
  });

  it("binds every review lookup to the tenant", () => {
    expect(builderReviewSelector("server-a", "review-b")).toEqual({ id: "review-b", serverId: "server-a" });
  });
});
