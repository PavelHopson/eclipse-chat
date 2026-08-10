import { describe, expect, it, vi } from "vitest";
import { createGrowthRunPayload } from "../lib/growthRunContract.js";
import { executeGrowthHubStep, getGrowthHubPolicy, GrowthHubError } from "./growthHub.js";

const TOKEN = "growth-service-token-with-at-least-32-characters";
const RUN = createGrowthRunPayload({
  releaseName: "Eclipse Growth executor",
  releaseSummary: "Пошаговый исполнитель создаёт материал без публикации и внешних действий.",
  audience: "Команда Eclipse Forge",
  channel: "telegram",
  sourceUrls: ["https://example.com/release"],
  evidenceNotes: "Источник проверяется человеком и передаётся модели только как недоверенные данные.",
  evidenceCards: [{
    id: "EF-001",
    claim: "The bounded Growth gateway exists.",
    state: "verified",
    sourceUrl: "https://example.com/release",
    evidenceBoundary: "Источник подтверждает существование, но не customer outcomes.",
  }],
}, "chat:run-1", { provider: "eclipse-ai-hub", model: "auto/best-chat" });

describe("Growth AI Hub client", () => {
  it("fails closed for remote plaintext URLs", () => {
    expect(getGrowthHubPolicy({
      ECLIPSE_GROWTH_HUB_BASE_URL: "http://example.com/v1",
      ECLIPSE_GROWTH_HUB_SERVICE_TOKEN: TOKEN,
    })).toMatchObject({ configured: false, baseUrl: null });
  });

  it("calls only the fixed Growth endpoint with the dedicated bearer token", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("http://127.0.0.1:8810/v1/growth/execute");
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ schemaVersion: "growth.execute.v1", step: "research" });
      expect(body.run.input.evidenceCards).toEqual(RUN.input.evidenceCards);
      expect(body.run).not.toHaveProperty("providerToken");
      return new Response(JSON.stringify({
        schemaVersion: "growth.execute.result.v1",
        step: "research",
        role: "Researcher",
        content: JSON.stringify({
          schemaVersion: "growth.research.v2",
          verifiedFacts: [],
          hypotheses: [],
          unknowns: [{ question: "Есть ли спрос?", whyItMatters: "Спрос пока не измерен." }],
        }),
        provider: "eclipse-ai-hub",
        model: "selected-model",
        usage: { promptTokens: 100, completionTokens: 20 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const result = await executeGrowthHubStep(RUN, "research", {
      fetchImpl: fetchImpl as typeof fetch,
      env: {
        ECLIPSE_GROWTH_HUB_BASE_URL: "http://127.0.0.1:8810/v1",
        ECLIPSE_GROWTH_HUB_SERVICE_TOKEN: TOKEN,
      },
    });
    expect(result.role).toBe("Researcher");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("maps an explicit caller abort to a safe cancellation", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const controller = new AbortController();
    const pending = executeGrowthHubStep(RUN, "research", {
      fetchImpl: fetchImpl as typeof fetch,
      signal: controller.signal,
      env: {
        ECLIPSE_GROWTH_HUB_BASE_URL: "http://127.0.0.1:8810/v1",
        ECLIPSE_GROWTH_HUB_SERVICE_TOKEN: TOKEN,
      },
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "cancelled" } satisfies Partial<GrowthHubError>);
  });
});
