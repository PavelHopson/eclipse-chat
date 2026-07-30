export type AiGatewaySloStatus = "healthy" | "breached" | "no_data";

export type AiGatewayTelemetryWindow = {
  requests: number;
  successes: number;
  clientErrors: number;
  serviceErrors: number;
  availabilityPercent: number | null;
  averageLatencyMs: number | null;
  p95LatencyMs: number | null;
  maxLatencyMs: number | null;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
  topErrors: Array<{ code: string; count: number }>;
  slo: {
    status: AiGatewaySloStatus;
    availabilityMet: boolean | null;
    latencyMet: boolean | null;
  };
};

export type AiGatewayTelemetryDiagnostic =
  | { state: "not_configured" }
  | { state: "unavailable" }
  | {
      state: "ready";
      generatedAt: string;
      retentionHours: number;
      persistence: "memory" | "file";
      targets: { availabilityPercent: number; p95LatencyMs: number };
      windows: Record<"1h" | "24h" | "7d", AiGatewayTelemetryWindow>;
    };

const WINDOW_NAMES = ["1h", "24h", "7d"] as const;

function finite(
  value: unknown,
  { integer = false, min = 0, max = Number.MAX_SAFE_INTEGER }: { integer?: boolean; min?: number; max?: number } = {},
): number | null {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= min
    && value <= max
    && (!integer || Number.isSafeInteger(value))
    ? value
    : null;
}

function nullableFinite(
  value: unknown,
  options: { integer?: boolean; min?: number; max?: number } = {},
): number | null | undefined {
  return value === null ? null : finite(value, options) ?? undefined;
}

function sanitizeWindow(value: unknown): AiGatewayTelemetryWindow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const requests = finite(raw.requests, { integer: true });
  const successes = finite(raw.successes, { integer: true });
  const clientErrors = finite(raw.clientErrors, { integer: true });
  const serviceErrors = finite(raw.serviceErrors, { integer: true });
  const availabilityPercent = nullableFinite(raw.availabilityPercent, { max: 100 });
  const averageLatencyMs = nullableFinite(raw.averageLatencyMs, { integer: true, max: 300_000 });
  const p95LatencyMs = nullableFinite(raw.p95LatencyMs, { integer: true, max: 300_000 });
  const maxLatencyMs = nullableFinite(raw.maxLatencyMs, { integer: true, max: 300_000 });
  const costUsd = finite(raw.costUsd, { max: 1_000_000 });
  const promptTokens = finite(raw.promptTokens, { integer: true });
  const completionTokens = finite(raw.completionTokens, { integer: true });
  const slo = raw.slo && typeof raw.slo === "object" && !Array.isArray(raw.slo)
    ? raw.slo as Record<string, unknown>
    : null;
  const status = slo?.status;
  if (
    requests === null
    || successes === null
    || clientErrors === null
    || serviceErrors === null
    || availabilityPercent === undefined
    || averageLatencyMs === undefined
    || p95LatencyMs === undefined
    || maxLatencyMs === undefined
    || costUsd === null
    || promptTokens === null
    || completionTokens === null
    || !["healthy", "breached", "no_data"].includes(String(status))
  ) return null;

  const topErrors = Array.isArray(raw.topErrors)
    ? raw.topErrors.slice(0, 5).flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const item = entry as Record<string, unknown>;
        const count = finite(item.count, { integer: true, min: 1, max: 1_000_000_000 });
        return typeof item.code === "string"
          && /^[a-z0-9_]{1,64}$/.test(item.code)
          && count !== null
          ? [{ code: item.code, count }]
          : [];
      })
    : [];

  return {
    requests,
    successes,
    clientErrors,
    serviceErrors,
    availabilityPercent,
    averageLatencyMs,
    p95LatencyMs,
    maxLatencyMs,
    costUsd,
    promptTokens,
    completionTokens,
    topErrors,
    slo: {
      status: status as AiGatewaySloStatus,
      availabilityMet: typeof slo?.availabilityMet === "boolean" ? slo.availabilityMet : null,
      latencyMet: typeof slo?.latencyMet === "boolean" ? slo.latencyMet : null,
    },
  };
}

export function sanitizeAiGatewayTelemetry(value: unknown): Extract<AiGatewayTelemetryDiagnostic, { state: "ready" }> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const generatedAt = typeof raw.generatedAt === "string" && !Number.isNaN(Date.parse(raw.generatedAt))
    ? raw.generatedAt
    : null;
  const retentionHours = finite(raw.retentionHours, { integer: true, min: 24, max: 2_160 });
  const privacy = raw.privacy && typeof raw.privacy === "object" && !Array.isArray(raw.privacy)
    ? raw.privacy as Record<string, unknown>
    : null;
  const targets = raw.targets && typeof raw.targets === "object" && !Array.isArray(raw.targets)
    ? raw.targets as Record<string, unknown>
    : null;
  const targetAvailability = finite(targets?.availabilityPercent, { min: 90, max: 100 });
  const targetLatency = finite(targets?.p95LatencyMs, { integer: true, min: 100, max: 300_000 });
  const windowsRaw = raw.windows && typeof raw.windows === "object" && !Array.isArray(raw.windows)
    ? raw.windows as Record<string, unknown>
    : null;
  const windows = windowsRaw
    ? Object.fromEntries(WINDOW_NAMES.map((name) => [name, sanitizeWindow(windowsRaw[name])]))
    : null;
  if (
    !generatedAt
    || retentionHours === null
    || privacy?.aggregation !== "hourly"
    || privacy?.contentStored !== false
    || privacy?.identifiersStored !== false
    || !["memory", "file"].includes(String(raw.persistence))
    || targetAvailability === null
    || targetLatency === null
    || !windows
    || WINDOW_NAMES.some((name) => !windows[name])
  ) return null;

  return {
    state: "ready",
    generatedAt,
    retentionHours,
    persistence: raw.persistence as "memory" | "file",
    targets: { availabilityPercent: targetAvailability, p95LatencyMs: targetLatency },
    windows: windows as Record<"1h" | "24h" | "7d", AiGatewayTelemetryWindow>,
  };
}

function normalizeGatewayBaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (url.protocol === "http:" && !loopback.has(url.hostname)) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export async function getAiGatewayTelemetryDiagnostic(
  options: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<AiGatewayTelemetryDiagnostic> {
  const env = options.env ?? process.env;
  const baseUrl = env.ECLIPSE_AI_HUB_BASE_URL?.trim();
  const token = env.ECLIPSE_AI_HUB_SERVICE_TOKEN?.trim();
  const normalizedBaseUrl = baseUrl ? normalizeGatewayBaseUrl(baseUrl) : null;
  if (!normalizedBaseUrl || !token) return { state: "not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${normalizedBaseUrl}/telemetry`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) return { state: "unavailable" };
    return sanitizeAiGatewayTelemetry(await response.json()) ?? { state: "unavailable" };
  } catch {
    return { state: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
