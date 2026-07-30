import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import { SocketEvents } from "../lib/socket";

export type MemoryKind = "NOTE" | "DECISION" | "RISK" | "FACT" | "LINK" | "ACTION";

export type ChannelMemoryEntry = {
  id: string;
  serverId: string;
  channelId: string | null;
  kind: MemoryKind;
  title: string;
  content: string | null;
  tags: string[];
  sourceMessageId: string | null;
  actionItemId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    displayName: string;
    avatar: string | null;
    isBot: boolean;
    botRole: string | null;
  };
};

export type CreateMemoryEntryInput = {
  kind: MemoryKind;
  title: string;
  content?: string | null;
  tags?: string[];
  sourceMessageId?: string;
  actionItemId?: string;
};

export type MemorySuggestion = {
  kind: MemoryKind;
  title: string;
  content: string | null;
  tags: string[];
};

type MemoryResponse = {
  entries: ChannelMemoryEntry[];
};

type SingleMemoryResponse = {
  entry: ChannelMemoryEntry;
};

type MemorySuggestionResponse = {
  suggestion: MemorySuggestion;
};

export function useChannelMemory(channelId: string | null, socket?: Socket | null) {
  const [entries, setEntries] = useState<ChannelMemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!channelId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<MemoryResponse>(
        `/api/channels/${encodeURIComponent(channelId)}/memory`,
      );
      setEntries(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || !channelId) return;
    let timer: number | null = null;
    const onMemoryUpdated = (payload: { channelId?: string }) => {
      if (payload.channelId !== channelId) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 250);
    };
    socket.on(SocketEvents.MemoryUpdated, onMemoryUpdated);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      socket.off(SocketEvents.MemoryUpdated, onMemoryUpdated);
    };
  }, [socket, channelId, refresh]);

  const createEntry = useCallback(
    async (input: CreateMemoryEntryInput): Promise<ChannelMemoryEntry | null> => {
      if (!channelId) return null;
      setSaving(true);
      setError(null);
      try {
        const data = await apiJson<SingleMemoryResponse>(
          `/api/channels/${encodeURIComponent(channelId)}/memory`,
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        );
        setEntries((current) => [data.entry, ...current.filter((entry) => entry.id !== data.entry.id)]);
        return data.entry;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save memory");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [channelId],
  );

  const archiveEntry = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      await apiJson<SingleMemoryResponse>(`/api/memory/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setEntries((current) => current.filter((entry) => entry.id !== id));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive memory");
      return false;
    }
  }, []);

  const suggestEntry = useCallback(
    async (messageId: string): Promise<MemorySuggestion> => {
      if (!channelId) throw new Error("Сначала выберите комнату");
      setSuggesting(true);
      try {
        const data = await apiJson<MemorySuggestionResponse>(
          `/api/channels/${encodeURIComponent(channelId)}/memory/suggest`,
          {
            method: "POST",
            body: JSON.stringify({ messageId }),
          },
        );
        return data.suggestion;
      } finally {
        setSuggesting(false);
      }
    },
    [channelId],
  );

  return {
    entries,
    loading,
    saving,
    suggesting,
    error,
    refresh,
    createEntry,
    suggestEntry,
    archiveEntry,
  };
}
