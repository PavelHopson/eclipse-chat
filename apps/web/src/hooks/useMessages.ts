import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import {
  SocketEvents,
  type AttachmentPayload,
  type MessageDeletedPayload,
  type MessageNewPayload,
  type MessagePinnedPayload,
  type MessageUnpinnedPayload,
  type MessageUpdatedPayload,
  type ReactionAddedPayload,
  type ReactionRemovedPayload,
} from "../lib/socket";

export type ReactionAggregate = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type Attachment = AttachmentPayload;

/** Payload, отправляемый клиентом на POST /messages. */
export type AttachmentUpload = {
  filename: string;
  mimeType: string;
  dataBase64: string;
};

export type MessageRow = {
  id: string;
  content: string;
  createdAt: string;
  /** ISO. Null = не редактировалось. */
  editedAt: string | null;
  /** ISO. Set = сообщение soft-deleted, content скрыт. */
  deletedAt: string | null;
  /** ISO. Set = сообщение закреплено. */
  pinnedAt: string | null;
  user: { id: string; displayName: string; avatar: string | null };
  /** Агрегированные реакции, отсортированы backend'ом по emoji. */
  reactions: ReactionAggregate[];
  /** Прикреплённые файлы, sorted by position asc. */
  attachments: Attachment[];
  /** UI-only: оптимистично отправлено, ждём backend. */
  pending?: boolean;
  /** UI-only: backend вернул ошибку. */
  failed?: boolean;
};

type Sender = { id: string; displayName: string; avatar: string | null };

function defaultLifecycle<T extends {
  editedAt?: string | null;
  deletedAt?: string | null;
  pinnedAt?: string | null;
  reactions?: ReactionAggregate[];
  attachments?: Attachment[];
}>(m: T): T & {
  editedAt: string | null;
  deletedAt: string | null;
  pinnedAt: string | null;
  reactions: ReactionAggregate[];
  attachments: Attachment[];
} {
  return {
    ...m,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
    pinnedAt: m.pinnedAt ?? null,
    reactions: m.reactions ?? [],
    attachments: m.attachments ?? [],
  };
}

export function useMessages(
  channelId: string | null,
  socket: Socket | null,
  currentUserId?: string,
) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const channelIdRef = useRef<string | null>(channelId);
  channelIdRef.current = channelId;
  const currentUserIdRef = useRef<string | undefined>(currentUserId);
  currentUserIdRef.current = currentUserId;

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiJson<{ messages: MessageRow[] }>(
      `/api/channels/${encodeURIComponent(channelId)}/messages?take=80`,
    )
      .then((data) => {
        if (!cancelled) {
          setMessages(data.messages.map((m) => defaultLifecycle(m)));
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Не удалось загрузить сообщения");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    if (socket) {
      socket.emit(SocketEvents.ChannelJoin, channelId);
    }
    return () => {
      cancelled = true;
      if (socket && channelId) {
        socket.emit(SocketEvents.ChannelLeave, channelId);
      }
    };
  }, [channelId, socket]);

  // socket: message:new
  useEffect(() => {
    if (!socket) return;
    const handler = (p: MessageNewPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === p.messageId)) return prev;
        const optimisticIdx = prev.findIndex(
          (m) => m.pending && m.user.id === p.userId && m.content === p.content,
        );
        const incoming: MessageRow = {
          id: p.messageId,
          content: p.content,
          createdAt: p.createdAt,
          editedAt: null,
          deletedAt: null,
          pinnedAt: null,
          user: { id: p.userId, displayName: p.displayName, avatar: p.avatar },
          reactions: [],
          attachments: p.attachments ?? [],
        };
        if (optimisticIdx >= 0) {
          const next = prev.slice();
          next[optimisticIdx] = incoming;
          return next;
        }
        return [...prev, incoming];
      });
    };
    socket.on(SocketEvents.MessageNew, handler);
    return () => {
      socket.off(SocketEvents.MessageNew, handler);
    };
  }, [socket]);

  // socket: reaction:added / reaction:removed
  useEffect(() => {
    if (!socket) return;
    const onAdded = (p: ReactionAddedPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      const isMine = p.userId === currentUserIdRef.current;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== p.messageId) return m;
          const idx = m.reactions.findIndex((r) => r.emoji === p.emoji);
          if (idx >= 0) {
            const next = m.reactions.slice();
            const cur = next[idx];
            next[idx] = { emoji: cur.emoji, count: cur.count + 1, mine: cur.mine || isMine };
            return { ...m, reactions: next };
          }
          return { ...m, reactions: [...m.reactions, { emoji: p.emoji, count: 1, mine: isMine }] };
        }),
      );
    };
    const onRemoved = (p: ReactionRemovedPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      const isMine = p.userId === currentUserIdRef.current;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== p.messageId) return m;
          const idx = m.reactions.findIndex((r) => r.emoji === p.emoji);
          if (idx < 0) return m;
          const cur = m.reactions[idx];
          const nextCount = Math.max(0, cur.count - 1);
          if (nextCount === 0) {
            return { ...m, reactions: m.reactions.filter((r) => r.emoji !== p.emoji) };
          }
          const next = m.reactions.slice();
          next[idx] = { emoji: cur.emoji, count: nextCount, mine: isMine ? false : cur.mine };
          return { ...m, reactions: next };
        }),
      );
    };
    socket.on(SocketEvents.ReactionAdded, onAdded);
    socket.on(SocketEvents.ReactionRemoved, onRemoved);
    return () => {
      socket.off(SocketEvents.ReactionAdded, onAdded);
      socket.off(SocketEvents.ReactionRemoved, onRemoved);
    };
  }, [socket]);

  // socket: message:updated / deleted / pinned / unpinned
  useEffect(() => {
    if (!socket) return;
    const onUpdated = (p: MessageUpdatedPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === p.messageId ? { ...m, content: p.content, editedAt: p.editedAt } : m,
        ),
      );
    };
    const onDeleted = (p: MessageDeletedPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === p.messageId ? { ...m, content: "", deletedAt: p.deletedAt, pinnedAt: null } : m,
        ),
      );
    };
    const onPinned = (p: MessagePinnedPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === p.messageId ? { ...m, pinnedAt: p.pinnedAt } : m)),
      );
    };
    const onUnpinned = (p: MessageUnpinnedPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === p.messageId ? { ...m, pinnedAt: null } : m)),
      );
    };
    socket.on(SocketEvents.MessageUpdated, onUpdated);
    socket.on(SocketEvents.MessageDeleted, onDeleted);
    socket.on(SocketEvents.MessagePinned, onPinned);
    socket.on(SocketEvents.MessageUnpinned, onUnpinned);
    return () => {
      socket.off(SocketEvents.MessageUpdated, onUpdated);
      socket.off(SocketEvents.MessageDeleted, onDeleted);
      socket.off(SocketEvents.MessagePinned, onPinned);
      socket.off(SocketEvents.MessageUnpinned, onUnpinned);
    };
  }, [socket]);

  const sendMessage = useCallback(
    async (
      content: string,
      sender: Sender,
      attachments: AttachmentUpload[] = [],
    ): Promise<boolean> => {
      if (!channelId) return false;
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return false;
      setError(null);

      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Optimistic attachments: для preview используем dataBase64 как inline
      // image src через `data:` URI, чтобы пока сервер не ответил, в UI
      // уже было видно что прикреплено. После socket message:new — заменим.
      const optimisticAttachments: Attachment[] = attachments.map((a, i) => ({
        id: `local-att-${i}`,
        filename: a.filename,
        mimeType: a.mimeType,
        size: Math.ceil((a.dataBase64.length * 3) / 4),
        url: `data:${a.mimeType};base64,${a.dataBase64}`,
        thumbnailUrl: null,
        width: null,
        height: null,
        position: i,
      }));
      const optimistic: MessageRow = {
        id: localId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        pinnedAt: null,
        user: sender,
        reactions: [],
        attachments: optimisticAttachments,
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        await apiJson(`/api/channels/${encodeURIComponent(channelId)}/messages`, {
          method: "POST",
          body: JSON.stringify({
            content: trimmed,
            attachments: attachments.length > 0 ? attachments : undefined,
          }),
        });
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === localId && m.pending ? { ...m, pending: false } : m)),
          );
        }, 10_000);
        return true;
      } catch (e) {
        setMessages((prev) =>
          prev.map((m) => (m.id === localId ? { ...m, pending: false, failed: true } : m)),
        );
        setError(e instanceof ApiError ? e.message : "Не удалось отправить");
        return false;
      }
    },
    [channelId],
  );

  const retryMessage = useCallback(
    async (messageId: string, sender: Sender): Promise<boolean> => {
      const target = messages.find((m) => m.id === messageId);
      if (!target || !channelId) return false;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return sendMessage(target.content, sender);
    },
    [messages, channelId, sendMessage],
  );

  const editMessage = useCallback(async (messageId: string, content: string): Promise<boolean> => {
    const trimmed = content.trim();
    if (!trimmed) return false;
    setError(null);
    try {
      await apiJson(`/api/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        body: JSON.stringify({ content: trimmed }),
      });
      // Socket message:updated придёт и обновит state — никакой local mutation.
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось изменить");
      return false;
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await api(`/api/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
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
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
      return false;
    }
  }, []);

  const pinMessage = useCallback(async (messageId: string): Promise<boolean> => {
    setError(null);
    try {
      await apiJson(`/api/messages/${encodeURIComponent(messageId)}/pin`, { method: "POST" });
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось закрепить");
      return false;
    }
  }, []);

  const unpinMessage = useCallback(async (messageId: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await api(`/api/messages/${encodeURIComponent(messageId)}/pin`, { method: "DELETE" });
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
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открепить");
      return false;
    }
  }, []);

  const addReaction = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
    setError(null);
    try {
      await apiJson(`/api/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось добавить реакцию");
      return false;
    }
  }, []);

  const removeReaction = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await api(
        `/api/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`,
        { method: "DELETE" },
      );
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
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось снять реакцию");
      return false;
    }
  }, []);

  /** Toggle: если mine=true → remove, иначе add. */
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string): Promise<boolean> => {
      const m = messages.find((x) => x.id === messageId);
      const existing = m?.reactions.find((r) => r.emoji === emoji);
      if (existing?.mine) {
        return removeReaction(messageId, emoji);
      }
      return addReaction(messageId, emoji);
    },
    [messages, addReaction, removeReaction],
  );

  return {
    messages,
    error,
    loading,
    sendMessage,
    retryMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    addReaction,
    removeReaction,
    toggleReaction,
  };
}
