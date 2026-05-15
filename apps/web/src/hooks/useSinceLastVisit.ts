import { useCallback, useEffect, useState } from "react";
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

export type SinceLastVisitAiSummary = {
  summary: string;
  provider: string;
  model: string;
  latencyMs: number;
  generatedAt: string;
};

export function useSinceLastVisit(channelId: string | null) {
  const [data, setData] = useState<SinceLastVisitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<SinceLastVisitAiSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!channelId) {
      setData(null);
      setAiSummary(null);
      setAiError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAiSummary(null);
    setAiError(null);
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

  /** AI-prose summary поверх structured delta — отдельный явный вызов. */
  const requestAiSummary = useCallback(async () => {
    if (!channelId || !data?.priorVisitAt) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiJson<SinceLastVisitAiSummary>(
        `/api/channels/${encodeURIComponent(channelId)}/since-summary`,
        {
          method: "POST",
          body: JSON.stringify({ since: data.priorVisitAt }),
        },
      );
      setAiSummary(res);
    } catch (e) {
      setAiError(e instanceof ApiError ? e.message : "Не удалось получить AI-резюме");
    } finally {
      setAiLoading(false);
    }
  }, [channelId, data?.priorVisitAt]);

  /** Dismiss banner локально — не влияет на серверный visit (тот уже записан). */
  const dismiss = () => {
    setData(null);
    setAiSummary(null);
    setAiError(null);
  };

  return {
    data,
    loading,
    error,
    dismiss,
    aiSummary,
    aiLoading,
    aiError,
    requestAiSummary,
  };
}
