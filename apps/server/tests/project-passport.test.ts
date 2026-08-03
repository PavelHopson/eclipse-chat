import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { parseGitHubIntegrationConfig } from "../src/lib/integrations/config.js";
import {
  deriveProjectPassportHealth,
  filterProjectPassportChannels,
  firstSafeExternalUrl,
  isPassportDocument,
  parseVerifiedGitHubEvent,
  selectProjectPassportNextAction,
  type PassportActionSignal,
} from "../src/lib/projectPassport.js";
import { registerProjectPassportRoutes } from "../src/routes/projectPassport.js";

const baseAction: PassportActionSignal = {
  id: "action-1",
  type: "TASK",
  status: "OPEN",
  priority: "NORMAL",
  dueAt: null,
  escalatedAt: null,
  channelId: "public-room",
};

describe("project passport security boundary", () => {
  it("registers an authenticated and rate-limited read endpoint", () => {
    const app = Fastify();
    const routes = new Map<string, { guards: string[]; max?: number }>();
    app.addHook("onRoute", (route) => {
      if (route.url !== "/api/servers/:id/project-passport") return;
      const guards = Array.isArray(route.onRequest)
        ? route.onRequest
        : route.onRequest
          ? [route.onRequest]
          : [];
      routes.set(`${route.method}:${route.url}`, {
        guards: guards.map((guard) => guard.name),
        max: (route.config?.rateLimit as { max?: number } | undefined)?.max,
      });
    });

    registerProjectPassportRoutes(app);

    expect(routes.get("GET:/api/servers/:id/project-passport")).toEqual({
      guards: ["requireJwt"],
      max: 60,
    });
  });

  it("removes internal rooms for client members before any source is aggregated", () => {
    const channels = [
      { id: "public-room", internal: false },
      { id: "private-room", internal: true },
    ];

    expect(filterProjectPassportChannels("CLIENT", "CLIENT", channels)).toEqual([
      { id: "public-room", internal: false },
    ]);
    expect(filterProjectPassportChannels("CLIENT", "OWNER", channels)).toEqual(channels);
  });

  it("returns only a canonical repository from stored integration config", () => {
    const stored = JSON.stringify({
      repository: "PavelHopson/eclipse-chat",
      token: "must-never-leave-the-server",
    });

    const parsed = parseGitHubIntegrationConfig(stored);
    expect(parsed).toEqual({ repository: "PavelHopson/eclipse-chat" });
    expect(JSON.stringify(parsed)).not.toContain("must-never-leave-the-server");
  });

  it("accepts only verified bounded GitHub events and pins links to github.com", () => {
    const event = parseVerifiedGitHubEvent({
      source: "github",
      verified: true,
      kind: "workflow",
      repository: "PavelHopson/eclipse-chat",
      title: "Security Gate",
      summary: "Checks failed",
      actor: "github-actions[bot]",
      ref: "master",
      status: "failure",
      sourceUrl: "https://attacker.example/phishing",
      occurredAt: "2026-08-03T12:00:00.000Z",
      details: [],
    });

    expect(event?.sourceUrl).toBe("https://github.com/PavelHopson/eclipse-chat");
    expect(parseVerifiedGitHubEvent({ ...event, verified: false })).toBeNull();
  });
});

describe("project passport operational summary", () => {
  it("surfaces a critical risk as the project blocker and next action", () => {
    const risk: PassportActionSignal = {
      ...baseAction,
      id: "risk-1",
      type: "RISK",
      priority: "URGENT",
    };

    expect(deriveProjectPassportHealth([risk], [])).toMatchObject({
      state: "BLOCKED",
      activeRiskCount: 1,
    });
    expect(selectProjectPassportNextAction([risk], [], ["public-room"])).toMatchObject({
      kind: "ACTION",
      actionItemId: "risk-1",
      channelId: "public-room",
    });
  });

  it("does not keep a stale failed deploy after a newer success for the same repository", () => {
    const deploys = [
      {
        repository: "PavelHopson/eclipse-chat",
        status: "success" as const,
        sourceUrl: "https://github.com/PavelHopson/eclipse-chat/actions/runs/2",
        occurredAt: "2026-08-03T13:00:00.000Z",
      },
      {
        repository: "PavelHopson/eclipse-chat",
        status: "failure" as const,
        sourceUrl: "https://github.com/PavelHopson/eclipse-chat/actions/runs/1",
        occurredAt: "2026-08-03T12:00:00.000Z",
      },
    ];

    expect(deriveProjectPassportHealth([], deploys).state).toBe("ON_TRACK");
  });

  it("recognizes curated documents and strips credentials from links", () => {
    expect(isPassportDocument("NOTE", ["runbook"])).toBe(true);
    expect(isPassportDocument("NOTE", ["random"])).toBe(false);
    expect(firstSafeExternalUrl("Runbook: https://user:pass@example.test/ops")).toBe(
      "https://example.test/ops",
    );
  });
});
