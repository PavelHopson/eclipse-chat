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
};

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
        content: `${step.role}: ${"Проверенный результат без внешних действий. ".repeat(3)}`,
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
});
