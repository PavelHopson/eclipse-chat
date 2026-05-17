import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import {
  SocketEvents,
  type ChannelCreatedPayload,
  type ChannelDeletedPayload,
  type ChannelType,
  type ChannelUpdatedPayload,
  type MessageNewPayload,
} from "../lib/socket";

export type ChannelRow = {
  id: string;
  name: string;
  slug: string;
  type: ChannelType;
  position: number;
  /** Description канала (до 1024 символов). Null = нет описания. */
  description: string | null;
  /** Кастомный emoji prefix вместо # / 🔊. Null = default. */
  emoji: string | null;
  /** v0.47 Client Mode v2: internal-канал виден только OWNER/ADMIN/MOD
   *  когда server.mode=CLIENT. В ENGINEERING serverе flag ignored. */
  internal?: boolean;
  /** v0.74 #29 phase 1: temporary room. ISO timestamp авто-удаления через
   *  cron. NULL = постоянный канал. UI показывает countdown badge. */
  expiresAt: string | null;
  createdAt: string;
  _count: { messages: number };
};

type ChannelDto = {
  id: string;
  name: string;
  slug: string;
  type?: ChannelType; // legacy server без type — fallback TEXT
  position: number;
  description?: string | null;
  emoji?: string | null;
  internal?: boolean;
  expiresAt?: string | null;
  createdAt: string;
  _count?: { messages: number };
};

function normalizeChannel(dto: ChannelDto): ChannelRow {
  return {
    ...dto,
    type: dto.type ?? "TEXT",
    description: dto.description ?? null,
    emoji: dto.emoji ?? null,
    internal: dto.internal ?? false,
    expiresAt: dto.expiresAt ?? null,
    _count: dto._count ?? { messages: 0 },
  };
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
  /** Map<channelId, unreadCount> для текущего сервера. */
  const [unread, setUnread] = useState<Record<string, number>>({});
  const selectedChannelIdRef = useRef<string | null>(null);
  selectedChannelIdRef.current = selectedChannelId;

  const reload = useCallback(async () => {
    if (!serverId) {
      setChannels([]);
      setSelectedChannelId(null);
      setUnread({});
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
            description: null,
            emoji: null,
            expiresAt: p.expiresAt ?? null,
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

  // Socket: updated — rename / description change
  useEffect(() => {
    if (!socket || !serverId) return;
    const handler = (p: ChannelUpdatedPayload) => {
      if (p.serverId !== serverId) return;
      setChannels((prev) =>
        prev.map((c) =>
          c.id === p.channelId
            ? {
                ...c,
                name: p.name,
                slug: p.slug,
                type: p.type,
                position: p.position,
                description: p.description,
                emoji: p.emoji,
                expiresAt: p.expiresAt ?? c.expiresAt ?? null,
              }
            : c,
        ),
      );
    };
    socket.on(SocketEvents.ChannelUpdated, handler);
    return () => {
      socket.off(SocketEvents.ChannelUpdated, handler);
    };
  }, [socket, serverId]);

  // Socket: deleted
  useEffect(() => {
    if (!socket || !serverId) return;
    const handler = (p: ChannelDeletedPayload) => {
      if (p.serverId !== serverId) return;
      setChannels((prev) => prev.filter((c) => c.id !== p.channelId));
      setSelectedChannelId((cur) => (cur === p.channelId ? null : cur));
      setUnread((prev) => {
        if (!(p.channelId in prev)) return prev;
        const next = { ...prev };
        delete next[p.channelId];
        return next;
      });
    };
    socket.on(SocketEvents.ChannelDeleted, handler);
    return () => {
      socket.off(SocketEvents.ChannelDeleted, handler);
    };
  }, [socket, serverId]);

  // Socket: message:new → инкремент unread для каналов кроме активного.
  useEffect(() => {
    if (!socket) return;
    const handler = (p: MessageNewPayload) => {
      if (p.channelId === selectedChannelIdRef.current) return;
      setUnread((prev) => ({
        ...prev,
        [p.channelId]: (prev[p.channelId] ?? 0) + 1,
      }));
    };
    socket.on(SocketEvents.MessageNew, handler);
    return () => {
      socket.off(SocketEvents.MessageNew, handler);
    };
  }, [socket]);

  // Сброс unread на выбранном канале.
  useEffect(() => {
    if (!selectedChannelId) return;
    setUnread((prev) => {
      if (!(selectedChannelId in prev)) return prev;
      const next = { ...prev };
      delete next[selectedChannelId];
      return next;
    });
  }, [selectedChannelId]);

  const createChannel = useCallback(
    async (
      name: string,
      type: ChannelType = "TEXT",
      options: { expiresAt?: string | null } = {},
    ): Promise<ChannelRow | null> => {
      if (!serverId) return null;
      setError(null);
      try {
        const body: { name: string; type: ChannelType; expiresAt?: string } = {
          name,
          type,
        };
        if (options.expiresAt) body.expiresAt = options.expiresAt;
        const data = await apiJson<{ channel: ChannelDto }>(
          `/api/servers/${encodeURIComponent(serverId)}/channels`,
          {
            method: "POST",
            body: JSON.stringify(body),
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

  const updateChannel = useCallback(
    async (
      channelId: string,
      patch: {
        name?: string;
        description?: string | null;
        emoji?: string | null;
        /** v0.47 Client Mode v2: toggle internal flag. */
        internal?: boolean;
        /** v0.74 #29: установить/снять авто-удаление (NULL = снять). */
        expiresAt?: string | null;
      },
    ): Promise<boolean> => {
      setError(null);
      try {
        const data = await apiJson<{ channel: ChannelDto }>(
          `/api/channels/${encodeURIComponent(channelId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(patch),
          },
        );
        const updated = normalizeChannel(data.channel);
        // Локально обновим — socket эмит придёт также, дедупликация в handler.
        setChannels((prev) =>
          prev.map((c) =>
            c.id === channelId
              ? {
                  ...c,
                  name: updated.name,
                  slug: updated.slug,
                  type: updated.type,
                  position: updated.position,
                  description: updated.description,
                  emoji: updated.emoji,
                  internal: updated.internal,
                  expiresAt: updated.expiresAt,
                }
              : c,
          ),
        );
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось обновить канал");
        return false;
      }
    },
    [],
  );

  /**
   * Batch reorder каналов. Принимает массив { id, position } —
   * каждый channel получит новую position. Optimistic update + rollback на fail.
   */
  const reorderChannels = useCallback(
    async (order: { id: string; position: number }[]): Promise<boolean> => {
      if (!serverId) return false;
      setError(null);
      // Snapshot для rollback
      const snapshot = channels.map((c) => ({ id: c.id, position: c.position }));
      // Optimistic update
      const orderMap = new Map(order.map((o) => [o.id, o.position]));
      setChannels((prev) =>
        prev
          .map((c) => ({ ...c, position: orderMap.get(c.id) ?? c.position }))
          .sort((a, b) => a.position - b.position),
      );
      try {
        await apiJson(
          `/api/servers/${encodeURIComponent(serverId)}/channels/reorder`,
          {
            method: "PATCH",
            body: JSON.stringify({ order }),
          },
        );
        return true;
      } catch (e) {
        // Rollback
        const snapMap = new Map(snapshot.map((s) => [s.id, s.position]));
        setChannels((prev) =>
          prev
            .map((c) => ({ ...c, position: snapMap.get(c.id) ?? c.position }))
            .sort((a, b) => a.position - b.position),
        );
        setError(e instanceof ApiError ? e.message : "Не удалось изменить порядок");
        return false;
      }
    },
    [serverId, channels],
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
    updateChannel,
    reorderChannels,
    deleteChannel,
    unread,
  };
}
