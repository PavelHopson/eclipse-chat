import { describe, expect, it } from "vitest";
import { parseBuilderIdempotencyKey, parseBuilderProjectImport, parseStoredBuilderProject } from "./builderProjectContract.js";

function validProject() {
  const at = "2026-08-05T10:00:00.000Z";
  return {
    schemaVersion: "builder.project.v1",
    id: "builder_release_1",
    status: "approved",
    createdAt: at,
    updatedAt: at,
    input: {
      name: "Eclipse Library explorer",
      audience: "Пользователи Eclipse Forge",
      problem: "Нужно быстро понимать назначение, риски и применимость каждого инструмента.",
      primaryAction: "Открыть каталог",
      template: "catalog",
      requirements: ["Поиск по обычным словам", "Фильтры по лицензии"],
    },
    blueprint: {
      routes: [{ path: "/", label: "Все записи", purpose: "Найти и сравнить инструменты" }],
      sections: [
        { id: "search", label: "Поиск", purpose: "Найти запись по задаче" },
        { id: "filters", label: "Фильтры", purpose: "Сузить выбор" },
        { id: "results", label: "Результаты", purpose: "Сравнить основные свойства" },
      ],
      states: ["loading", "empty", "error", "success", "disabled", "no-access"],
      entities: ["Catalog item", "Category"],
      design: { density: "balanced", accent: "#6BA3FF", radius: "medium", fontStack: "system" },
    },
    preview: {
      eyebrow: "Каталог",
      headline: "Eclipse Library explorer",
      supportingText: "Проверяемая библиотека помогает выбрать инструмент и увидеть ограничения до внедрения.",
      actionLabel: "Открыть каталог",
      proofPoints: ["Быстрый поиск", "Лицензии", "Понятные риски"],
    },
    buildQueue: [
      { id: "brief", title: "Проверить brief", outcome: "Цель согласована", status: "ready", gate: null },
      { id: "interface", title: "Собрать интерфейс", outcome: "Responsive UI", status: "ready", gate: null },
      { id: "data", title: "Спроектировать данные", outcome: "Контракты", status: "blocked", gate: "Architecture review" },
      { id: "security", title: "Проверить безопасность", outcome: "Security review", status: "blocked", gate: "Security review" },
      { id: "quality", title: "Прогнать качество", outcome: "Tests", status: "blocked", gate: "Нужна реализация" },
      { id: "publish", title: "Подготовить публикацию", outcome: "Reviewable diff", status: "blocked", gate: "Deploy запрещён" },
    ],
    policy: {
      externalActions: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
      generatedCodeExecuted: false,
      githubConnected: false,
      deployAllowed: false,
      paymentsAllowed: false,
    },
    approval: { requirementsConfirmed: true, securityBoundaryConfirmed: true, previewReviewed: true, approvedAt: at },
  };
}

describe("builder.project.v1 server contract", () => {
  it("resets source approval and every downstream build gate", () => {
    const parsed = parseBuilderProjectImport(validProject());
    expect(parsed.sourceApprovalClaimed).toBe(true);
    expect(parsed.project.status).toBe("ready_for_review");
    expect(parsed.project.approval).toBeNull();
    expect(parsed.project.buildQueue[0]).toMatchObject({ id: "brief", status: "ready", gate: null });
    expect(parsed.project.buildQueue.slice(1).every((item) => item.status === "blocked")).toBe(true);
    expect(parseStoredBuilderProject(parsed.payload).input.name).toBe("Eclipse Library explorer");
    expect(parsed.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects unknown fields, unsafe policy, duplicate routes, secrets and invalid queue order", () => {
    expect(() => parseBuilderProjectImport({ ...validProject(), apiKey: "secret" })).toThrow(/Unrecognized key/i);
    const unsafe = validProject();
    unsafe.policy.githubConnected = true;
    expect(() => parseBuilderProjectImport(unsafe)).toThrow(/githubConnected/i);
    const duplicate = validProject();
    duplicate.blueprint.routes.push({ ...duplicate.blueprint.routes[0] });
    expect(() => parseBuilderProjectImport(duplicate)).toThrow(/уникальными/i);
    const externalRoute = validProject();
    externalRoute.blueprint.routes[0].path = "//example.test/app";
    expect(() => parseBuilderProjectImport(externalRoute)).toThrow(/route path/i);
    const secret = validProject();
    secret.input.requirements = ["github_pat_abcdefghijklmnopqrstuvwxyz123456"];
    expect(() => parseBuilderProjectImport(secret)).toThrow(/секрет|API-ключ/i);
    const queue = validProject();
    [queue.buildQueue[0], queue.buildQueue[1]] = [queue.buildQueue[1], queue.buildQueue[0]];
    expect(() => parseBuilderProjectImport(queue)).toThrow(/Build queue/i);
  });

  it("accepts only approved source projects and stable idempotency keys", () => {
    const draft = { ...validProject(), status: "ready_for_review", approval: null };
    expect(() => parseBuilderProjectImport(draft)).toThrow(/утверждённый/i);
    expect(parseBuilderIdempotencyKey("builder:release:1")).toBe("builder:release:1");
    expect(parseBuilderIdempotencyKey("short")).toBeNull();
    expect(parseBuilderIdempotencyKey("builder key")).toBeNull();
  });
});
