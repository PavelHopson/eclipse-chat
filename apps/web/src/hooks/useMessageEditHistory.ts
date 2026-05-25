import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../lib/api";

/**
 * v1.5.24 — Message edit history (channel + DM, v1.5.25).
 *
 * Lazy fetch on enabled=true. Возвращает previous content snapshots
 * (newest first). Cache в state — на повторный enable не делает refetch
 * (если messageId не менялся). Для refresh — call reload().
 *
 * v1.5.25 — `isDm` переключает endpoint на /api/dm/messages/:id/edits
 * (participant-only check вместо channel member check). Поведение и форма
 * ответа идентичны — frontend различает только URL.
 */

export type MessageEdit = {
  id: string;
  previousContent: string;
  editedAt: string;
};

export function useMessageEditHistory(
  messageId: string | null,
  enabled: boolean,
  isDm: boolean = false,
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
      const base = isDm ? "/api/dm/messages/" : "/api/messages/";
      const data = await apiJson<{ edits: MessageEdit[] }>(
        `${base}${encodeURIComponent(messageId)}/edits`,
      );
      setEdits(data.edits);
      setLoadedFor(messageId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить историю");
    } finally {
      setLoading(false);
    }
  }, [messageId, isDm]);

  useEffect(() => {
    // Fetch только когда явно включаем accordion + не fetch'ил уже этот id.
    if (!enabled || !messageId) return;
    if (loadedFor === messageId) return;
    void reload();
  }, [enabled, messageId, loadedFor, reload]);

  return { edits, loading, error, reload };
}
