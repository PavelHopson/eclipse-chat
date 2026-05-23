import { apiJson } from "./api";

/**
 * v1.2.6 Platform Admin (trek P1) — API-клиент для super-admin эндпоинтов.
 * Все запросы идут через apiJson (auto-refresh при 401). Эндпоинты за
 * preHandler'ами requireJwt + requirePlatformOwner на сервере.
 */

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
};

export type ListUsersResponse = {
  users: PlatformUser[];
  total: number;
  limit: number;
  offset: number;
};

export type ListUsersParams = {
  q?: string;
  banned?: "true" | "false";
  limit?: number;
  offset?: number;
};

function buildQuery(params: ListUsersParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.banned) sp.set("banned", params.banned);
  if (typeof params.limit === "number") sp.set("limit", String(params.limit));
  if (typeof params.offset === "number") sp.set("offset", String(params.offset));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function listPlatformUsers(
  params: ListUsersParams = {},
): Promise<ListUsersResponse> {
  return apiJson<ListUsersResponse>(
    `api/platform/users${buildQuery(params)}`,
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
