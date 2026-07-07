import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import {
  SocketEvents,
  type CategoryCreatedPayload,
  type CategoryDeletedPayload,
  type CategoryUpdatedPayload,
  type ChannelCreatedPayload,
  type ChannelDeletedPayload,
  type ChannelType,
  type ChannelUpdatedPayload,
  type MessageNewPayload,
} from "../lib/socket";
import type { CategoryDto, ChannelDto } from "../types/api";

export type CategoryRow = CategoryDto;

export type ChannelRow = {
  id: string;
  name: string;
  slug: string;
  type: ChannelType;
  position: number;
  categoryId: string | null;
  description: string | null;
  emoji: string | null;
  internal?: boolean;
  expiresAt: string | null;
  /** v1.7.0 — дефолтный TTL исчезающих сообщений (секунды; null = выкл). */
  messageTtlSeconds: number | null;
  createdAt: string;
  _count: { messages: number };
};

function byPositionName<T extends { position: number; name: string }>(a: T, b: T) {
  return a.position - b.position || a.name.localeCompare(b.name, "ru");
}

function normalizeChannel(dto: ChannelDto): ChannelRow {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    type: dto.type ?? "TEXT",
    position: dto.position,
    categoryId: dto.categoryId ?? null,
    description: dto.description ?? null,
    emoji: dto.emoji ?? null,
    internal: dto.internal ?? false,
    expiresAt: dto.expiresAt ?? null,
    messageTtlSeconds: dto.messageTtlSeconds ?? null,
    createdAt: dto.createdAt,
    _count: dto._count ?? { messages: 0 },
  };
}

function normalizeCreatedChannel(p: ChannelCreatedPayload): ChannelRow {
  return {
    id: p.channelId,
    name: p.name,
    slug: p.slug,
    type: p.type ?? "TEXT",
    position: p.position,
    categoryId: p.categoryId ?? null,
    description: null,
    emoji: null,
    expiresAt: p.expiresAt ?? null,
    messageTtlSeconds: null,
    createdAt: p.createdAt,
    _count: { messages: 0 },
  };
}

function updateChannelFromPayload(channel: ChannelRow, p: ChannelUpdatedPayload): ChannelRow {
  return {
    ...channel,
    name: p.name,
    slug: p.slug,
    type: p.type,
    position: p.position,
    categoryId: p.categoryId ?? null,
    description: p.description,
    emoji: p.emoji,
    expiresAt: p.expiresAt ?? channel.expiresAt ?? null,
    messageTtlSeconds: p.messageTtlSeconds ?? channel.messageTtlSeconds ?? null,
  };
}

function readError(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function consumeChannelQuery(list: ChannelRow[]): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const channelId = params.get("channel");
  if (!channelId || !list.some((channel) => channel.id === channelId)) return null;
  params.delete("channel");
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}${window.location.hash}`,
  );
  return channelId;
}

export function useChannels(serverId: string | null, socket: Socket | null) {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const selectedChannelIdRef = useRef<string | null>(null);
  selectedChannelIdRef.current = selectedChannelId;

  const reload = useCallback(async () => {
    if (!serverId) {
      setChannels([]);
      setCategories([]);
      setSelectedChannelId(null);
      setUnread({});
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson<{ channels: ChannelDto[]; categories?: CategoryDto[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/channels`,
      );
      const list = data.channels.map(normalizeChannel).sort(byPositionName);
      setChannels(list);
      setCategories([...(data.categories ?? [])].sort(byPositionName));
      const linkedChannelId = consumeChannelQuery(list);
      setSelectedChannelId((cur) => {
        if (linkedChannelId) return linkedChannelId;
        if (cur && list.some((c) => c.id === cur)) return cur;
        return list.find((c) => c.type === "TEXT")?.id ?? list[0]?.id ?? null;
      });
      setError(null);
    } catch (e) {
      setError(readError(e, "Не удалось загрузить каналы"));
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!socket || !serverId) return;
    const handler = (p: ChannelCreatedPayload) => {
      if (p.serverId !== serverId) return;
      setChannels((prev) => {
        if (prev.some((c) => c.id === p.channelId)) return prev;
        return [...prev, normalizeCreatedChannel(p)].sort(byPositionName);
      });
    };
    socket.on(SocketEvents.ChannelCreated, handler);
    return () => {
      socket.off(SocketEvents.ChannelCreated, handler);
    };
  }, [socket, serverId]);

  useEffect(() => {
    if (!socket || !serverId) return;
    const handler = (p: ChannelUpdatedPayload) => {
      if (p.serverId !== serverId) return;
      setChannels((prev) =>
        prev.map((c) => (c.id === p.channelId ? updateChannelFromPayload(c, p) : c)).sort(byPositionName),
      );
    };
    socket.on(SocketEvents.ChannelUpdated, handler);
    return () => {
      socket.off(SocketEvents.ChannelUpdated, handler);
    };
  }, [socket, serverId]);

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

  useEffect(() => {
    if (!socket || !serverId) return;
    const onCreated = (p: CategoryCreatedPayload) => {
      if (p.serverId !== serverId) return;
      setCategories((prev) => {
        if (prev.some((c) => c.id === p.id)) return prev;
        return [...prev, p].sort(byPositionName);
      });
    };
    const onUpdated = (p: CategoryUpdatedPayload) => {
      if (p.serverId !== serverId) return;
      setCategories((prev) => {
        const exists = prev.some((c) => c.id === p.id);
        return (exists ? prev.map((c) => (c.id === p.id ? p : c)) : [...prev, p]).sort(byPositionName);
      });
    };
    const onDeleted = (p: CategoryDeletedPayload) => {
      if (p.serverId !== serverId) return;
      setCategories((prev) => prev.filter((c) => c.id !== p.categoryId));
      setChannels((prev) =>
        prev.map((c) => (c.categoryId === p.categoryId ? { ...c, categoryId: null } : c)).sort(byPositionName),
      );
    };
    socket.on(SocketEvents.CategoryCreated, onCreated);
    socket.on(SocketEvents.CategoryUpdated, onUpdated);
    socket.on(SocketEvents.CategoryDeleted, onDeleted);
    return () => {
      socket.off(SocketEvents.CategoryCreated, onCreated);
      socket.off(SocketEvents.CategoryUpdated, onUpdated);
      socket.off(SocketEvents.CategoryDeleted, onDeleted);
    };
  }, [socket, serverId]);

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
      options: { expiresAt?: string | null; categoryId?: string | null } = {},
    ): Promise<ChannelRow | null> => {
      if (!serverId) return null;
      setError(null);
      try {
        const body: { name: string; type: ChannelType; expiresAt?: string; categoryId?: string | null } = {
          name,
          type,
        };
        if (options.expiresAt) body.expiresAt = options.expiresAt;
        if (options.categoryId !== undefined) body.categoryId = options.categoryId;
        const data = await apiJson<{ channel: ChannelDto }>(
          `/api/servers/${encodeURIComponent(serverId)}/channels`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        );
        const created = normalizeChannel({ ...data.channel, _count: { messages: 0 } });
        setChannels((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created].sort(byPositionName)));
        setSelectedChannelId(created.id);
        return created;
      } catch (e) {
        setError(readError(e, "Не удалось создать канал"));
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
        internal?: boolean;
        expiresAt?: string | null;
        messageTtlSeconds?: number | null;
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
        setChannels((prev) => prev.map((c) => (c.id === channelId ? updated : c)).sort(byPositionName));
        return true;
      } catch (e) {
        setError(readError(e, "Не удалось обновить канал"));
        return false;
      }
    },
    [],
  );

  const reorderChannels = useCallback(
    async (order: { id: string; position: number }[]): Promise<boolean> => {
      if (!serverId) return false;
      setError(null);
      const snapshot = channels.map((c) => ({ id: c.id, position: c.position }));
      const orderMap = new Map(order.map((o) => [o.id, o.position]));
      setChannels((prev) =>
        prev.map((c) => ({ ...c, position: orderMap.get(c.id) ?? c.position })).sort(byPositionName),
      );
      try {
        await apiJson(`/api/servers/${encodeURIComponent(serverId)}/channels/reorder`, {
          method: "PATCH",
          body: JSON.stringify({ order }),
        });
        return true;
      } catch (e) {
        const snapMap = new Map(snapshot.map((s) => [s.id, s.position]));
        setChannels((prev) =>
          prev.map((c) => ({ ...c, position: snapMap.get(c.id) ?? c.position })).sort(byPositionName),
        );
        setError(readError(e, "Не удалось изменить порядок"));
        return false;
      }
    },
    [serverId, channels],
  );

  const moveChannelToCategory = useCallback(
    async (channelId: string, categoryId: string | null, position?: number): Promise<boolean> => {
      setError(null);
      const snapshot = channels;
      setChannels((prev) =>
        prev
          .map((c) => (c.id === channelId ? { ...c, categoryId, position: position ?? c.position } : c))
          .sort(byPositionName),
      );
      try {
        const data = await apiJson<{ channel: ChannelDto }>(
          `/api/channels/${encodeURIComponent(channelId)}/category`,
          {
            method: "PUT",
            body: JSON.stringify({ categoryId, ...(position !== undefined ? { position } : {}) }),
          },
        );
        const updated = normalizeChannel(data.channel);
        setChannels((prev) => prev.map((c) => (c.id === channelId ? updated : c)).sort(byPositionName));
        return true;
      } catch (e) {
        setChannels(snapshot);
        setError(readError(e, "Не удалось переместить канал"));
        return false;
      }
    },
    [channels],
  );

  const createCategory = useCallback(
    async (name: string): Promise<CategoryRow | null> => {
      if (!serverId) return null;
      setError(null);
      try {
        const data = await apiJson<{ category: CategoryDto }>(
          `/api/servers/${encodeURIComponent(serverId)}/categories`,
          {
            method: "POST",
            body: JSON.stringify({ name }),
          },
        );
        setCategories((prev) =>
          prev.some((c) => c.id === data.category.id) ? prev : [...prev, data.category].sort(byPositionName),
        );
        return data.category;
      } catch (e) {
        setError(readError(e, "Не удалось создать категорию"));
        return null;
      }
    },
    [serverId],
  );

  const renameCategory = useCallback(async (categoryId: string, name: string): Promise<boolean> => {
    setError(null);
    try {
      const data = await apiJson<{ category: CategoryDto }>(
        `/api/categories/${encodeURIComponent(categoryId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name }),
        },
      );
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? data.category : c)).sort(byPositionName));
      return true;
    } catch (e) {
      setError(readError(e, "Не удалось переименовать категорию"));
      return false;
    }
  }, []);

  const deleteCategory = useCallback(async (categoryId: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await api(`/api/categories/${encodeURIComponent(categoryId)}`, { method: "DELETE" });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return false;
      }
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      setChannels((prev) =>
        prev.map((c) => (c.categoryId === categoryId ? { ...c, categoryId: null } : c)).sort(byPositionName),
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить категорию");
      return false;
    }
  }, []);

  const reorderCategories = useCallback(
    async (orders: { id: string; position: number }[]): Promise<boolean> => {
      if (!serverId) return false;
      setError(null);
      const snapshot = categories;
      const orderMap = new Map(orders.map((o) => [o.id, o.position]));
      setCategories((prev) =>
        prev.map((c) => ({ ...c, position: orderMap.get(c.id) ?? c.position })).sort(byPositionName),
      );
      try {
        const data = await apiJson<{ categories: CategoryDto[] }>(
          `/api/servers/${encodeURIComponent(serverId)}/categories/reorder`,
          {
            method: "POST",
            body: JSON.stringify({ orders }),
          },
        );
        setCategories([...data.categories].sort(byPositionName));
        return true;
      } catch (e) {
        setCategories(snapshot);
        setError(readError(e, "Не удалось изменить порядок категорий"));
        return false;
      }
    },
    [serverId, categories],
  );

  const deleteChannel = useCallback(async (channelId: string): Promise<boolean> => {
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
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      setSelectedChannelId((cur) => (cur === channelId ? null : cur));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить канал");
      return false;
    }
  }, []);

  return {
    channels,
    categories,
    selectedChannelId,
    setSelectedChannelId,
    error,
    loading,
    reload,
    createChannel,
    updateChannel,
    reorderChannels,
    moveChannelToCategory,
    createCategory,
    renameCategory,
    deleteCategory,
    reorderCategories,
    deleteChannel,
    unread,
  };
}
