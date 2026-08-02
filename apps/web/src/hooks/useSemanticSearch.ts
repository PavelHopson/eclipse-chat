import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "../lib/api";

/**
 * v1.7.23: hybrid message + curated-memory retrieval hook.
 *
 * POST /api/servers/:id/search/semantic — server считает embedding query
 * и cosine similarity к message-embeddings всего сервера. Возвращает
 * top-N с score.
 *
 * Поведение:
 *   - debounce 400ms (медленнее чем ILIKE — query тяжелее)
 *   - min 3 символов
 *   - без embeddings backend возвращает lexical fallback вместо ошибки
 *   - старый 503 contract всё ещё распознаётся для rolling deploy compatibility
 *
 * Не запускается пока tab не активирован (lazy) — caller передаёт `enabled`.
 */

export type SemanticHit = {
  score: number;
  matchMode: "lexical" | "semantic" | "hybrid";
  messageId: string;
  content: string;
  createdAt: string;
  channelId: string;
  channelName: string;
  parentMessageId: string | null;
  userId: string | null;
  displayName: string | null;
  avatar: string | null;
};

export type SemanticMemoryHit = {
  score: number;
  matchMode: "lexical" | "semantic" | "hybrid";
  memoryId: string;
  kind: "NOTE" | "DECISION" | "RISK" | "FACT" | "LINK" | "ACTION";
  title: string;
  content: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  channelId: string | null;
  channelName: string | null;
  sourceMessageId: string | null;
  sourceParentMessageId: string | null;
  actionItemId: string | null;
};

export type SemanticState = {
  hits: SemanticHit[];
  memoryHits: SemanticMemoryHit[];
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  mode: "hybrid" | "lexical" | null;
  model: string | null;
};

const DEBOUNCE_MS = 400;
const MIN_QUERY = 3;

export function useSemanticSearch(
  serverId: string | null,
  query: string,
  enabled: boolean,
): SemanticState {
  const [hits, setHits] = useState<SemanticHit[]>([]);
  const [memoryHits, setMemoryHits] = useState<SemanticMemoryHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [mode, setMode] = useState<"hybrid" | "lexical" | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const lastReqRef = useRef(0);

  const run = useCallback(
    async (q: string) => {
      if (!serverId || !enabled || q.trim().length < MIN_QUERY) {
        setHits([]);
        setMemoryHits([]);
        setError(null);
        setLoading(false);
        setMode(null);
        setModel(null);
        return;
      }
      const reqId = ++lastReqRef.current;
      setLoading(true);
      setError(null);
      try {
        const data = await apiJson<{
          query: string;
          model: string | null;
          mode?: "hybrid" | "lexical";
          total: number;
          results: SemanticHit[];
          memoryResults?: SemanticMemoryHit[];
        }>(`/api/servers/${encodeURIComponent(serverId)}/search/semantic`, {
          method: "POST",
          body: JSON.stringify({ query: q, limit: 20 }),
          headers: { "Content-Type": "application/json" },
        });
        if (reqId !== lastReqRef.current) return; // outdated response
        setHits(data.results);
        setMemoryHits(data.memoryResults ?? []);
        setMode(data.mode ?? (data.model ? "hybrid" : "lexical"));
        setModel(data.model);
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
        setMemoryHits([]);
        setMode(null);
        setModel(null);
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

  return { hits, memoryHits, loading, error, notConfigured, mode, model };
}
