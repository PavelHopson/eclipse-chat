import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, apiJson } from "../lib/api";
import { SocketEvents, type ThreadReplyNewPayload } from "../lib/socket";
import type { AttachmentUpload, MessageRow } from "./useMessages";

/**
 * Thread data — root-сообщение + список replies.
 * Loading и error выставляются через `loading` и `error` обратно из хука.
 */
export type ThreadData = {
  root: MessageRow;
  replies: MessageRow[];
  channelId: string;
};

type Sender = { id: string; displayName: string; avatar: string | null };

/**
 * useThread — управление thread-state для выбранного root-сообщения.
 *
 * При смене rootId:
 *   - Загружает root + replies через GET /api/messages/:id/thread
 *   - Subscribe socket на `thread:${rootId}` через emit thread:join
 *   - Слушает `thread:reply:new` события и добавляет в replies
 *
 * При unmount или смене rootId → emit thread:leave (cleanup).
 */
export function useThread(
  rootId: string | null,
  socket: Socket | null,
) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Initial load
  useEffect(() => {
    if (!rootId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiJson<{
      root: MessageRow;
      replies: MessageRow[];
      channelId: string;
    }>(`/api/messages/${encodeURIComponent(rootId)}/thread?take=100`)
      .then((res) => {
        if (cancelled) return;
        setData({
          root: { ...res.root, reactions: res.root.reactions ?? [], attachments: res.root.attachments ?? [], actionItems: [] },
          replies: res.replies.map((r) => ({
            ...r,
            reactions: r.reactions ?? [],
            attachments: r.attachments ?? [],
            actionItems: [],
          })),
          channelId: res.channelId,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить thread");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rootId]);

  // Socket join + listen for new replies
  useEffect(() => {
    if (!socket || !rootId) return;
    socket.emit(SocketEvents.ThreadJoin, rootId);

    const onReply = (p: ThreadReplyNewPayload) => {
      if (p.rootId !== rootId) return;
      setData((prev) => {
        if (!prev) return prev;
        // Дедуп по id если уже добавили (на случай если своё сообщение
        // вернулось через socket после optimistic add)
        if (prev.replies.some((r) => r.id === p.messageId)) return prev;
        // Заменяем optimistic pending (match по userId + content)
        const pendingIdx = prev.replies.findIndex(
          (r) => r.pending && r.user.id === p.userId && r.content === p.content,
        );
        const newReply: MessageRow = {
          id: p.messageId,
          content: p.content,
          createdAt: p.createdAt,
          editedAt: null,
          deletedAt: null,
          pinnedAt: null,
          user: {
            id: p.userId,
            displayName: p.displayName,
            avatar: p.avatar,
            isBot: p.isBot ?? false,
            botRole: p.botRole ?? null,
          },
          reactions: [],
          attachments: p.attachments ?? [],
          actionItems: [],
        };
        if (pendingIdx >= 0) {
          const next = prev.replies.slice();
          next[pendingIdx] = newReply;
          return { ...prev, replies: next };
        }
        return { ...prev, replies: [...prev.replies, newReply] };
      });
    };

    socket.on(SocketEvents.ThreadReplyNew, onReply);
    return () => {
      socket.emit(SocketEvents.ThreadLeave, rootId);
      socket.off(SocketEvents.ThreadReplyNew, onReply);
    };
  }, [socket, rootId]);

  const sendReply = useCallback(
    async (
      content: string,
      sender: Sender,
      attachments: AttachmentUpload[] = [],
    ): Promise<boolean> => {
      if (!rootId) return false;
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return false;
      setSending(true);
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
        reactions: [],
        attachments: attachments.map((a, i) => ({
          id: `local-att-${i}`,
          filename: a.filename,
          mimeType: a.mimeType,
          size: Math.ceil((a.dataBase64.length * 3) / 4),
          url: `data:${a.mimeType};base64,${a.dataBase64}`,
          thumbnailUrl: null,
          width: null,
          height: null,
          position: i,
        })),
        actionItems: [],
        pending: true,
      };
      setData((prev) =>
        prev ? { ...prev, replies: [...prev.replies, optimistic] } : prev,
      );

      try {
        await apiJson(`/api/messages/${encodeURIComponent(rootId)}/thread`, {
          method: "POST",
          body: JSON.stringify({
            content: trimmed,
            attachments: attachments.length > 0 ? attachments : undefined,
          }),
        });
        // Реальное сообщение придёт через socket — заменит optimistic
        return true;
      } catch (e) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            replies: prev.replies.map((r) =>
              r.id === localId ? { ...r, pending: false, failed: true } : r,
            ),
          };
        });
        setError(e instanceof ApiError ? e.message : "Не удалось отправить reply");
        return false;
      } finally {
        setSending(false);
      }
    },
    [rootId],
  );

  return {
    data,
    loading,
    error,
    sending,
    sendReply,
  };
}
