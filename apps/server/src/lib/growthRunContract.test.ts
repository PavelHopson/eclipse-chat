import { describe, expect, it } from "vitest";
import {
  appendGrowthArtifact,
  createGrowthRunPayload,
  GROWTH_STEP_DEFINITIONS,
  parseGrowthRunImport,
  parseStoredGrowthRun,
} from "./growthRunContract.js";

const INPUT = {
  releaseName: "Eclipse Growth executor",
  releaseSummary: "Пошаговый исполнитель создаёт материал без публикации и внешних действий.",
  audience: "Команда Eclipse Forge",
  channel: "telegram" as const,
  sourceUrls: ["https://example.com/release"],
  evidenceNotes: "Источник проверяется человеком и передаётся модели только как недоверенные данные.",
  evidenceCards: [{
    id: "EF-001",
    claim: "The bounded Growth gateway exists.",
    state: "verified" as const,
    sourceUrl: "https://example.com/release",
    evidenceBoundary: "Источник подтверждает существование gateway, но не customer outcomes.",
  }],
};

function typedArtifact(step: typeof GROWTH_STEP_DEFINITIONS[number]["step"], usesCards = true) {
  const version = usesCards && ["research", "claims"].includes(step) ? "v2" : "v1";
  return JSON.stringify({
    schemaVersion: `growth.${step}.${version}`,
    content: "Проверенный typed результат без внешних действий и скрытых capability.",
  });
}

describe("growth.run.v1 server contract", () => {
  it("creates a fail-closed draft and requires the fixed role order", () => {
    const run = createGrowthRunPayload(INPUT, "chat:run-1", {
      provider: "eclipse-ai-hub",
      model: "auto/best-chat",
      now: new Date("2026-08-04T12:00:00Z"),
    });
    expect(run.status).toBe("draft");
    expect(run.execution.completedRequests).toBe(0);
    expect(run.policy).toEqual({
      externalActions: false,
      publishAllowed: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
    });
    expect(() => appendGrowthArtifact(run, {
      step: "draft",
      role: "Writer",
      content: "Результат достаточной длины, который пришёл вне разрешённой очереди ролей.",
      provider: "eclipse-ai-hub",
      model: "model",
    })).toThrow("вне очереди");
  });

  it("becomes reviewable after exactly five bounded artifacts", () => {
    let run = createGrowthRunPayload(INPUT, "chat:run-2", {
      provider: "eclipse-ai-hub",
      model: "auto/best-chat",
      now: new Date("2026-08-04T12:00:00Z"),
    });
    for (const step of GROWTH_STEP_DEFINITIONS) {
      run = appendGrowthArtifact(run, {
        step: step.step,
        role: step.role,
        content: typedArtifact(step.step),
        provider: "eclipse-ai-hub",
        model: "selected-model",
      });
    }
    expect(run.status).toBe("ready_for_approval");
    expect(run.execution.completedRequests).toBe(5);
    expect(parseStoredGrowthRun(JSON.stringify(run)).artifacts).toHaveLength(5);
    expect(parseGrowthRunImport(run).run.status).toBe("ready_for_approval");
  });

  it("does not accept an incomplete draft through the import boundary", () => {
    const run = createGrowthRunPayload(INPUT, "chat:run-3", {
      provider: "eclipse-ai-hub",
      model: "auto/best-chat",
    });
    expect(() => parseGrowthRunImport(run)).toThrow("только завершённый");
  });

  it("rejects direct-execution prose and a schema from another role", () => {
    const run = createGrowthRunPayload(INPUT, "chat:run-typed", {
      provider: "eclipse-ai-hub",
      model: "auto/best-chat",
    });
    expect(() => appendGrowthArtifact(run, {
      step: "research",
      role: "Researcher",
      content: "Untyped prose is long enough but must not enter direct execution storage.",
      provider: "eclipse-ai-hub",
      model: "selected-model",
    })).toThrow("typed JSON");
    expect(() => appendGrowthArtifact(run, {
      step: "research",
      role: "Researcher",
      content: typedArtifact("claims"),
      provider: "eclipse-ai-hub",
      model: "selected-model",
    })).toThrow("growth.research.v2");
  });

  it("keeps Evidence Cards optional and validates claim bindings before execution", () => {
    const legacy = createGrowthRunPayload({ ...INPUT, evidenceCards: undefined }, "chat:legacy", {
      provider: "eclipse-ai-hub",
      model: "auto/best-chat",
    });
    expect(legacy.input.evidenceCards).toBeUndefined();

    expect(() => createGrowthRunPayload({
      ...INPUT,
      evidenceCards: [INPUT.evidenceCards[0], INPUT.evidenceCards[0]],
    }, "chat:duplicate", { provider: "eclipse-ai-hub", model: "auto/best-chat" })).toThrow("уникальным");
    expect(() => createGrowthRunPayload({
      ...INPUT,
      evidenceCards: [{ ...INPUT.evidenceCards[0], sourceUrl: "https://outside.example/source" }],
    }, "chat:outside", { provider: "eclipse-ai-hub", model: "auto/best-chat" })).toThrow("входить в sourceUrls");
    expect(() => createGrowthRunPayload({
      ...INPUT,
      evidenceCards: [{ ...INPUT.evidenceCards[0], sourceUrl: null }],
    }, "chat:missing-source", { provider: "eclipse-ai-hub", model: "auto/best-chat" })).toThrow("требует sourceUrl");
  });
});
