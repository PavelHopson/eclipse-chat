import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import {
  SocketEvents,
  type MessageDeletedPayload,
  type MessageNewPayload,
  type MessagePinnedPayload,
  type MessageUnpinnedPayload,
  type MessageUpdatedPayload,
} from "../lib/socket";

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
  /** UI-only: оптимистично отправлено, ждём backend. */
  pending?: boolean;
  /** UI-only: backend вернул ошибку. */
  failed?: boolean;
};

type Sender = { id: string; displayName: string; avatar: string | null };

function defaultLifecycle<T extends { editedAt?: string | null; deletedAt?: string | null; pinnedAt?: string | null }>(m: T): T & {
  editedAt: string | null;
  deletedAt: string | null;
  pinnedAt: string | null;
} {
  return {
    ...m,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
    pinnedAt: m.pinnedAt ?? null,
  };
}

export function useMessages(channelId: string | null, socket: Socket | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const channelIdRef = useRef<string | null>(channelId);
  channelIdRef.current = channelId;

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
    async (content: string, sender: Sender): Promise<boolean> => {
      if (!channelId) return false;
      const trimmed = content.trim();
      if (!trimmed) return false;
      setError(null);

      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic: MessageRow = {
        id: localId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        pinnedAt: null,
        user: sender,
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        await apiJson(`/api/channels/${encodeURIComponent(channelId)}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: trimmed }),
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
  };
}
