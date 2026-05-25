import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";

/**
 * v0.57: operational search — unified поиск по сообщениям, action items и
 * файлам активного пространства. Backend (/api/servers/:id/operational-search)
 * возвращает три массива в одном response, frontend рендерит их в трёх
 * tabs SearchOverlay.
 *
 * Min query length 2. Debounce 200ms. Каждая категория ограничена 25 hits.
 * V1 — Postgres ILIKE без FTS index; tsvector + GIN — future upgrade
 * (одна миграция, без breaking changes для frontend).
 */

export type SearchMessageHit = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; displayName: string; avatar: string | null };
  channel: { id: string; name: string; slug: string };
};

export type SearchActionHit = {
  id: string;
  title: string;
  description: string | null;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  status: import("../lib/socket").ActionItemStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt: string | null;
  channel: { id: string; name: string; slug: string };
  assignee: { id: string; displayName: string; avatar: string | null } | null;
};

export type SearchFileHit = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string | null;
  messageId: string;
  createdAt: string;
  channel: { id: string; name: string; slug: string };
};

export type SearchResults = {
  messages: SearchMessageHit[];
  actions: SearchActionHit[];
  files: SearchFileHit[];
};

type Response = {
  query: string;
  messages: SearchMessageHit[];
  actions: SearchActionHit[];
  files: SearchFileHit[];
};

const EMPTY: SearchResults = { messages: [], actions: [], files: [] };

/**
 * v1.5.23 — search filters. Все optional, тихо ignored backend'ом
 * если пустые. ISO datetime для since/until, channelId — string id.
 */
export type SearchFilters = {
  since: string | null;
  until: string | null;
  channelId: string | null;
};

const EMPTY_FILTERS: SearchFilters = {
  since: null,
  until: null,
  channelId: null,
};

export function useSearch(serverId: string | null) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serverId || query.trim().length < 2) {
      setResults(EMPTY);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim() });
      if (filters.since) params.set("since", filters.since);
      if (filters.until) params.set("until", filters.until);
      if (filters.channelId) params.set("channelId", filters.channelId);
      apiJson<Response>(
        `/api/servers/${encodeURIComponent(serverId)}/operational-search?${params.toString()}`,
      )
        .then((data) => {
          if (!cancelled) {
            setResults({
              messages: data.messages,
              actions: data.actions,
              files: data.files,
            });
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setError(e instanceof ApiError ? e.message : "Поиск временно недоступен");
            setResults(EMPTY);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [serverId, query, filters.since, filters.until, filters.channelId]);

  const reset = useCallback(() => {
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setResults(EMPTY);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    results,
    loading,
    error,
    reset,
  };
}
