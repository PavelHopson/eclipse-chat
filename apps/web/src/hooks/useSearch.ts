import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";

export type SearchHit = {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  user: { id: string; displayName: string; avatar: string | null };
  channel: { id: string; name: string; slug: string };
};

type Response = { query: string; results: SearchHit[] };

/**
 * Поиск по сообщениям в активном сервере. Простой debounced fetch
 * через GET /api/servers/:id/search?q=. Backend ограничивает 50 hits,
 * deleted skipped, только TEXT channels.
 *
 * Min query length 2 — иначе backend сразу возвращает [].
 */
export function useSearch(serverId: string | null) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serverId || query.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      apiJson<Response>(
        `/api/servers/${encodeURIComponent(serverId)}/search?q=${encodeURIComponent(query.trim())}`,
      )
        .then((data) => {
          if (!cancelled) {
            setResults(data.results);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setError(e instanceof ApiError ? e.message : "Поиск временно недоступен");
            setResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200); // debounce: 200 мс после последнего keystroke

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [serverId, query]);

  const reset = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
  }, []);

  return { query, setQuery, results, loading, error, reset };
}
