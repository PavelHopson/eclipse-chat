import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import {
  SocketEvents,
  type ActionItemPayload,
  type ActionItemStatus,
  type ActionItemType,
  type AttachmentPayload,
  type MessageDeletedPayload,
  type MessageNewPayload,
  type MessagePinnedPayload,
  type MessageUnpinnedPayload,
  type MessageUpdatedPayload,
  type ReactionAddedPayload,
  type ReactionRemovedPayload,
  type TypingStartPayload,
  type TypingStopPayload,
} from "../lib/socket";

export type TypingUser = {
  userId: string;
  displayName: string;
};

export type ReactionAggregate = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type Attachment = AttachmentPayload;
export type { ActionItemStatus, ActionItemType };
export type MessageActionItem = ActionItemPayload;
export type ActionItemUpdatePatch = {
  status?: ActionItemStatus;
  title?: string;
  assigneeUserId?: string | null;
  dueAt?: string | null;
};

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
  /** Action layer поверх сообщения: task / decision / follow-up. */
  actionItems: MessageActionItem[];
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
  actionItems?: MessageActionItem[];
}>(m: T): T & {
  editedAt: string | null;
  deletedAt: string | null;
  pinnedAt: string | null;
  reactions: ReactionAggregate[];
  attachments: Attachment[];
  actionItems: MessageActionItem[];
} {
  return {
    ...m,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
    pinnedAt: m.pinnedAt ?? null,
    reactions: m.reactions ?? [],
    attachments: m.attachments ?? [],
    actionItems: m.actionItems ?? [],
  };
}

function sortMessageActionItems(items: MessageActionItem[]) {
  return items.slice().sort((a, b) => {
    if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function upsertMessageAction(messages: MessageRow[], action: MessageActionItem): MessageRow[] {
  return messages.map((message) => {
    if (message.id !== action.sourceMessageId) return message;
    const next = message.actionItems.filter((item) => item.id !== action.id);
    next.push(action);
    return {
      ...message,
      actionItems: sortMessageActionItems(next),
    };
  });
}

function mergeOpenActions(items: MessageActionItem[], action: MessageActionItem): MessageActionItem[] {
  if (action.status === "DONE") {
    return items.filter((item) => item.id !== action.id);
  }
  const next = items.filter((item) => item.id !== action.id);
  next.unshift(action);
  return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function useMessages(
  channelId: string | null,
  socket: Socket | null,
  currentUserId?: string,
) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [openActionItems, setOpenActionItems] = useState<MessageActionItem[]>([]);

  const channelIdRef = useRef<string | null>(channelId);
  channelIdRef.current = channelId;
  const currentUserIdRef = useRef<string | undefined>(currentUserId);
  currentUserIdRef.current = currentUserId;

  /**
   * Per-user typing expiry timers. Auto-remove если typing:stop не пришёл
   * за 5 секунд (защита от broken sockets / orphan typing state).
   */
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Очищаем все таймеры на unmount + при смене канала
  useEffect(() => {
    setTypingUsers([]);
    for (const t of typingTimers.current.values()) clearTimeout(t);
    typingTimers.current.clear();
  }, [channelId]);
  useEffect(() => {
    return () => {
      for (const t of typingTimers.current.values()) clearTimeout(t);
      typingTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setOpenActionItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setOpenActionItems([]);
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

    apiJson<{ actions: MessageActionItem[] }>(
      `/api/channels/${encodeURIComponent(channelId)}/actions?status=OPEN`,
    )
      .then((data) => {
        if (!cancelled) {
          setOpenActionItems(data.actions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpenActionItems([]);
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
          actionItems: [],
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

  useEffect(() => {
    if (!socket) return;
    const onCreated = (payload: ActionItemPayload) => {
      if (payload.channelId !== channelIdRef.current) return;
      setMessages((prev) => upsertMessageAction(prev, payload));
      setOpenActionItems((prev) => mergeOpenActions(prev, payload));
    };
    const onUpdated = (payload: ActionItemPayload) => {
      if (payload.channelId !== channelIdRef.current) return;
      setMessages((prev) => upsertMessageAction(prev, payload));
      setOpenActionItems((prev) => mergeOpenActions(prev, payload));
    };
    socket.on(SocketEvents.ActionItemCreated, onCreated);
    socket.on(SocketEvents.ActionItemUpdated, onUpdated);
    return () => {
      socket.off(SocketEvents.ActionItemCreated, onCreated);
      socket.off(SocketEvents.ActionItemUpdated, onUpdated);
    };
  }, [socket]);

  // socket: typing:start / typing:stop
  useEffect(() => {
    if (!socket) return;
    const onStart = (p: TypingStartPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      if (p.userId === currentUserIdRef.current) return; // не показываем себя
      setTypingUsers((prev) => {
        if (prev.some((u) => u.userId === p.userId)) {
          // Обновить displayName на случай если поменялось
          return prev.map((u) => (u.userId === p.userId ? { ...u, displayName: p.displayName } : u));
        }
        return [...prev, { userId: p.userId, displayName: p.displayName }];
      });
      // Reset auto-expire таймер
      const existing = typingTimers.current.get(p.userId);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        typingTimers.current.delete(p.userId);
        setTypingUsers((prev) => prev.filter((u) => u.userId !== p.userId));
      }, 5_000);
      typingTimers.current.set(p.userId, t);
    };
    const onStop = (p: TypingStopPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      setTypingUsers((prev) => prev.filter((u) => u.userId !== p.userId));
      const t = typingTimers.current.get(p.userId);
      if (t) {
        clearTimeout(t);
        typingTimers.current.delete(p.userId);
      }
    };
    socket.on(SocketEvents.TypingStart, onStart);
    socket.on(SocketEvents.TypingStop, onStop);
    return () => {
      socket.off(SocketEvents.TypingStart, onStart);
      socket.off(SocketEvents.TypingStop, onStop);
    };
  }, [socket]);

  /** Emit typing:start (для composer'а). Backend сам resolve'ит displayName. */
  const emitTypingStart = useCallback(() => {
    if (!socket || !channelId) return;
    socket.emit(SocketEvents.TypingStart, channelId);
  }, [socket, channelId]);

  const emitTypingStop = useCallback(() => {
    if (!socket || !channelId) return;
    socket.emit(SocketEvents.TypingStop, channelId);
  }, [socket, channelId]);

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
          m.id === p.messageId
            ? { ...m, content: "", deletedAt: p.deletedAt, pinnedAt: null, actionItems: [] }
            : m,
        ),
      );
      setOpenActionItems((prev) => prev.filter((item) => item.sourceMessageId !== p.messageId));
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
        actionItems: [],
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

  const createActionItem = useCallback(
    async (messageId: string, type: ActionItemType): Promise<boolean> => {
      setError(null);
      try {
        const data = await apiJson<{ action: MessageActionItem }>(
          `/api/messages/${encodeURIComponent(messageId)}/actions`,
          {
            method: "POST",
            body: JSON.stringify({ type }),
          },
        );
        setMessages((prev) => upsertMessageAction(prev, data.action));
        setOpenActionItems((prev) => mergeOpenActions(prev, data.action));
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось создать action item");
        return false;
      }
    },
    [],
  );

  const updateActionItem = useCallback(
    async (actionId: string, patch: ActionItemUpdatePatch): Promise<boolean> => {
      setError(null);
      try {
        const data = await apiJson<{ action: MessageActionItem }>(
          `/api/actions/${encodeURIComponent(actionId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(patch),
          },
        );
        setMessages((prev) => upsertMessageAction(prev, data.action));
        setOpenActionItems((prev) => mergeOpenActions(prev, data.action));
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось обновить action item");
        return false;
      }
    },
    [],
  );

  const updateActionItemStatus = useCallback(
    async (actionId: string, status: ActionItemStatus): Promise<boolean> => {
      return updateActionItem(actionId, { status });
    },
    [updateActionItem],
  );

  return {
    messages,
    openActionItems,
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
    createActionItem,
    updateActionItem,
    updateActionItemStatus,
    typingUsers,
    emitTypingStart,
    emitTypingStop,
  };
}
