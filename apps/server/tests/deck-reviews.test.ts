import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { approvedDeckRenderSelector, registerDeckReviewRoutes } from "../src/routes/deckReviews.js";

describe("deck review route security", () => {
  it("guards and rate-limits every endpoint", () => {
    const app = Fastify();
    const routes = new Map<string, { guards: string[]; max?: number; bodyLimit?: number }>();
    app.addHook("onRoute", (route) => {
      if (!route.url.includes("deck-reviews")) return;
      const guards = Array.isArray(route.onRequest) ? route.onRequest : route.onRequest ? [route.onRequest] : [];
      routes.set(`${route.method}:${route.url}`, {
        guards: guards.map((guard) => guard.name),
        max: (route.config?.rateLimit as { max?: number } | undefined)?.max,
        bodyLimit: route.bodyLimit,
      });
    });
    registerDeckReviewRoutes(app);
    expect(routes.get("GET:/api/servers/:id/deck-reviews")).toEqual({ guards: ["requireJwt"], max: 60, bodyLimit: undefined });
    expect(routes.get("POST:/api/servers/:id/deck-reviews/import")).toEqual({
      guards: ["requireJwt"],
      max: 10,
      bodyLimit: 128 * 1024 + 1_024,
    });
    expect(routes.get("POST:/api/servers/:id/deck-reviews/:reviewId/render")).toEqual({ guards: ["requireJwt"], max: 5, bodyLimit: undefined });
    expect(routes.get("PATCH:/api/servers/:id/deck-reviews/:reviewId")).toEqual({ guards: ["requireJwt"], max: 30, bodyLimit: undefined });
  });
  it("binds render lookup to tenant and approved state", () => {
    expect(approvedDeckRenderSelector("server-a", "review-b")).toEqual({
      id: "review-b",
      serverId: "server-a",
      reviewStatus: "APPROVED",
    });
  });
});
