import { z } from "zod";

export const officeProviderIdSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "ollama",
  "openai-compatible",
]);

const capabilitySchema = z.string().trim().regex(/^[a-z][a-z0-9._:-]{0,63}$/);

export const officeProviderAdapterSchema = z.object({
  id: officeProviderIdSchema,
  enabled: z.boolean(),
  models: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  capabilities: z.array(capabilitySchema).max(100),
  local: z.boolean(),
}).strict();

export const officeEmployeeRouteSchema = z.object({
  employeeId: z.string().trim().min(1).max(160),
  provider: officeProviderIdSchema,
  model: z.string().trim().min(1).max(160),
  fallbackProvider: officeProviderIdSchema.optional(),
  fallbackModel: z.string().trim().min(1).max(160).optional(),
  requestedCapabilities: z.array(capabilitySchema).max(100).default([]),
  grantedCapabilities: z.array(capabilitySchema).max(100).default([]),
  spendingCapMinor: z.number().int().nonnegative(),
  spentMinor: z.number().int().nonnegative(),
  estimatedRequestCostMinor: z.number().int().nonnegative(),
}).strict().superRefine((route, context) => {
  if (route.spentMinor > route.spendingCapMinor) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["spentMinor"], message: "Spent budget exceeds employee cap" });
  }
  if (Boolean(route.fallbackProvider) !== Boolean(route.fallbackModel)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["fallbackProvider"], message: "Fallback provider and model must be configured together" });
  }
});

export type OfficeProviderAdapter = z.infer<typeof officeProviderAdapterSchema>;
export type OfficeEmployeeRoute = z.infer<typeof officeEmployeeRouteSchema>;

export type SelectedOfficeProviderRoute = {
  employeeId: string;
  provider: z.infer<typeof officeProviderIdSchema>;
  model: string;
  source: "primary" | "fallback";
  local: boolean;
  effectiveCapabilities: string[];
};

export class OfficeProviderRouteError extends Error {
  constructor(public readonly code: "invalid_route" | "budget_exhausted" | "provider_unavailable" | "capability_denied", message: string) {
    super(message);
    this.name = "OfficeProviderRouteError";
  }
}

export function intersectCapabilities(requested: readonly string[], granted: readonly string[]): string[] {
  const grantedSet = new Set(granted);
  return [...new Set(requested)].filter((capability) => grantedSet.has(capability));
}

export function selectOfficeProviderRoute(
  rawRoute: OfficeEmployeeRoute,
  rawAdapters: OfficeProviderAdapter[],
): SelectedOfficeProviderRoute {
  const routeResult = officeEmployeeRouteSchema.safeParse(rawRoute);
  const adaptersResult = z.array(officeProviderAdapterSchema).min(1).max(20).safeParse(rawAdapters);
  if (!routeResult.success || !adaptersResult.success) {
    throw new OfficeProviderRouteError("invalid_route", "Provider route configuration is invalid");
  }
  const route = routeResult.data;
  if (route.spentMinor + route.estimatedRequestCostMinor > route.spendingCapMinor) {
    throw new OfficeProviderRouteError("budget_exhausted", "Employee model budget is exhausted");
  }
  const adapterMap = new Map(adaptersResult.data.map((adapter) => [adapter.id, adapter]));
  const candidates = [
    { provider: route.provider, model: route.model, source: "primary" as const },
    ...(route.fallbackProvider && route.fallbackModel
      ? [{ provider: route.fallbackProvider, model: route.fallbackModel, source: "fallback" as const }]
      : []),
  ];
  const effectiveCapabilities = intersectCapabilities(route.requestedCapabilities, route.grantedCapabilities);
  if (effectiveCapabilities.length !== new Set(route.requestedCapabilities).size) {
    throw new OfficeProviderRouteError("capability_denied", "One or more requested capabilities were not granted by the host");
  }

  for (const candidate of candidates) {
    const adapter = adapterMap.get(candidate.provider);
    if (!adapter?.enabled || !adapter.models.includes(candidate.model)) continue;
    if (effectiveCapabilities.some((capability) => !adapter.capabilities.includes(capability))) continue;
    return {
      employeeId: route.employeeId,
      provider: candidate.provider,
      model: candidate.model,
      source: candidate.source,
      local: adapter.local,
      effectiveCapabilities,
    };
  }
  throw new OfficeProviderRouteError("provider_unavailable", "No approved provider adapter can execute this route");
}
