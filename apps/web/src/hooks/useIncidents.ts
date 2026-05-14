import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, apiJson } from "../lib/api";
import {
  SocketEvents,
  type IncidentOpenedPayload,
  type IncidentResolvedPayload,
} from "../lib/socket";

export type IncidentStatus = "OPEN" | "RESOLVED";

export type IncidentRow = {
  id: string;
  serverId: string;
  title: string;
  status: IncidentStatus;
  channelId: string | null;
  openedByUserId: string;
  openedByName: string;
  openedAt: string;
  resolvedAt: string | null;
  hasPostMortem: boolean;
};

export type IncidentTimelineItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  assigneeName: string | null;
};

export type IncidentPinned = {
  id: string;
  content: string;
  authorName: string;
};

export type IncidentDetail = {
  id: string;
  serverId: string;
  title: string;
  status: IncidentStatus;
  channelId: string | null;
  openedByUserId: string;
  openedByName: string;
  openedAt: string;
  resolvedAt: string | null;
  postMortem: string | null;
};

/**
 * Incident Mode — список инцидентов сервера + open/resolve actions.
 *
 * Realtime: подписка на `incident:opened` / `incident:resolved` в server-room.
 * При resolve post-mortem генерится async на бэке — `incident:resolved`
 * с `hasPostMortem` приходит когда AI закончил (или сразу с false если AI
 * не настроен / упал).
 */
export function useIncidents(serverId: string | null, socket: Socket | null) {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setIncidents([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson<{ incidents: IncidentRow[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/incidents`,
      );
      setIncidents(data.incidents);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить инциденты");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Socket: incident:opened
  useEffect(() => {
    if (!socket || !serverId) return;
    const onOpened = (p: IncidentOpenedPayload) => {
      if (p.serverId !== serverId) return;
      setIncidents((prev) => {
        if (prev.some((i) => i.id === p.incidentId)) return prev;
        return [
          {
            id: p.incidentId,
            serverId: p.serverId,
            title: p.title,
            status: "OPEN" as const,
            channelId: p.channelId,
            openedByUserId: p.openedByUserId,
            openedByName: p.openedByName,
            openedAt: p.openedAt,
            resolvedAt: null,
            hasPostMortem: false,
          },
          ...prev,
        ];
      });
    };
    const onResolved = (p: IncidentResolvedPayload) => {
      if (p.serverId !== serverId) return;
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === p.incidentId
            ? {
                ...i,
                status: "RESOLVED" as const,
                resolvedAt: p.resolvedAt,
                hasPostMortem: p.hasPostMortem,
              }
            : i,
        ),
      );
    };
    socket.on(SocketEvents.IncidentOpened, onOpened);
    socket.on(SocketEvents.IncidentResolved, onResolved);
    return () => {
      socket.off(SocketEvents.IncidentOpened, onOpened);
      socket.off(SocketEvents.IncidentResolved, onResolved);
    };
  }, [socket, serverId]);

  const openIncident = useCallback(
    async (title: string): Promise<{ channelId: string | null } | null> => {
      if (!serverId) return null;
      setError(null);
      try {
        const data = await apiJson<{
          incident: IncidentRow & { postMortem: string | null };
          channel: { id: string };
        }>(`/api/servers/${encodeURIComponent(serverId)}/incidents`, {
          method: "POST",
          body: JSON.stringify({ title: title.trim() }),
        });
        // Socket incident:opened тоже придёт — дедуп в onOpened через some().
        setIncidents((prev) =>
          prev.some((i) => i.id === data.incident.id)
            ? prev
            : [{ ...data.incident, hasPostMortem: false }, ...prev],
        );
        return { channelId: data.channel.id };
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось открыть инцидент");
        return null;
      }
    },
    [serverId],
  );

  const resolveIncident = useCallback(
    async (incidentId: string): Promise<boolean> => {
      setError(null);
      try {
        await apiJson(`/api/incidents/${encodeURIComponent(incidentId)}/resolve`, {
          method: "PATCH",
        });
        // Socket incident:resolved обновит статус (+ post-mortem flag когда готов).
        // Локально ставим RESOLVED сразу для responsive UX.
        setIncidents((prev) =>
          prev.map((i) =>
            i.id === incidentId
              ? { ...i, status: "RESOLVED" as const, resolvedAt: new Date().toISOString() }
              : i,
          ),
        );
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось закрыть инцидент");
        return false;
      }
    },
    [],
  );

  /** Загрузить детали инцидента (timeline + post-mortem). */
  const loadDetail = useCallback(
    async (
      incidentId: string,
    ): Promise<{
      incident: IncidentDetail;
      timeline: { actionItems: IncidentTimelineItem[]; pinned: IncidentPinned[] };
    } | null> => {
      try {
        return await apiJson(`/api/incidents/${encodeURIComponent(incidentId)}`);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить инцидент");
        return null;
      }
    },
    [],
  );

  const openCount = incidents.filter((i) => i.status === "OPEN").length;

  return {
    incidents,
    openCount,
    loading,
    error,
    reload,
    openIncident,
    resolveIncident,
    loadDetail,
  };
}
