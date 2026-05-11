import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, apiJson } from "../lib/api";
import { SocketEvents, type ChannelCreatedPayload } from "../lib/socket";

export type ChannelRow = {
  id: string;
  name: string;
  slug: string;
  position: number;
  createdAt: string;
  _count: { messages: number };
};

/**
 * Каналы активного сервера. Загружаются при смене serverId, обновляются
 * через `channel:created` socket event.
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
      const data = await apiJson<{
        channels: { id: string; name: string; slug: string; position: number; createdAt: string; _count: { messages: number } }[];
      }>(`/api/servers/${encodeURIComponent(serverId)}/channels`);
      setChannels(data.channels);
      setSelectedChannelId((cur) => {
        if (cur && data.channels.some((c) => c.id === cur)) {
          return cur;
        }
        return data.channels[0]?.id ?? null;
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

  // Socket event: новый канал в server room
  useEffect(() => {
    if (!socket || !serverId) {
      return;
    }
    const handler = (p: ChannelCreatedPayload) => {
      if (p.serverId !== serverId) {
        return;
      }
      setChannels((prev) => {
        if (prev.some((c) => c.id === p.channelId)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: p.channelId,
            name: p.name,
            slug: p.slug,
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

  const createChannel = useCallback(
    async (name: string): Promise<ChannelRow | null> => {
      if (!serverId) {
        return null;
      }
      setError(null);
      try {
        const data = await apiJson<{
          channel: { id: string; name: string; slug: string; position: number; createdAt: string };
        }>(`/api/servers/${encodeURIComponent(serverId)}/channels`, {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        const created: ChannelRow = { ...data.channel, _count: { messages: 0 } };
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

  return {
    channels,
    selectedChannelId,
    setSelectedChannelId,
    error,
    loading,
    reload,
    createChannel,
  };
}
