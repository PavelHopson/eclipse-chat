import { describe, expect, it } from "vitest";
import { isSafeSpecGateReviewNote, parseSpecGateIdempotencyKey, parseSpecGateImport, parseStoredSpecGate } from "./specGateContract.js";

function validArtifact() {
  const at = "2026-08-13T10:00:00.000Z";
  const criteria = ["JSON проходит строгую проверку", "Реализация остаётся заблокированной"];
  const paths = ["src/spec.ts", "src/spec.test.ts"];
  const ids = ["constitution", "specify", "clarify", "plan", "tasks", "implement"] as const;
  return { schemaVersion: "eclipse.spec-gate.v1", id: "spec_1", status: "approved", createdAt: at, updatedAt: at,
    input: { projectName: "Eclipse Library", repository: "PavelHopson/eclipse-library", problem: "Команда начинает код до согласования проверяемого результата и границ задачи.", userOutcome: "Команда получает утверждённую спецификацию до кода.", inScope: ["Versioned JSON"], outOfScope: ["Автоматический deploy"], constraints: ["Работать offline"], acceptanceCriteria: criteria, clarifications: [], rollbackPlan: "Удалить новый модуль без изменения пользовательских данных.", evidencePaths: paths },
    stages: ids.map((id) => ({ id, command: `/${id}`, status: id === "implement" ? "blocked" : "complete", summary: id === "implement" ? "Нужен отдельный review." : "Этап зафиксирован." })),
    tasks: criteria.map((criterion, index) => ({ id: `task-${String(index + 1).padStart(2, "0")}`, title: `Подтвердить критерий ${index + 1}`, acceptanceCriterion: criterion, status: "pending" })),
    verification: { evidencePaths: paths, requiredChecks: ["typecheck", "tests", "build", "desktop-qa", "mobile-qa", "security-review"] },
    policy: { externalActions: false, toolsAllowed: false, sourceContentTrusted: false, generatedCodeExecuted: false, githubConnected: false, deployAllowed: false, paymentsAllowed: false, implementationAllowed: false },
    approval: { scopeConfirmed: true, risksConfirmed: true, rollbackConfirmed: true, approvedAt: at },
  };
}

describe("eclipse.spec-gate.v1 server contract", () => {
  it("resets source approval while keeping implementation blocked", () => { const parsed = parseSpecGateImport(validArtifact()); expect(parsed.artifact.status).toBe("ready_for_review"); expect(parsed.artifact.approval).toBeNull(); expect(parsed.artifact.policy.implementationAllowed).toBe(false); expect(parseStoredSpecGate(parsed.payload).input.projectName).toBe("Eclipse Library"); expect(parsed.payloadHash).toMatch(/^[a-f0-9]{64}$/); });
  it("rejects policy escalation, stage drift, unsafe paths and secrets", () => { const policy = validArtifact(); policy.policy.implementationAllowed = true; expect(() => parseSpecGateImport(policy)).toThrow(/implementationAllowed/i); const stage = validArtifact(); stage.stages[5].status = "complete"; expect(() => parseSpecGateImport(stage)).toThrow(/Implementation/i); const path = validArtifact(); path.input.evidencePaths = ["../secret"]; path.verification.evidencePaths = ["../secret"]; expect(() => parseSpecGateImport(path)).toThrow(/workspace/i); const secret = validArtifact(); secret.input.constraints = [`sk-${"a".repeat(24)}`]; expect(() => parseSpecGateImport(secret)).toThrow(/секрет|API-ключ/i); });
  it("rejects secrets and control characters in review notes", () => {
    expect(isSafeSpecGateReviewNote("Проверено человеком, риски понятны.")).toBe(true);
    expect(isSafeSpecGateReviewNote("token=abcdefghijklmnop")).toBe(false);
    expect(isSafeSpecGateReviewNote(`sk-${"a".repeat(24)}`)).toBe(false);
    expect(isSafeSpecGateReviewNote("строка\u0000с нулём")).toBe(false);
  });
  it("accepts only approved artifacts and stable idempotency keys", () => { const draft = { ...validArtifact(), status: "ready_for_review", approval: null }; expect(() => parseSpecGateImport(draft)).toThrow(/утверждённый/i); expect(parseSpecGateIdempotencyKey("spec-gate:release:1")).toBe("spec-gate:release:1"); expect(parseSpecGateIdempotencyKey("short")).toBeNull(); });
});
