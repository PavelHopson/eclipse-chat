import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import { SocketEvents, type ThreadReplyNewPayload } from "../lib/socket";
import type { AttachmentUpload, MessageRow } from "./useMessages";

export type ThreadData = { root: MessageRow; replies: MessageRow[]; channelId: string };
type Sender = { id: string; displayName: string; avatar: string | null };

function normalize(message: MessageRow): MessageRow {
  return { ...message, editedAt: message.editedAt ?? null, deletedAt: message.deletedAt ?? null,
    pinnedAt: message.pinnedAt ?? null, reactions: message.reactions ?? [],
    attachments: message.attachments ?? [], actionItems: message.actionItems ?? [] };
}

// Both HTTP acknowledgement and socket event resolve the same optimistic row.
export function mergeThreadReply(data: ThreadData | null, payload: ThreadReplyNewPayload, localId?: string): ThreadData | null {
  if (!data || data.root.id !== payload.rootId) return data;
  const row = normalize({ id: payload.messageId, content: payload.content, createdAt: payload.createdAt,
    user: { id: payload.userId, displayName: payload.displayName, avatar: payload.avatar,
      isBot: payload.isBot ?? false, botRole: payload.botRole ?? null },
    attachments: payload.attachments ?? [] } as MessageRow);
  const pending = localId ?? data.replies.find(item => item.pending && item.user.id === payload.userId && item.content === payload.content)?.id;
  const rows = data.replies.filter(item => item.id !== pending);
  return { ...data, replies: rows.some(item => item.id === row.id) ? rows : [...rows, row] };
}

export function useThread(rootId: string | null, socket: Socket | null) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const rootRef = useRef(rootId);
  rootRef.current = rootId;
  const sendingRef = useRef(false);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!rootId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiJson<ThreadData>("/api/messages/" + encodeURIComponent(rootId) + "/thread?take=100")
      .then(response => {
        if (!cancelled) setData({ root: normalize(response.root), replies: response.replies.map(normalize), channelId: response.channelId });
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть обсуждение. Проверьте подключение или доступ к каналу.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rootId, revision]);

  useEffect(() => {
    if (!socket || !rootId) return;
    const join = () => socket.emit(SocketEvents.ThreadJoin, rootId);
    const reconnect = () => { join(); reload(); };
    join();
    const onReply = (payload: ThreadReplyNewPayload) => {
      if (payload.rootId === rootId) setData(previous => mergeThreadReply(previous, payload));
    };
    socket.on("connect", reconnect);
    socket.on(SocketEvents.ThreadReplyNew, onReply);
    return () => {
      socket.emit(SocketEvents.ThreadLeave, rootId);
      socket.off("connect", reconnect);
      socket.off(SocketEvents.ThreadReplyNew, onReply);
    };
  }, [socket, rootId, reload]);

  const sendReply = useCallback(async (content: string, sender: Sender, attachments: AttachmentUpload[] = []): Promise<boolean> => {
    if (!rootId || sendingRef.current || (!content.trim() && attachments.length === 0)) return false;
    sendingRef.current = true;
    const localId = "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const optimistic = normalize({ id: localId, content: content.trim(), user: sender, createdAt: new Date().toISOString(), pending: true } as MessageRow);
    setData(previous => previous?.root.id === rootId ? { ...previous, replies: [...previous.replies, optimistic] } : previous);
    try {
      const response = await apiJson<{ reply: ThreadReplyNewPayload }>("/api/messages/" + encodeURIComponent(rootId) + "/thread", {
        method: "POST", body: JSON.stringify({ content: content.trim(), attachments: attachments.length ? attachments : undefined }),
      });
      if (rootRef.current === rootId) setData(previous => mergeThreadReply(previous, response.reply, localId));
      return true;
    } catch {
      // Composer retains text and files for an explicit retry; no duplicate failed bubbles.
      if (rootRef.current === rootId) setData(previous => previous ? { ...previous, replies: previous.replies.filter(row => row.id !== localId) } : previous);
      return false;
    } finally { sendingRef.current = false; }
  }, [rootId]);

  return { data: data?.root.id === rootId ? data : null, loading, error, reload, sendReply };
}
