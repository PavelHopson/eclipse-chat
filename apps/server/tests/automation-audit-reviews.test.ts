import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { MAX_AUTOMATION_AUDIT_IMPORT_BYTES } from "../src/lib/automationAuditContract.js";
import { automationAuditReviewSelector, registerAutomationAuditReviewRoutes } from "../src/routes/automationAuditReviews.js";

describe("automation audit route security", () => {
  it("guards, rate-limits and bounds every endpoint", () => {
    const app = Fastify(); const routes = new Map<string, { guards: string[]; max?: number; bodyLimit?: number }>();
    app.addHook("onRoute", (route) => { if (!route.url.includes("automation-audit-reviews")) return; const guards = Array.isArray(route.onRequest) ? route.onRequest : route.onRequest ? [route.onRequest] : []; routes.set(`${route.method}:${route.url}`, { guards: guards.map((guard) => guard.name), max: (route.config?.rateLimit as { max?: number } | undefined)?.max, bodyLimit: route.bodyLimit }); });
    registerAutomationAuditReviewRoutes(app);
    expect(routes.get("GET:/api/servers/:id/automation-audit-reviews")).toEqual({ guards: ["requireJwt"], max: 60, bodyLimit: undefined });
    expect(routes.get("POST:/api/servers/:id/automation-audit-reviews/import")).toEqual({ guards: ["requireJwt"], max: 10, bodyLimit: MAX_AUTOMATION_AUDIT_IMPORT_BYTES + 1024 });
    expect(routes.get("PATCH:/api/servers/:id/automation-audit-reviews/:reviewId")).toEqual({ guards: ["requireJwt"], max: 30, bodyLimit: undefined });
  });
  it("binds lookups to tenant", () => expect(automationAuditReviewSelector("server-a", "review-b")).toEqual({ id: "review-b", serverId: "server-a" }));
});
