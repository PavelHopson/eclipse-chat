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
