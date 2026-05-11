import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";

export type ServerRow = {
  id: string;
  name: string;
  icon: string | null;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  memberCount: number;
  channelCount: number;
  role: string;
};

type CreateServerInput = { name: string; icon?: string | null };

type JoinResult = {
  server: { id: string; name: string; icon: string | null; ownerId: string };
  member: { id: string; role: string };
  alreadyMember: boolean;
};

/**
 * Список серверов текущего user'а + активный сервер.
 *
 * Активный сервер хранится в state, по умолчанию = первый из списка
 * (обычно Default Server). После create/join — становится активным.
 */
export function useServers(isReady: boolean) {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!isReady) {
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson<{ servers: ServerRow[] }>("/api/servers");
      setServers(data.servers);
      setActiveServerId((cur) => cur ?? data.servers[0]?.id ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить серверы");
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createServer = useCallback(
    async (input: CreateServerInput): Promise<ServerRow | null> => {
      setError(null);
      try {
        const data = await apiJson<{ server: ServerRow }>("/api/servers", {
          method: "POST",
          body: JSON.stringify(input),
        });
        const created = { ...data.server, memberCount: 1, channelCount: 0 };
        setServers((prev) => [...prev, created]);
        setActiveServerId(created.id);
        return created;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось создать сервер");
        return null;
      }
    },
    [],
  );

  const joinByInvite = useCallback(
    async (inviteCode: string): Promise<JoinResult | null> => {
      setError(null);
      try {
        const data = await apiJson<JoinResult>(`/api/servers/join/${encodeURIComponent(inviteCode)}`, {
          method: "POST",
        });
        // Перезагрузить список с актуальными counts вместо ручной мутации
        await reload();
        setActiveServerId(data.server.id);
        return data;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось вступить по инвайту");
        return null;
      }
    },
    [reload],
  );

  const leaveServer = useCallback(
    async (serverId: string): Promise<boolean> => {
      setError(null);
      try {
        await apiJson(`/api/servers/${encodeURIComponent(serverId)}/leave`, { method: "DELETE" });
        setServers((prev) => prev.filter((s) => s.id !== serverId));
        setActiveServerId((cur) => (cur === serverId ? null : cur));
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось покинуть сервер");
        return false;
      }
    },
    [],
  );

  const deleteServer = useCallback(
    async (serverId: string): Promise<boolean> => {
      setError(null);
      try {
        await apiJson(`/api/servers/${encodeURIComponent(serverId)}`, { method: "DELETE" });
        setServers((prev) => prev.filter((s) => s.id !== serverId));
        setActiveServerId((cur) => (cur === serverId ? null : cur));
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось удалить сервер");
        return false;
      }
    },
    [],
  );

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;

  return {
    servers,
    activeServer,
    activeServerId,
    setActiveServerId,
    error,
    loading,
    reload,
    createServer,
    joinByInvite,
    leaveServer,
    deleteServer,
  };
}
