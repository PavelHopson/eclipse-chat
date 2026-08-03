export const AI_TASK_KINDS = [
  "conversation",
  "summarization",
  "structured_extract",
  "agent_tools",
  "code",
] as const;

export type AiTaskKind = (typeof AI_TASK_KINDS)[number];
export type AiRoutingObjective = "balanced" | "speed" | "economy" | "quality";
export type AiDataSensitivity = "standard" | "sensitive";
export type AiProviderKind = "local" | "gateway" | "cloud" | "keyless";
export type AiDataPolicy = "local" | "controlled" | "external" | "public";
export type AiCostTier = "free" | "low" | "standard" | "unknown";
export type AiHealthState = "unknown" | "healthy" | "degraded" | "cooldown";

export type AiRouteRequest = {
  task: AiTaskKind;
  objective?: AiRoutingObjective;
  sensitivity?: AiDataSensitivity;
};

export type AiProviderCandidate = {
  name: string;
  kind: AiProviderKind;
  legacyPriority: number;
  trafficPercent?: number;
};

export type AiProviderHealthDiagnostic = {
  state: AiHealthState;
  consecutiveFailures: number;
  averageLatencyMs: number | null;
  cooldownRemainingMs: number;
};

export type AiRouteDiagnostic = {
  task: AiTaskKind;
  objective: AiRoutingObjective;
  sensitivity: AiDataSensitivity;
  status: "ready" | "unavailable";
  primary: string | null;
  fallbacks: string[];
  reason: "privacy_first" | "speed_first" | "economy_first" | "quality_first" | "balanced";
};

type RoutingProfile = {
  dataPolicy: AiDataPolicy;
  costTier: AiCostTier;
  speed: number;
  economy: number;
  quality: number;
  privacy: number;
  toolSupport: number;
  tasks: Record<AiTaskKind, number>;
};

type HealthRecord = {
  consecutiveFailures: number;
  averageLatencyMs: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  cooldownUntil: number;
};

const HEALTH = new Map<string, HealthRecord>();
const COOLDOWN_AFTER_FAILURES = 2;
const COOLDOWN_MS = 60_000;

const DEFAULT_TASKS: Record<AiTaskKind, number> = {
  conversation: 3,
  summarization: 3,
  structured_extract: 3,
  agent_tools: 2,
  code: 2,
};

const PROFILES: Record<string, RoutingProfile> = {
  ollama: profile("local", "free", 2, 4, 2, 4, 2, {
    conversation: 3,
    summarization: 4,
    structured_extract: 2,
    agent_tools: 2,
    code: 3,
  }),
  "eclipse-ai-hub": profile("controlled", "low", 3, 3, 4, 3, 4, {
    conversation: 4,
    summarization: 4,
    structured_extract: 4,
    agent_tools: 4,
    code: 4,
  }),
  omniroute: profile("controlled", "low", 3, 3, 4, 3, 4, {
    conversation: 4,
    summarization: 4,
    structured_extract: 4,
    agent_tools: 4,
    code: 4,
  }),
  groq: profile("external", "free", 4, 4, 3, 1, 3, {
    conversation: 4,
    summarization: 4,
    structured_extract: 3,
    agent_tools: 3,
    code: 2,
  }),
  cerebras: profile("external", "free", 4, 4, 3, 1, 2, {
    conversation: 3,
    summarization: 4,
    structured_extract: 3,
    agent_tools: 2,
    code: 3,
  }),
  openrouter: profile("external", "free", 3, 4, 3, 1, 4, {
    conversation: 4,
    summarization: 4,
    structured_extract: 4,
    agent_tools: 4,
    code: 4,
  }),
  nvidia: profile("external", "free", 3, 4, 3, 1, 3, {
    conversation: 3,
    summarization: 3,
    structured_extract: 3,
    agent_tools: 3,
    code: 4,
  }),
  mistral: profile("external", "low", 3, 3, 3, 1, 3),
  yandexgpt: profile("external", "low", 3, 3, 3, 2, 2),
  deepseek: profile("external", "low", 3, 3, 4, 1, 4, {
    conversation: 4,
    summarization: 3,
    structured_extract: 4,
    agent_tools: 4,
    code: 4,
  }),
  glm: profile("external", "low", 3, 3, 4, 1, 3),
  mimo: profile("external", "low", 3, 3, 4, 1, 3),
  custom: profile("external", "unknown", 3, 2, 3, 1, 3),
  openai: profile("external", "standard", 3, 1, 4, 1, 4, {
    conversation: 4,
    summarization: 4,
    structured_extract: 4,
    agent_tools: 4,
    code: 4,
  }),
  pollinations: profile("public", "free", 2, 4, 2, 0, 1, {
    conversation: 3,
    summarization: 3,
    structured_extract: 2,
    agent_tools: 1,
    code: 2,
  }),
};

function profile(
  dataPolicy: AiDataPolicy,
  costTier: AiCostTier,
  speed: number,
  economy: number,
  quality: number,
  privacy: number,
  toolSupport: number,
  tasks: Record<AiTaskKind, number> = DEFAULT_TASKS,
): RoutingProfile {
  return { dataPolicy, costTier, speed, economy, quality, privacy, toolSupport, tasks };
}

function fallbackProfile(kind: AiProviderKind): RoutingProfile {
  if (kind === "local") return profile("local", "unknown", 2, 3, 2, 4, 2);
  if (kind === "keyless") return profile("public", "free", 2, 4, 2, 0, 1);
  return profile("external", "unknown", 2, 2, 2, 1, 2);
}

export function getAiProviderRoutingProfile(
  name: string,
  kind: AiProviderKind,
): Pick<RoutingProfile, "dataPolicy" | "costTier"> {
  const value = PROFILES[name] ?? fallbackProfile(kind);
  return { dataPolicy: value.dataPolicy, costTier: value.costTier };
}

export function parseSensitiveProviderAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function recordAiProviderSuccess(
  name: string,
  latencyMs: number,
  now = Date.now(),
): void {
  const current = HEALTH.get(name);
  const boundedLatency = Math.max(0, Math.round(latencyMs));
  HEALTH.set(name, {
    consecutiveFailures: 0,
    averageLatencyMs: current?.averageLatencyMs === null || current?.averageLatencyMs === undefined
      ? boundedLatency
      : Math.round(current.averageLatencyMs * 0.7 + boundedLatency * 0.3),
    lastSuccessAt: now,
    lastFailureAt: current?.lastFailureAt ?? null,
    cooldownUntil: 0,
  });
}

export function recordAiProviderFailure(name: string, now = Date.now()): void {
  const current = HEALTH.get(name);
  const consecutiveFailures = (current?.consecutiveFailures ?? 0) + 1;
  HEALTH.set(name, {
    consecutiveFailures,
    averageLatencyMs: current?.averageLatencyMs ?? null,
    lastSuccessAt: current?.lastSuccessAt ?? null,
    lastFailureAt: now,
    cooldownUntil: consecutiveFailures >= COOLDOWN_AFTER_FAILURES ? now + COOLDOWN_MS : 0,
  });
}

export function getAiProviderHealth(
  name: string,
  now = Date.now(),
): AiProviderHealthDiagnostic {
  const current = HEALTH.get(name);
  if (!current) {
    return {
      state: "unknown",
      consecutiveFailures: 0,
      averageLatencyMs: null,
      cooldownRemainingMs: 0,
    };
  }
  const cooldownRemainingMs = Math.max(0, current.cooldownUntil - now);
  return {
    state: cooldownRemainingMs > 0
      ? "cooldown"
      : current.consecutiveFailures > 0 ? "degraded" : "healthy",
    consecutiveFailures: current.consecutiveFailures,
    averageLatencyMs: current.averageLatencyMs,
    cooldownRemainingMs,
  };
}

export function resetAiProviderHealth(): void {
  HEALTH.clear();
}

function objectiveScore(profileValue: RoutingProfile, objective: AiRoutingObjective): number {
  switch (objective) {
    case "speed":
      return profileValue.speed * 5 + profileValue.quality * 2 + profileValue.economy;
    case "economy":
      return profileValue.economy * 5 + profileValue.speed * 2 + profileValue.quality;
    case "quality":
      return profileValue.quality * 5 + profileValue.speed * 2 + profileValue.economy;
    case "balanced":
    default:
      return profileValue.quality * 3 + profileValue.speed * 2 + profileValue.economy * 2;
  }
}

function isSensitiveProviderAllowed(
  candidate: AiProviderCandidate,
  allowlist: ReadonlySet<string>,
): boolean {
  const profileValue = PROFILES[candidate.name] ?? fallbackProfile(candidate.kind);
  if (profileValue.dataPolicy === "local" || profileValue.dataPolicy === "controlled") {
    return true;
  }
  // Public/keyless routes are never valid for workspace-sensitive content.
  return profileValue.dataPolicy === "external" && allowlist.has(candidate.name.toLowerCase());
}

export function rankAiProviderCandidates(
  candidates: AiProviderCandidate[],
  request: AiRouteRequest,
  options: {
    sensitiveAllowlist?: ReadonlySet<string>;
    now?: number;
  } = {},
): AiProviderCandidate[] {
  const objective = request.objective ?? "balanced";
  const sensitivity = request.sensitivity ?? "standard";
  const allowlist = options.sensitiveAllowlist ?? new Set<string>();
  const now = options.now ?? Date.now();

  return candidates
    .filter((candidate) => (candidate.trafficPercent ?? 100) > 0)
    .filter((candidate) => sensitivity !== "sensitive" || isSensitiveProviderAllowed(candidate, allowlist))
    .map((candidate) => {
      const profileValue = PROFILES[candidate.name] ?? fallbackProfile(candidate.kind);
      const health = getAiProviderHealth(candidate.name, now);
      let score = profileValue.tasks[request.task] * 12 + objectiveScore(profileValue, objective);
      if (sensitivity === "sensitive") score += profileValue.privacy * 8;
      if (request.task === "agent_tools") score += profileValue.toolSupport * 6;
      if (objective === "speed" && health.averageLatencyMs !== null) {
        score -= Math.min(20, health.averageLatencyMs / 1_000);
      }
      if (health.state === "degraded") score -= 18;
      if (health.state === "cooldown") score -= 1_000;
      score -= candidate.legacyPriority / 100;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
}

function diagnosticReason(
  request: Required<AiRouteRequest>,
): AiRouteDiagnostic["reason"] {
  if (request.sensitivity === "sensitive") return "privacy_first";
  if (request.objective === "speed") return "speed_first";
  if (request.objective === "economy") return "economy_first";
  if (request.objective === "quality") return "quality_first";
  return "balanced";
}

const DIAGNOSTIC_ROUTES: Array<Required<AiRouteRequest>> = [
  { task: "conversation", objective: "balanced", sensitivity: "sensitive" },
  { task: "summarization", objective: "economy", sensitivity: "sensitive" },
  { task: "structured_extract", objective: "quality", sensitivity: "sensitive" },
  { task: "agent_tools", objective: "quality", sensitivity: "sensitive" },
  { task: "code", objective: "quality", sensitivity: "standard" },
];

export function buildAiRouteDiagnostics(
  candidates: AiProviderCandidate[],
  sensitiveAllowlist: ReadonlySet<string> = new Set<string>(),
): AiRouteDiagnostic[] {
  return DIAGNOSTIC_ROUTES.map((request) => {
    const ranked = rankAiProviderCandidates(candidates, request, { sensitiveAllowlist });
    return {
      ...request,
      status: ranked.length > 0 ? "ready" : "unavailable",
      primary: ranked[0]?.name ?? null,
      fallbacks: ranked.slice(1, 4).map((provider) => provider.name),
      reason: diagnosticReason(request),
    };
  });
}
