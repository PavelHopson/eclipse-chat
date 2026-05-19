import { useCallback, useEffect, useState } from "react";
import { api, apiJson, ApiError } from "../lib/api";

/**
 * v1.0.1 #11.5 Composio Automation Expansion — frontend hook.
 *
 * Управляет per-server Composio connections (OAuth-managed external apps).
 * Graceful disable: если backend reports enabled=false (no API key) —
 * component shows «not configured» banner.
 */

export type ComposioStatus = {
  enabled: boolean;
  callbackUrl: string | null;
};

export type ComposioApp = {
  name: string;
  displayName: string;
  description?: string;
  categories?: string[];
  authScheme?: string;
  iconUrl?: string;
};

export type ComposioConnection = {
  id: string;
  appName: string;
  displayName: string;
  status: "ACTIVE" | "PENDING" | "EXPIRED" | "DISCONNECTED" | string;
  createdAt: string;
  lastUsedAt: string | null;
  createdBy: { id: string; displayName: string } | null;
};

export function useComposio(serverId: string | null) {
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiJson<ComposioStatus>("/api/composio/status");
      setStatus(data);
    } catch (e) {
      setStatus({ enabled: false, callbackUrl: null });
      setError(e instanceof ApiError ? e.message : "Composio status load failed");
    }
  }, []);

  const loadConnections = useCallback(async () => {
    if (!serverId) {
      setConnections([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ connections: ComposioConnection[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/composio/connections`,
      );
      setConnections(data.connections);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Connections load failed");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  /** Initiate OAuth для app'а. Возвращает redirectUrl или null если error. */
  const initiateConnect = useCallback(
    async (appName: string, displayName?: string): Promise<string | null> => {
      if (!serverId) return null;
      setError(null);
      try {
        const data = await apiJson<{ redirectUrl: string; connectionId: string }>(
          `/api/servers/${encodeURIComponent(serverId)}/composio/connect`,
          {
            method: "POST",
            body: JSON.stringify({ appName, displayName }),
          },
        );
        return data.redirectUrl;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Connect initiation failed");
        return null;
      }
    },
    [serverId],
  );

  /** Disconnect (удаляет на Composio + Eclipse). */
  const disconnect = useCallback(
    async (connectionId: string): Promise<boolean> => {
      if (!serverId) return false;
      setError(null);
      try {
        const res = await api(
          `/api/servers/${encodeURIComponent(serverId)}/composio/connections/${encodeURIComponent(connectionId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body?.error) msg = body.error;
          } catch {
            /* ignore */
          }
          setError(msg);
          return false;
        }
        await loadConnections();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Disconnect failed");
        return false;
      }
    },
    [serverId, loadConnections],
  );

  /** Список supported apps (OWNER-only, на сервере есть rate-check). */
  const fetchAvailableApps = useCallback(async (): Promise<ComposioApp[]> => {
    try {
      const data = await apiJson<{ apps: ComposioApp[] }>("/api/composio/apps");
      return data.apps;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Apps list failed");
      return [];
    }
  }, []);

  return {
    status,
    connections,
    loading,
    error,
    reload: loadConnections,
    initiateConnect,
    disconnect,
    fetchAvailableApps,
  };
}
