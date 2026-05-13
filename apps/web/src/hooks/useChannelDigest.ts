import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import { SocketEvents, type ActionItemPayload } from "../lib/socket";

/**
 * Channel digest — fetched-on-demand summary канала.
 *
 * Не используется socket: digest stable enough что 1-click refresh
 * (или auto-refresh при смене канала) хватает. Auto-stale при изменении
 * action items в этом канале — пробрасывается через `bumpVersion()` извне.
 */

export type DigestPinnedMessage = {
  id: string;
  content: string;
  createdAt: string;
  pinnedAt: string | null;
  user: { id: string; displayName: string; avatar: string | null };
};

export type ChannelDigest = {
  channel: { id: string; name: string; type: "TEXT" | "VOICE" };
  generatedAt: string;
  windowDays: number;
  openActions: {
    total: number;
    byType: { TASK: number; DECISION: number; FOLLOW_UP: number };
    overdue: ActionItemPayload[];
    dueToday: ActionItemPayload[];
    dueTomorrow: ActionItemPayload[];
    unassigned: ActionItemPayload[];
  };
  decisions: ActionItemPayload[];
  followUps: ActionItemPayload[];
  pinned: DigestPinnedMessage[];
  stats: { messages: number; uniqueAuthors: number };
};

export function useChannelDigest(channelId: string | null, socket?: Socket | null) {
  const [digest, setDigest] = useState<ChannelDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef<number>(0);

  const fetchDigest = useCallback(async () => {
    if (!channelId) {
      setDigest(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ChannelDigest>(
        `/api/channels/${encodeURIComponent(channelId)}/digest`,
      );
      setDigest(data);
      lastFetchedAt.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load digest");
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  // Auto-fetch при смене channelId
  useEffect(() => {
    if (channelId) {
      void fetchDigest();
    } else {
      setDigest(null);
    }
  }, [channelId, fetchDigest]);

  // Auto-stale: digest обновляется при изменении action items этого канала
  // и при pin/unpin сообщений. Throttle через debounce 1.5s чтобы не
  // re-fetch'ить на каждое action update в активной сессии.
  useEffect(() => {
    if (!socket || !channelId) return;
    let timer: number | null = null;
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void fetchDigest();
      }, 1500);
    };
    const checkAndSchedule = (p: { channelId?: string }) => {
      if (p?.channelId === channelId) schedule();
    };
    socket.on(SocketEvents.ActionItemCreated, checkAndSchedule);
    socket.on(SocketEvents.ActionItemUpdated, checkAndSchedule);
    socket.on(SocketEvents.MessagePinned, checkAndSchedule);
    socket.on(SocketEvents.MessageUnpinned, checkAndSchedule);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      socket.off(SocketEvents.ActionItemCreated, checkAndSchedule);
      socket.off(SocketEvents.ActionItemUpdated, checkAndSchedule);
      socket.off(SocketEvents.MessagePinned, checkAndSchedule);
      socket.off(SocketEvents.MessageUnpinned, checkAndSchedule);
    };
  }, [socket, channelId, fetchDigest]);

  return {
    digest,
    loading,
    error,
    refresh: fetchDigest,
    lastFetchedAt: lastFetchedAt.current,
  };
}
