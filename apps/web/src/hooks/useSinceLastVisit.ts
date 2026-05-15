import { useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";
import type { ActionItemPayload } from "../lib/socket";

/**
 * useSinceLastVisit — AI Memory «Пока тебя не было».
 *
 * При смене channelId POST'ит /api/channels/:id/visit (атомарно фиксирует
 * visit + возвращает дельту с prior). Возвращает данные сводки — banner-
 * компонент сам решает показывать ли (порог времени отсутствия).
 */

export type SinceLastVisitData = {
  visitedAt: string;
  priorVisitAt: string | null;
  since: {
    newMessages: number;
    newAuthors: number;
    newTasks: number;
    newDecisions: number;
    newFollowUps: number;
    recentActions: ActionItemPayload[];
    recentPinned: Array<{
      id: string;
      content: string;
      pinnedAt: string;
      user: { id: string; displayName: string; avatar: string | null };
    }>;
    incident: {
      id: string;
      title: string;
      status: "OPEN" | "RESOLVED";
      openedAt: string;
    } | null;
  } | null;
};

export function useSinceLastVisit(channelId: string | null) {
  const [data, setData] = useState<SinceLastVisitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!channelId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiJson<SinceLastVisitData>(
      `/api/channels/${encodeURIComponent(channelId)}/visit`,
      { method: "POST" },
    )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Не удалось записать visit");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  /** Dismiss banner локально — не влияет на серверный visit (тот уже записан). */
  const dismiss = () => setData(null);

  return { data, loading, error, dismiss };
}
