import { describe, expect, it } from "vitest";
import { OfficeProviderRouteError, intersectCapabilities, selectOfficeProviderRoute } from "./providerRouter.js";

const adapters = [
  { id: "openai" as const, enabled: false, models: ["gpt-primary"], capabilities: ["files.read"], local: false },
  { id: "ollama" as const, enabled: true, models: ["qwen-local"], capabilities: ["files.read"], local: true },
];

it("computes plugin permissions as requested intersect granted", () => {
  expect(intersectCapabilities(["files.read", "files.write"], ["files.read", "browser.open"])).toEqual(["files.read"]);
});

describe("selectOfficeProviderRoute", () => {
  it("uses an approved fallback when the primary adapter is unavailable", () => {
    const selected = selectOfficeProviderRoute({
      employeeId: "researcher",
      provider: "openai",
      model: "gpt-primary",
      fallbackProvider: "ollama",
      fallbackModel: "qwen-local",
      requestedCapabilities: ["files.read"],
      grantedCapabilities: ["files.read"],
      spendingCapMinor: 500,
      spentMinor: 100,
      estimatedRequestCostMinor: 20,
    }, adapters);
    expect(selected).toMatchObject({ provider: "ollama", source: "fallback", local: true });
  });

  it("fails closed when a requested capability was not granted", () => {
    expect(() => selectOfficeProviderRoute({
      employeeId: "researcher",
      provider: "ollama",
      model: "qwen-local",
      requestedCapabilities: ["files.read", "files.write"],
      grantedCapabilities: ["files.read"],
      spendingCapMinor: 500,
      spentMinor: 100,
      estimatedRequestCostMinor: 20,
    }, adapters)).toThrowError(OfficeProviderRouteError);
  });

  it("fails closed before routing when the employee budget is exhausted", () => {
    expect(() => selectOfficeProviderRoute({
      employeeId: "researcher",
      provider: "ollama",
      model: "qwen-local",
      requestedCapabilities: [],
      grantedCapabilities: [],
      spendingCapMinor: 100,
      spentMinor: 95,
      estimatedRequestCostMinor: 10,
    }, adapters)).toThrow(/budget is exhausted/);
  });
});
