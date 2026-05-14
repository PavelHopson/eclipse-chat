import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson, ApiError } from "../lib/api";
import { SocketEvents, type ActionItemPayload } from "../lib/socket";

/**
 * useServerActions — все ActionItem'ы сервера (across channels) для
 * Status Board. Fetch при смене сервера + live-апдейты через
 * `action:item:created` / `action:item:updated` (эмитятся в server-room).
 */
export function useServerActions(serverId: string | null, socket: Socket | null) {
  const [actions, setActions] = useState<ActionItemPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serverIdRef = useRef(serverId);
  serverIdRef.current = serverId;

  const reload = useCallback(async () => {
    if (!serverId) {
      setActions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ actions: ActionItemPayload[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/actions`,
      );
      setActions(data.actions);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить доску задач");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!socket) return;
    const upsert = (p: ActionItemPayload) => {
      if (p.serverId !== serverIdRef.current) return;
      setActions((prev) => {
        const idx = prev.findIndex((a) => a.id === p.id);
        if (idx === -1) return [p, ...prev];
        const next = prev.slice();
        next[idx] = p;
        return next;
      });
    };
    socket.on(SocketEvents.ActionItemCreated, upsert);
    socket.on(SocketEvents.ActionItemUpdated, upsert);
    return () => {
      socket.off(SocketEvents.ActionItemCreated, upsert);
      socket.off(SocketEvents.ActionItemUpdated, upsert);
    };
  }, [socket]);

  /** Optimistic toggle OPEN↔DONE, серверный ответ прилетит через socket. */
  const updateStatus = useCallback(
    async (id: string, status: "OPEN" | "DONE") => {
      setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      try {
        await apiJson(`/api/actions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось обновить задачу");
        void reload();
      }
    },
    [reload],
  );

  return { actions, loading, error, reload, updateStatus };
}
