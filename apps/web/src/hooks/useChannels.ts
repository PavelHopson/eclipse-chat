import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import {
  SocketEvents,
  type ChannelCreatedPayload,
  type ChannelDeletedPayload,
  type ChannelType,
} from "../lib/socket";

export type ChannelRow = {
  id: string;
  name: string;
  slug: string;
  type: ChannelType;
  position: number;
  createdAt: string;
  _count: { messages: number };
};

type ChannelDto = {
  id: string;
  name: string;
  slug: string;
  type?: ChannelType; // legacy server без type — fallback TEXT
  position: number;
  createdAt: string;
  _count: { messages: number };
};

function normalizeChannel(dto: ChannelDto): ChannelRow {
  return { ...dto, type: dto.type ?? "TEXT" };
}

/**
 * Каналы активного сервера. Загружаются при смене serverId, обновляются
 * через `channel:created` / `channel:deleted` socket events.
 */
export function useChannels(serverId: string | null, socket: Socket | null) {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!serverId) {
      setChannels([]);
      setSelectedChannelId(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson<{ channels: ChannelDto[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/channels`,
      );
      const list = data.channels.map(normalizeChannel);
      setChannels(list);
      setSelectedChannelId((cur) => {
        if (cur && list.some((c) => c.id === cur)) return cur;
        return list.find((c) => c.type === "TEXT")?.id ?? list[0]?.id ?? null;
      });
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить каналы");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Socket: created
  useEffect(() => {
    if (!socket || !serverId) return;
    const handler = (p: ChannelCreatedPayload) => {
      if (p.serverId !== serverId) return;
      setChannels((prev) => {
        if (prev.some((c) => c.id === p.channelId)) return prev;
        return [
          ...prev,
          {
            id: p.channelId,
            name: p.name,
            slug: p.slug,
            type: p.type ?? "TEXT",
            position: p.position,
            createdAt: p.createdAt,
            _count: { messages: 0 },
          },
        ];
      });
    };
    socket.on(SocketEvents.ChannelCreated, handler);
    return () => {
      socket.off(SocketEvents.ChannelCreated, handler);
    };
  }, [socket, serverId]);

  // Socket: deleted
  useEffect(() => {
    if (!socket || !serverId) return;
    const handler = (p: ChannelDeletedPayload) => {
      if (p.serverId !== serverId) return;
      setChannels((prev) => prev.filter((c) => c.id !== p.channelId));
      setSelectedChannelId((cur) => (cur === p.channelId ? null : cur));
    };
    socket.on(SocketEvents.ChannelDeleted, handler);
    return () => {
      socket.off(SocketEvents.ChannelDeleted, handler);
    };
  }, [socket, serverId]);

  const createChannel = useCallback(
    async (name: string, type: ChannelType = "TEXT"): Promise<ChannelRow | null> => {
      if (!serverId) return null;
      setError(null);
      try {
        const data = await apiJson<{ channel: ChannelDto }>(
          `/api/servers/${encodeURIComponent(serverId)}/channels`,
          {
            method: "POST",
            body: JSON.stringify({ name, type }),
          },
        );
        const created = normalizeChannel({ ...data.channel, _count: { messages: 0 } });
        // Socket эмит сделает то же, но чтобы UI отреагировал быстро —
        // добавим оптимистично, дедупликация в socket handler выше.
        setChannels((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
        setSelectedChannelId(created.id);
        return created;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось создать канал");
        return null;
      }
    },
    [serverId],
  );

  const deleteChannel = useCallback(
    async (channelId: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await api(`/api/channels/${encodeURIComponent(channelId)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body?.error) msg = body.error;
          } catch {
            /* non-json */
          }
          setError(msg);
          return false;
        }
        // Локально удалим — socket эмит также придёт, дедуплицируем через filter.
        setChannels((prev) => prev.filter((c) => c.id !== channelId));
        setSelectedChannelId((cur) => (cur === channelId ? null : cur));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить канал");
        return false;
      }
    },
    [],
  );

  return {
    channels,
    selectedChannelId,
    setSelectedChannelId,
    error,
    loading,
    reload,
    createChannel,
    deleteChannel,
  };
}
