import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "../lib/api";

/**
 * v0.77 #21 phase 1: semantic search hook.
 *
 * POST /api/servers/:id/search/semantic — server считает embedding query
 * и cosine similarity к message-embeddings всего сервера. Возвращает
 * top-N с score.
 *
 * Поведение:
 *   - debounce 400ms (медленнее чем ILIKE — query тяжелее)
 *   - min 3 символов
 *   - 503 → флаг notConfigured (UI скрывает фичу)
 *   - 502 → стандартный error
 *
 * Не запускается пока tab не активирован (lazy) — caller передаёт `enabled`.
 */

export type SemanticHit = {
  score: number;
  messageId: string;
  content: string;
  createdAt: string;
  channelId: string;
  channelName: string;
  userId: string | null;
  displayName: string | null;
  avatar: string | null;
};

export type SemanticState = {
  hits: SemanticHit[];
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
};

const DEBOUNCE_MS = 400;
const MIN_QUERY = 3;

export function useSemanticSearch(
  serverId: string | null,
  query: string,
  enabled: boolean,
): SemanticState {
  const [hits, setHits] = useState<SemanticHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const lastReqRef = useRef(0);

  const run = useCallback(
    async (q: string) => {
      if (!serverId || !enabled || q.trim().length < MIN_QUERY) {
        setHits([]);
        setError(null);
        setLoading(false);
        return;
      }
      const reqId = ++lastReqRef.current;
      setLoading(true);
      setError(null);
      try {
        const data = await apiJson<{
          query: string;
          model: string;
          total: number;
          results: SemanticHit[];
        }>(`/api/servers/${encodeURIComponent(serverId)}/search/semantic`, {
          method: "POST",
          body: JSON.stringify({ query: q, limit: 20 }),
          headers: { "Content-Type": "application/json" },
        });
        if (reqId !== lastReqRef.current) return; // outdated response
        setHits(data.results);
        setNotConfigured(false);
      } catch (err) {
        if (reqId !== lastReqRef.current) return;
        const msg = err instanceof Error ? err.message : "Поиск не удался";
        // apiJson включает status в текст ошибки если был; смотрим на "503".
        if (msg.includes("503") || msg.includes("Semantic search не")) {
          setNotConfigured(true);
          setError(null);
        } else {
          setError(msg);
          setNotConfigured(false);
        }
        setHits([]);
      } finally {
        if (reqId === lastReqRef.current) setLoading(false);
      }
    },
    [serverId, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => void run(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, enabled, run]);

  return { hits, loading, error, notConfigured };
}
