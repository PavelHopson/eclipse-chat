import { apiJson } from "./api";

/**
 * v1.2.6 Platform Admin (trek P1) — API-клиент для super-admin эндпоинтов.
 * v1.2.7 (P2) — расширение: servers (suspend/unsuspend), user soft-delete,
 * audit-log read. Все запросы за preHandler'ами requireJwt +
 * requirePlatformOwner на сервере (auto-refresh при 401 через apiJson).
 */

// ===== Users ===============================================================

export type PlatformUser = {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  createdAt: string;
  isPlatformOwner: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  bannedBy: { id: string; email: string; displayName: string } | null;
  /** v1.2.7 P2 — soft-delete. */
  deletedAt: string | null;
  deletedReason: string | null;
  deletedBy: { id: string; email: string; displayName: string } | null;
};

export type UserStatusFilter = "all" | "active" | "banned" | "deleted";

export type ListUsersResponse = {
  users: PlatformUser[];
  total: number;
  limit: number;
  offset: number;
};

export type ListUsersParams = {
  q?: string;
  status?: UserStatusFilter;
  limit?: number;
  offset?: number;
};

// ===== Servers (v1.2.7 P2) =================================================

export type PlatformServer = {
  id: string;
  name: string;
  icon: string | null;
  brandColor: string | null;
  mode: "ENGINEERING" | "CLIENT";
  createdAt: string;
  owner: {
    id: string;
    email: string;
    displayName: string;
    deletedAt: string | null;
  };
  memberCount: number;
  channelCount: number;
  suspendedAt: string | null;
  suspendedReason: string | null;
  suspendedBy: { id: string; email: string; displayName: string } | null;
};

export type ServerStatusFilter = "all" | "active" | "suspended";

export type ListServersResponse = {
  servers: PlatformServer[];
  total: number;
  limit: number;
  offset: number;
};

export type ListServersParams = {
  q?: string;
  status?: ServerStatusFilter;
  limit?: number;
  offset?: number;
};

// ===== Audit log (v1.2.7 P2) ===============================================

export type AuditLogEntry = {
  id: string;
  type: string;
  createdAt: string;
  ipAddress: string | null;
  metadata: string | null;
  user: { id: string; email: string; displayName: string } | null;
};

export type ListAuditResponse = {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type ListAuditParams = {
  type?: string;
  userId?: string;
  limit?: number;
  offset?: number;
};

// ===== AI provider diagnostics ============================================

export type AiProviderDiagnostic = {
  priority: number;
  name: string;
  kind: "local" | "gateway" | "cloud" | "keyless";
  baseHost: string;
  hasAuth: boolean;
  modelCount: number;
  models: string[];
  trafficPercent: number;
  dataPolicy: "local" | "controlled" | "external" | "public";
  costTier: "free" | "low" | "standard" | "unknown";
  health: "unknown" | "healthy" | "degraded" | "cooldown";
  averageLatencyMs: number | null;
};

export type AiRouteDiagnostic = {
  task: "conversation" | "summarization" | "structured_extract" | "agent_tools" | "code";
  objective: "balanced" | "speed" | "economy" | "quality";
  sensitivity: "standard" | "sensitive";
  status: "ready" | "unavailable";
  primary: string | null;
  fallbacks: string[];
  reason: "privacy_first" | "speed_first" | "economy_first" | "quality_first" | "balanced";
};

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
    status: "healthy" | "breached" | "no_data";
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

export type AiProviderDiagnosticsResponse = {
  providers: AiProviderDiagnostic[];
  routes: AiRouteDiagnostic[];
  total: number;
  configured: boolean;
  gatewayTelemetry: AiGatewayTelemetryDiagnostic;
};

// ===== Ecosystem Command Center ===========================================

export type EcosystemServiceId =
  | "eclipse-chat"
  | "eclipse-ai-hub"
  | "eclipse-library"
  | "hopson-sentinel"
  | "eclipse-dnd-forge"
  | "eclipse-media";

export type EcosystemRuntimeStatus =
  | "operational"
  | "degraded"
  | "offline"
  | "unconfigured";

export type EcosystemServiceHealth = {
  id: EcosystemServiceId;
  name: string;
  role: string;
  maturity: "live" | "beta" | "prototype";
  status: EcosystemRuntimeStatus;
  evidence: string;
  openUrl: string | null;
  latencyMs: number | null;
  checkedAt: string;
};

export type EcosystemIntegrationHealth = {
  id: string;
  from: EcosystemServiceId;
  to: EcosystemServiceId;
  label: string;
  stage: "active" | "experimental" | "planned";
  status: EcosystemRuntimeStatus;
};

export type EcosystemHealthResponse = {
  generatedAt: string;
  cacheTtlSeconds: number;
  summary: {
    total: number;
    operational: number;
    attention: number;
    local: number;
  };
  services: EcosystemServiceHealth[];
  integrations: EcosystemIntegrationHealth[];
};

// ===== Helpers =============================================================

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ===== Endpoints — users ===================================================

export async function listPlatformUsers(
  params: ListUsersParams = {},
): Promise<ListUsersResponse> {
  return apiJson<ListUsersResponse>(
    `api/platform/users${buildQuery({
      q: params.q,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );
}

export async function banPlatformUser(
  id: string,
  reason: string,
): Promise<{ user: PlatformUser }> {
  return apiJson<{ user: PlatformUser }>(
    `api/platform/users/${encodeURIComponent(id)}/ban`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

export async function unbanPlatformUser(
  id: string,
): Promise<{ user: PlatformUser }> {
  return apiJson<{ user: PlatformUser }>(
    `api/platform/users/${encodeURIComponent(id)}/unban`,
    { method: "POST" },
  );
}

export async function resetPlatformUserPassword(
  id: string,
): Promise<{ user: PlatformUser; tempPassword: string }> {
  return apiJson<{ user: PlatformUser; tempPassword: string }>(
    `api/platform/users/${encodeURIComponent(id)}/reset-password`,
    { method: "POST" },
  );
}

export async function deletePlatformUser(
  id: string,
  reason: string,
): Promise<{ user: PlatformUser }> {
  return apiJson<{ user: PlatformUser }>(
    `api/platform/users/${encodeURIComponent(id)}/delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

// ===== Endpoints — servers (v1.2.7 P2) =====================================

export async function listPlatformServers(
  params: ListServersParams = {},
): Promise<ListServersResponse> {
  return apiJson<ListServersResponse>(
    `api/platform/servers${buildQuery({
      q: params.q,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );
}

export async function suspendPlatformServer(
  id: string,
  reason: string,
): Promise<{ server: PlatformServer }> {
  return apiJson<{ server: PlatformServer }>(
    `api/platform/servers/${encodeURIComponent(id)}/suspend`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

export async function unsuspendPlatformServer(
  id: string,
): Promise<{ server: PlatformServer }> {
  return apiJson<{ server: PlatformServer }>(
    `api/platform/servers/${encodeURIComponent(id)}/unsuspend`,
    { method: "POST" },
  );
}

// ===== Endpoints — audit log (v1.2.7 P2) ===================================

export async function listPlatformAuditLog(
  params: ListAuditParams = {},
): Promise<ListAuditResponse> {
  return apiJson<ListAuditResponse>(
    `api/platform/audit-log${buildQuery({
      type: params.type,
      userId: params.userId,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );
}

export async function listAiProviderDiagnostics(): Promise<AiProviderDiagnosticsResponse> {
  return apiJson<AiProviderDiagnosticsResponse>("api/platform/ai/providers");
}

export async function getEcosystemHealth(
  options: { refresh?: boolean } = {},
): Promise<EcosystemHealthResponse> {
  return apiJson<EcosystemHealthResponse>(
    `api/platform/ecosystem/health${options.refresh ? "?refresh=true" : ""}`,
  );
}

// ===== Details views (v1.2.8 P3) ===========================================

export type PlatformOwnedServer = {
  id: string;
  name: string;
  createdAt: string;
  suspendedAt: string | null;
  memberCount: number;
  channelCount: number;
};

export type PlatformUserDetailsResponse = {
  user: PlatformUser;
  ownedServers: PlatformOwnedServer[];
  memberCount: number;
  auditTrail: AuditLogEntry[];
};

export type PlatformServerDetailsResponse = {
  server: PlatformServer;
  roleBreakdown: Record<string, number>;
  auditTrail: AuditLogEntry[];
};

export async function getPlatformUserDetails(
  id: string,
): Promise<PlatformUserDetailsResponse> {
  return apiJson<PlatformUserDetailsResponse>(
    `api/platform/users/${encodeURIComponent(id)}/details`,
  );
}

export async function getPlatformServerDetails(
  id: string,
): Promise<PlatformServerDetailsResponse> {
  return apiJson<PlatformServerDetailsResponse>(
    `api/platform/servers/${encodeURIComponent(id)}/details`,
  );
}
