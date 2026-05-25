import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import { SocketEvents } from "../lib/socket";

/**
 * Shared listening room (v0.61) — synchronous audio playback на канале.
 *
 * Sync механизм: server держит `startedAt` (timestamp последнего play/resume)
 * + `positionMs` (offset на момент pause). Frontend рассчитывает текущую
 * позицию как:
 *   position = isPlaying && startedAt
 *     ? (Date.now() - startedAt.getTime() + positionMs)
 *     : positionMs
 *
 * Hook возвращает `derivedPositionMs` который тикает каждую секунду.
 * При change session — re-fetch (socket event payload приходит с полным
 * новым state'ом).
 */

export type MusicTrack = {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  thumbnailUrl: string | null;
  size: number;
  /** v0.74 #32 phase 3: pre-computed waveform peaks (32..256 чисел 0..100)
   *  для отображения full-width дорожки в expand modal. null для legacy. */
  waveformPeaks?: number[] | null;
};

export type MusicSession = {
  id: string;
  channelId: string;
  currentTrack: MusicTrack | null;
  startedAt: string | null;
  positionMs: number;
  isPlaying: boolean;
  queue: string[];
  host: { id: string; displayName: string; avatar: string | null };
  updatedAt: string;
};

export function useChannelMusic(channelId: string | null, socket: Socket | null) {
  const [session, setSession] = useState<MusicSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!channelId) {
      setSession(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ session: MusicSession | null }>(
        `/api/channels/${encodeURIComponent(channelId)}/music`,
      );
      setSession(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить плеер");
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Subscribe: server emit'ит full session payload (или null = stop) при
  // любых изменениях. Match по channelId через event-room subscription
  // (frontend уже подписан на channel:${channelId}).
  useEffect(() => {
    if (!socket) return;
    const onUpdated = (payload: MusicSession | null) => {
      // Если payload относится к другому каналу — игнорим (socket emit'ит
      // в channel-room, поэтому payload по идее тот же channel; double-check).
      if (payload && channelId && payload.channelId !== channelId) return;
      setSession(payload);
    };
    socket.on(SocketEvents.MusicSessionUpdated, onUpdated);
    return () => {
      socket.off(SocketEvents.MusicSessionUpdated, onUpdated);
    };
  }, [socket, channelId]);

  // Derived position — clock-tick каждые 500ms, чтобы UI прогресс-бар
  // двигался плавно.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!session?.isPlaying) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [session?.isPlaying, session?.startedAt]);

  const derivedPositionMs = (() => {
    if (!session) return 0;
    if (session.isPlaying && session.startedAt) {
      return (
        Date.now() - new Date(session.startedAt).getTime() + session.positionMs
      );
    }
    return session.positionMs;
  })();
  // Use tick to mark as read (avoid lint unused). Side-effect: re-render
  // фронт при каждом интервале.
  void tick;

  const start = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      if (!channelId) return false;
      try {
        const data = await apiJson<{ session: MusicSession }>(
          `/api/channels/${encodeURIComponent(channelId)}/music/start`,
          {
            method: "POST",
            body: JSON.stringify({ attachmentId }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setSession(data.session);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось запустить трек");
        return false;
      }
    },
    [channelId],
  );

  const togglePlayPause = useCallback(async (): Promise<boolean> => {
    if (!channelId || !session) return false;
    const path = session.isPlaying ? "pause" : "resume";
    try {
      const data = await apiJson<{ session: MusicSession }>(
        `/api/channels/${encodeURIComponent(channelId)}/music/${path}`,
        { method: "POST" },
      );
      setSession(data.session);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переключить");
      return false;
    }
  }, [channelId, session]);

  const skip = useCallback(async (): Promise<boolean> => {
    if (!channelId) return false;
    try {
      const data = await apiJson<{ session: MusicSession | null }>(
        `/api/channels/${encodeURIComponent(channelId)}/music/skip`,
        { method: "POST" },
      );
      setSession(data.session);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переключить трек");
      return false;
    }
  }, [channelId]);

  /** v1.1.84 — перемотка. Сервер двигает positionMs и ре-броадкастит
   *  сессию → все слушатели ре-синхронятся (как при skip). host / MOD+. */
  const seek = useCallback(
    async (positionMs: number): Promise<boolean> => {
      if (!channelId) return false;
      try {
        const data = await apiJson<{ session: MusicSession }>(
          `/api/channels/${encodeURIComponent(channelId)}/music/seek`,
          {
            method: "POST",
            body: JSON.stringify({ positionMs: Math.max(0, Math.round(positionMs)) }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setSession(data.session);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось перемотать");
        return false;
      }
    },
    [channelId],
  );

  const stop = useCallback(async (): Promise<boolean> => {
    if (!channelId) return false;
    try {
      await apiJson(
        `/api/channels/${encodeURIComponent(channelId)}/music/stop`,
        { method: "POST" },
      );
      setSession(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось остановить");
      return false;
    }
  }, [channelId]);

  const addToQueue = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      if (!channelId) return false;
      try {
        const data = await apiJson<{ session: MusicSession }>(
          `/api/channels/${encodeURIComponent(channelId)}/music/queue`,
          {
            method: "POST",
            body: JSON.stringify({ attachmentId }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setSession(data.session);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось добавить в очередь");
        return false;
      }
    },
    [channelId],
  );

  /** v1.5.14 — bulk playlist start. Первый attachmentId сразу играет
   *  (becomes current track), остальные REPLACE'ят queue. Caller —
   *  host. Используется в music room для «играть все» из server audio
   *  library. */
  const startPlaylist = useCallback(
    async (attachmentIds: string[]): Promise<boolean> => {
      if (!channelId || attachmentIds.length === 0) return false;
      try {
        const data = await apiJson<{ session: MusicSession }>(
          `/api/channels/${encodeURIComponent(channelId)}/music/playlist`,
          {
            method: "POST",
            body: JSON.stringify({ attachmentIds }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setSession(data.session);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось запустить плейлист");
        return false;
      }
    },
    [channelId],
  );

  return {
    session,
    loading,
    error,
    derivedPositionMs,
    reload,
    start,
    togglePlayPause,
    skip,
    seek,
    stop,
    addToQueue,
    startPlaylist,
  };
}
