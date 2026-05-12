import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import {
  SocketEvents,
  type DmMessageDeletedPayload,
  type DmMessageNewPayload,
  type DmMessageUpdatedPayload,
  type DmReactionAddedPayload,
  type DmReactionRemovedPayload,
} from "../lib/socket";
import type { MessageRow, AttachmentUpload } from "./useMessages";

/**
 * DM messages — параллель к useMessages, но scoped к conversationId.
 *
 * Reuses MessageRow type. Не поддерживает pin (нет ролей в DM) и не использует
 * channel-specific events. Optimistic send + edit + delete + reactions.
 *
 * Frontend подписан на `dm:${conversationId}` socket room (через explicit
 * `dm:join` event, backend verify membership).
 */

type Sender = { id: string; displayName: string; avatar: string | null };

export function useDirectMessages(
  conversationId: string | null,
  socket: Socket | null,
  currentUserId: string,
) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs для idempotent updates вне React render lifecycle
  const messagesRef = useRef<MessageRow[]>([]);
  messagesRef.current = messages;

  // Initial load + reload при смене conversationId
  const reload = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ conversationId: string; messages: MessageRow[] }>(
        `/api/dm/conversations/${encodeURIComponent(conversationId)}/messages?take=50`,
      );
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load DM messages");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Socket: join + listen to events
  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit(SocketEvents.DmJoin, conversationId);

    const onNew = (p: DmMessageNewPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) => {
        // Замена optimistic pending message — match по userId + content
        const pendingIdx = prev.findIndex(
          (m) =>
            m.pending &&
            m.user.id === p.userId &&
            m.content === p.content &&
            m.id.startsWith("local-"),
        );
        const newRow: MessageRow = {
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
        if (pendingIdx !== -1) {
          const next = [...prev];
          next[pendingIdx] = newRow;
          return next;
        }
        // Дедуп по id если уже добавили
        if (prev.some((m) => m.id === newRow.id)) return prev;
        return [...prev, newRow];
      });
    };

    const onUpdated = (p: DmMessageUpdatedPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === p.messageId ? { ...m, content: p.content, editedAt: p.editedAt } : m,
        ),
      );
    };

    const onDeleted = (p: DmMessageDeletedPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === p.messageId
            ? { ...m, deletedAt: p.deletedAt, content: "", attachments: [] }
            : m,
        ),
      );
    };

    const onReactionAdded = (p: DmReactionAddedPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== p.messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === p.emoji);
          if (existing) {
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === p.emoji
                  ? { ...r, count: r.count + 1, mine: r.mine || p.userId === currentUserId }
                  : r,
              ),
            };
          }
          return {
            ...m,
            reactions: [
              ...m.reactions,
              { emoji: p.emoji, count: 1, mine: p.userId === currentUserId },
            ],
          };
        }),
      );
    };

    const onReactionRemoved = (p: DmReactionRemovedPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== p.messageId) return m;
          return {
            ...m,
            reactions: m.reactions
              .map((r) =>
                r.emoji === p.emoji
                  ? {
                      ...r,
                      count: r.count - 1,
                      mine: p.userId === currentUserId ? false : r.mine,
                    }
                  : r,
              )
              .filter((r) => r.count > 0),
          };
        }),
      );
    };

    socket.on(SocketEvents.DmMessageNew, onNew);
    socket.on(SocketEvents.DmMessageUpdated, onUpdated);
    socket.on(SocketEvents.DmMessageDeleted, onDeleted);
    socket.on(SocketEvents.DmReactionAdded, onReactionAdded);
    socket.on(SocketEvents.DmReactionRemoved, onReactionRemoved);

    return () => {
      socket.emit(SocketEvents.DmLeave, conversationId);
      socket.off(SocketEvents.DmMessageNew, onNew);
      socket.off(SocketEvents.DmMessageUpdated, onUpdated);
      socket.off(SocketEvents.DmMessageDeleted, onDeleted);
      socket.off(SocketEvents.DmReactionAdded, onReactionAdded);
      socket.off(SocketEvents.DmReactionRemoved, onReactionRemoved);
    };
  }, [socket, conversationId, currentUserId]);

  /** Optimistic send. */
  const sendMessage = useCallback(
    async (
      content: string,
      sender: Sender,
      attachments?: AttachmentUpload[],
    ): Promise<boolean> => {
      if (!conversationId) return false;
      const trimmed = content.trim();
      const hasAttachments = attachments && attachments.length > 0;
      if (!trimmed && !hasAttachments) return false;
      const localId = `local-${Math.random().toString(36).slice(2)}`;
      const optimistic: MessageRow = {
        id: localId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        pinnedAt: null,
        user: { id: sender.id, displayName: sender.displayName, avatar: sender.avatar },
        reactions: [],
        attachments: [],
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        await apiJson(
          `/api/dm/conversations/${encodeURIComponent(conversationId)}/messages`,
          {
            method: "POST",
            body: JSON.stringify({ content: trimmed, attachments }),
          },
        );
        // success — wait for socket event to replace optimistic
        return true;
      } catch (e) {
        // Mark failed
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId ? { ...m, pending: false, failed: true } : m,
          ),
        );
        setError(e instanceof Error ? e.message : "Failed to send DM");
        return false;
      }
    },
    [conversationId],
  );

  const retryMessage = useCallback(
    async (localId: string, _sender: Sender): Promise<boolean> => {
      const msg = messagesRef.current.find((m) => m.id === localId);
      if (!msg) return false;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === localId ? { ...m, pending: true, failed: false } : m,
        ),
      );
      try {
        await apiJson(
          `/api/dm/conversations/${encodeURIComponent(conversationId!)}/messages`,
          {
            method: "POST",
            body: JSON.stringify({ content: msg.content }),
          },
        );
        return true;
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId ? { ...m, pending: false, failed: true } : m,
          ),
        );
        return false;
      }
    },
    [conversationId],
  );

  const editMessage = useCallback(async (messageId: string, content: string): Promise<boolean> => {
    try {
      await apiJson(`/api/dm/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      return true;
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      }
      return false;
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      await apiJson(`/api/dm/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
      });
      return true;
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      }
      return false;
    }
  }, []);

  /** Toggle reaction (add if absent, remove if present) — reuses /api/messages/:id endpoints. */
  const toggleReaction = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
    const m = messagesRef.current.find((mm) => mm.id === messageId);
    const mine = m?.reactions.find((r) => r.emoji === emoji)?.mine ?? false;
    try {
      if (mine) {
        await api(
          `/api/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`,
          { method: "DELETE" },
        );
      } else {
        await apiJson(`/api/messages/${encodeURIComponent(messageId)}/reactions`, {
          method: "POST",
          body: JSON.stringify({ emoji }),
        });
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      }
      return false;
    }
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    retryMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
  };
}
