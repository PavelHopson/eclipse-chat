import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, apiJson } from "../lib/api";
import { SocketEvents, type MessageNewPayload } from "../lib/socket";

export type MessageRow = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; displayName: string; avatar: string | null };
};

/**
 * Сообщения выбранного канала.
 *
 *  - При смене channelId: подписка `channel:join`, загрузка истории.
 *  - При unmount / next channel: `channel:leave`.
 *  - На `message:new`: добавляет в state (только для текущего канала).
 *  - sendMessage: POST + дедупликация против socket эмита (по messageId).
 */
export function useMessages(channelId: string | null, socket: Socket | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const channelIdRef = useRef<string | null>(channelId);
  channelIdRef.current = channelId;

  // load + socket join/leave
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

  // socket: новые сообщения
  useEffect(() => {
    if (!socket) {
      return;
    }
    const handler = (p: MessageNewPayload) => {
      if (p.channelId !== channelIdRef.current) {
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === p.messageId)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: p.messageId,
            content: p.content,
            createdAt: p.createdAt,
            user: { id: p.userId, displayName: p.displayName, avatar: p.avatar },
          },
        ];
      });
    };
    socket.on(SocketEvents.MessageNew, handler);
    return () => {
      socket.off(SocketEvents.MessageNew, handler);
    };
  }, [socket]);

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!channelId) {
        return false;
      }
      const trimmed = content.trim();
      if (!trimmed) {
        return false;
      }
      setError(null);
      try {
        await apiJson(`/api/channels/${encodeURIComponent(channelId)}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: trimmed }),
        });
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось отправить");
        return false;
      }
    },
    [channelId],
  );

  return { messages, error, loading, sendMessage };
}
