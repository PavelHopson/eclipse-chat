import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import { SocketEvents } from "../lib/socket";

export type MemoryKind = "NOTE" | "DECISION" | "RISK" | "FACT" | "LINK" | "ACTION";
export type MemoryVisibility = "ROOM" | "WORKSPACE";
export type MemoryLifecycleStatus = "ACTIVE" | "REVIEW_DUE" | "EXPIRED" | "ARCHIVED";
export type MemoryListState = "active" | "archived";

export type MemoryUser = {
  id: string;
  displayName: string;
  avatar: string | null;
  isBot: boolean;
  botRole: string | null;
};

export type ChannelMemoryEntry = {
  id: string;
  serverId: string;
  channelId: string | null;
  channel: { id: string; name: string; internal: boolean } | null;
  kind: MemoryKind;
  visibility: MemoryVisibility;
  title: string;
  content: string | null;
  tags: string[];
  sourceMessageId: string | null;
  actionItemId: string | null;
  actionItem: { id: string; title: string; type: string } | null;
  owner: MemoryUser;
  reviewDueAt: string | null;
  lastReviewedAt: string | null;
  lastReviewedBy: MemoryUser;
  expiresAt: string | null;
  archivedAt: string | null;
  archivedBy: MemoryUser | null;
  createdAt: string;
  updatedAt: string;
  createdBy: MemoryUser;
  lifecycle: {
    status: MemoryLifecycleStatus;
    contextEligible: boolean;
    contextReason: string;
  };
  permissions: {
    canEdit: boolean;
    canArchive: boolean;
    canRestore: boolean;
    canReview: boolean;
    canReassign: boolean;
  };
};

export type CreateMemoryEntryInput = {
  kind: MemoryKind;
  title: string;
  content?: string | null;
  tags?: string[];
  visibility?: MemoryVisibility;
  ownerUserId?: string;
  reviewDueAt?: string | null;
  expiresAt?: string | null;
  sourceMessageId?: string;
  actionItemId?: string;
};

export type UpdateMemoryEntryInput = Partial<
  Pick<
    CreateMemoryEntryInput,
    | "kind"
    | "title"
    | "content"
    | "tags"
    | "visibility"
    | "ownerUserId"
    | "reviewDueAt"
    | "expiresAt"
  >
>;

export type MemorySuggestion = {
  kind: MemoryKind;
  title: string;
  content: string | null;
  tags: string[];
};

type MemoryResponse = {
  entries: ChannelMemoryEntry[];
  state: MemoryListState;
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
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listState, setListState] = useState<MemoryListState>("active");

  const refresh = useCallback(async () => {
    if (!channelId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<MemoryResponse>(
        `/api/channels/${encodeURIComponent(channelId)}/memory?state=${listState}`,
      );
      setEntries(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  }, [channelId, listState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || !channelId) return;
    let timer: number | null = null;
    const onMemoryUpdated = (payload: { channelId?: string; workspace?: boolean }) => {
      if (payload.channelId !== channelId && !payload.workspace) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 250);
    };
    socket.on(SocketEvents.MemoryUpdated, onMemoryUpdated);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      socket.off(SocketEvents.MemoryUpdated, onMemoryUpdated);
    };
  }, [socket, channelId, refresh]);

  const mergeEntry = useCallback((entry: ChannelMemoryEntry) => {
    const belongsInView =
      (listState === "active" && !entry.archivedAt) ||
      (listState === "archived" && Boolean(entry.archivedAt));
    setEntries((current) =>
      belongsInView
        ? [entry, ...current.filter((item) => item.id !== entry.id)]
        : current.filter((item) => item.id !== entry.id),
    );
  }, [listState]);

  const createEntryForChannel = useCallback(
    async (
      targetChannelId: string,
      input: CreateMemoryEntryInput,
    ): Promise<ChannelMemoryEntry | null> => {
      setSaving(true);
      setError(null);
      try {
        const data = await apiJson<SingleMemoryResponse>(
          `/api/channels/${encodeURIComponent(targetChannelId)}/memory`,
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        );
        if (targetChannelId === channelId) mergeEntry(data.entry);
        return data.entry;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save memory");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [channelId, mergeEntry],
  );

  const archiveEntry = useCallback(async (id: string): Promise<boolean> => {
    setMutatingId(id);
    setError(null);
    try {
      const data = await apiJson<SingleMemoryResponse>(`/api/memory/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      mergeEntry(data.entry);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive memory");
      return false;
    } finally {
      setMutatingId(null);
    }
  }, [mergeEntry]);

  const updateEntry = useCallback(async (
    id: string,
    input: UpdateMemoryEntryInput,
  ): Promise<ChannelMemoryEntry | null> => {
    setMutatingId(id);
    setError(null);
    try {
      const data = await apiJson<SingleMemoryResponse>(`/api/memory/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      mergeEntry(data.entry);
      return data.entry;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update memory");
      return null;
    } finally {
      setMutatingId(null);
    }
  }, [mergeEntry]);

  const reviewEntry = useCallback(async (
    id: string,
    reviewDueAt?: string | null,
  ): Promise<ChannelMemoryEntry | null> => {
    setMutatingId(id);
    setError(null);
    try {
      const data = await apiJson<SingleMemoryResponse>(
        `/api/memory/${encodeURIComponent(id)}/review`,
        {
          method: "POST",
          body: JSON.stringify(reviewDueAt === undefined ? {} : { reviewDueAt }),
        },
      );
      mergeEntry(data.entry);
      return data.entry;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to review memory");
      return null;
    } finally {
      setMutatingId(null);
    }
  }, [mergeEntry]);

  const restoreEntry = useCallback(async (id: string): Promise<boolean> => {
    setMutatingId(id);
    setError(null);
    try {
      const data = await apiJson<SingleMemoryResponse>(
        `/api/memory/${encodeURIComponent(id)}/restore`,
        { method: "POST", body: "{}" },
      );
      mergeEntry(data.entry);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore memory");
      return false;
    } finally {
      setMutatingId(null);
    }
  }, [mergeEntry]);

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

  const suggestActionItem = useCallback(
    async (targetChannelId: string, actionItemId: string): Promise<MemorySuggestion> => {
      setSuggesting(true);
      try {
        const data = await apiJson<MemorySuggestionResponse>(
          `/api/channels/${encodeURIComponent(targetChannelId)}/memory/suggest`,
          {
            method: "POST",
            body: JSON.stringify({ actionItemId }),
          },
        );
        return data.suggestion;
      } finally {
        setSuggesting(false);
      }
    },
    [],
  );

  const createEntry = useCallback(
    async (input: CreateMemoryEntryInput): Promise<ChannelMemoryEntry | null> => {
      if (!channelId) return null;
      return createEntryForChannel(channelId, input);
    },
    [channelId, createEntryForChannel],
  );

  return {
    entries,
    loading,
    saving,
    mutatingId,
    suggesting,
    error,
    listState,
    setListState,
    refresh,
    createEntry,
    createEntryForChannel,
    suggestEntry,
    suggestActionItem,
    updateEntry,
    reviewEntry,
    archiveEntry,
    restoreEntry,
  };
}
