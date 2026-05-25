import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../lib/api";

/**
 * v1.5.24 — Message edit history.
 *
 * Lazy fetch on enabled=true. Возвращает previous content snapshots
 * (newest first). Cache в state — на повторный enable не делает refetch
 * (если messageId не менялся). Для refresh — call reload().
 */

export type MessageEdit = {
  id: string;
  previousContent: string;
  editedAt: string;
};

export function useMessageEditHistory(
  messageId: string | null,
  enabled: boolean,
) {
  const [edits, setEdits] = useState<MessageEdit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!messageId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ edits: MessageEdit[] }>(
        `/api/messages/${encodeURIComponent(messageId)}/edits`,
      );
      setEdits(data.edits);
      setLoadedFor(messageId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить историю");
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    // Fetch только когда явно включаем accordion + не fetch'ил уже этот id.
    if (!enabled || !messageId) return;
    if (loadedFor === messageId) return;
    void reload();
  }, [enabled, messageId, loadedFor, reload]);

  return { edits, loading, error, reload };
}
