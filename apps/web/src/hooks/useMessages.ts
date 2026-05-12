import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, apiJson } from "../lib/api";
import { SocketEvents, type MessageNewPayload } from "../lib/socket";

export type MessageRow = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; displayName: string; avatar: string | null };
  /** UI-only: сообщение отправлено оптимистично, ждём ответа сервера. */
  pending?: boolean;
  /** UI-only: backend вернул ошибку, сообщение не доставлено. */
  failed?: boolean;
};

/**
 * Сообщения выбранного канала.
 *
 *  - При смене channelId: подписка `channel:join`, загрузка истории.
 *  - При unmount / next channel: `channel:leave`.
 *  - На `message:new`: добавляет в state (только для текущего канала),
 *    + сверяет с оптимистично отправленным (dedupe по content + senderId
 *    в последнем pending).
 *  - sendMessage: оптимистично добавляет с временным id `local-...`,
 *    POST, на 200 — заменяет id на серверный; на error — flag failed.
 */
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
          setMessages(data.messages);
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

  // socket: новые сообщения. Дедупликация: если совпадает с pending
  // оптимистичным (same userId + same content) — заменяем pending на серверный.
  useEffect(() => {
    if (!socket) return;
    const handler = (p: MessageNewPayload) => {
      if (p.channelId !== channelIdRef.current) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === p.messageId)) return prev;
        // Попробуем найти соответствующий optimistic — заменим in-place
        const optimisticIdx = prev.findIndex(
          (m) => m.pending && m.user.id === p.userId && m.content === p.content,
        );
        const incoming: MessageRow = {
          id: p.messageId,
          content: p.content,
          createdAt: p.createdAt,
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

  const sendMessage = useCallback(
    async (content: string, sender: { id: string; displayName: string; avatar: string | null }): Promise<boolean> => {
      if (!channelId) return false;
      const trimmed = content.trim();
      if (!trimmed) return false;
      setError(null);

      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic: MessageRow = {
        id: localId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        user: sender,
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        await apiJson(`/api/channels/${encodeURIComponent(channelId)}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: trimmed }),
        });
        // На успешный ответ — socket эмит придёт и заменит pending'ивший.
        // Дополнительно гарантируем: если socket почему-то не пришёл за 10с —
        // снимаем pending-флаг (сообщение пойдёт как обычное).
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

  /** Повторная попытка для failed-сообщений. */
  const retryMessage = useCallback(
    async (messageId: string, sender: { id: string; displayName: string; avatar: string | null }): Promise<boolean> => {
      const target = messages.find((m) => m.id === messageId);
      if (!target || !channelId) return false;
      // Убираем старое и шлём заново
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return sendMessage(target.content, sender);
    },
    [messages, channelId, sendMessage],
  );

  return { messages, error, loading, sendMessage, retryMessage };
}
