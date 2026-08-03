import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ECOSYSTEM_PUBLIC_PROBES,
  collectEcosystemHealth,
  getEcosystemHealthSnapshot,
  probePublicService,
  resetEcosystemHealthCacheForTests,
} from "../src/lib/ecosystemHealth.js";

const checkedAt = "2026-08-03T12:00:00.000Z";
const firstProbe = ECOSYSTEM_PUBLIC_PROBES[0];

afterEach(() => {
  resetEcosystemHealthCacheForTests();
  vi.restoreAllMocks();
});

describe("ecosystem health", () => {
  it("keeps every remote target on a fixed public HTTPS allowlist", () => {
    expect(ECOSYSTEM_PUBLIC_PROBES).toHaveLength(4);
    for (const probe of ECOSYSTEM_PUBLIC_PROBES) {
      const target = new URL(probe.probeUrl);
      expect(target.protocol).toBe("https:");
      expect(target.username).toBe("");
      expect(target.password).toBe("");
      expect(["localhost", "127.0.0.1", "::1"]).not.toContain(target.hostname);
    }
  });

  it("reports a successful public probe without reading its body", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const result = await probePublicService(firstProbe, {
      checkedAt,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.status).toBe("operational");
    expect(result.evidence).toContain("HTTP 204");
    expect(fetchImpl).toHaveBeenCalledWith(
      firstProbe.probeUrl,
      expect.objectContaining({ method: "HEAD", redirect: "manual" }),
    );
  });

  it("does not follow redirects", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 307,
      headers: { Location: "http://127.0.0.1/private" },
    }));
    const result = await probePublicService(firstProbe, {
      checkedAt,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.status).toBe("degraded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back from unsupported HEAD to a bounded GET", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const result = await probePublicService(firstProbe, {
      checkedAt,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.status).toBe("operational");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "manual" }),
    );
  });

  it("turns network failures into a sanitized offline state", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.8:443 secret-host");
    });
    const result = await probePublicService(firstProbe, {
      checkedAt,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.status).toBe("offline");
    expect(result.evidence).toBe("Public surface недоступен из production-сети.");
    expect(result.evidence).not.toContain("10.0.0.8");
  });

  it("separates product maturity, runtime health and local-only nodes", async () => {
    const snapshot = await collectEcosystemHealth({
      checkDatabase: async () => undefined,
      getGatewayTelemetry: async () => ({
        state: "ready",
        windows: { "24h": { slo: { status: "healthy" } } },
      }),
      fetchImpl: vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch,
      now: () => new Date(checkedAt),
    });

    expect(snapshot.services).toHaveLength(6);
    expect(snapshot.services.find((service) => service.id === "eclipse-dnd-forge")).toMatchObject({
      maturity: "prototype",
      status: "operational",
    });
    expect(snapshot.services.find((service) => service.id === "hopson-sentinel")).toMatchObject({
      maturity: "beta",
      status: "unconfigured",
      openUrl: null,
    });
    expect(snapshot.integrations.find((item) => item.id === "chat-ai-gateway")).toMatchObject({
      stage: "experimental",
      status: "operational",
    });
  });

  it("caches normal reads and lets an explicit refresh bypass the cache", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch;
    const dependencies = {
      checkDatabase: vi.fn(async () => undefined),
      getGatewayTelemetry: vi.fn(async () => ({ state: "not_configured" as const })),
      fetchImpl,
      now: () => new Date(checkedAt),
    };

    await getEcosystemHealthSnapshot(dependencies);
    await getEcosystemHealthSnapshot(dependencies);
    expect(fetchImpl).toHaveBeenCalledTimes(4);

    await getEcosystemHealthSnapshot({ ...dependencies, force: true });
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });
});
