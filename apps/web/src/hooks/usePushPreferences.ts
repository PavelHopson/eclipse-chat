import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";

/**
 * v0.85 #27 phase 4 — push notifications preferences.
 *
 *   - Per-event-type toggles (mentions / dms / assignments / approvals / escalations)
 *   - Per-channel mute (channelId set)
 *
 * Default — все toggles enabled (consistent с backend, отсутствие row = full opt-in).
 *
 * Storage: backend NotificationPreferences (1-to-1 с User) + MutedChannel
 * (composite PK userId+channelId). UI обновляет один toggle за раз через PUT
 * с partial body.
 */

export type PushPreferences = {
  mentions: boolean;
  dms: boolean;
  assignments: boolean;
  approvals: boolean;
  escalations: boolean;
};

const DEFAULT_PREFS: PushPreferences = {
  mentions: true,
  dms: true,
  assignments: true,
  approvals: true,
  escalations: true,
};

export function usePushPreferences(enabled: boolean) {
  const [prefs, setPrefs] = useState<PushPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<PushPreferences>("/api/push/preferences");
      setPrefs(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggle = useCallback(async (key: keyof PushPreferences, value: boolean) => {
    // Optimistic update — мгновенный UI.
    setPrefs((prev) => ({ ...prev, [key]: value }));
    try {
      const updated = await apiJson<PushPreferences>("/api/push/preferences", {
        method: "PUT",
        body: JSON.stringify({ [key]: value }),
      });
      setPrefs(updated);
    } catch (e) {
      // Rollback при ошибке.
      setPrefs((prev) => ({ ...prev, [key]: !value }));
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    }
  }, []);

  return { prefs, loading, error, toggle, reload };
}

/**
 * v0.85 #27 phase 4 — muted channels.
 *
 * Per-channel mute toggle. UI — bell-icon button рядом с каналом в
 * ChannelList. Mute survives reload — backend MutedChannel row.
 */
export function useMutedChannels() {
  const [mutedSet, setMutedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ muted: Array<{ channelId: string }> }>(
        "/api/push/muted-channels",
      );
      setMutedSet(new Set(data.muted.map((m) => m.channelId)));
    } catch {
      // Silent fail — feature optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mute = useCallback(async (channelId: string) => {
    // Optimistic.
    setMutedSet((prev) => {
      const next = new Set(prev);
      next.add(channelId);
      return next;
    });
    try {
      await apiJson(`/api/channels/${encodeURIComponent(channelId)}/mute`, {
        method: "POST",
      });
    } catch {
      setMutedSet((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    }
  }, []);

  const unmute = useCallback(async (channelId: string) => {
    setMutedSet((prev) => {
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
    try {
      await apiJson(`/api/channels/${encodeURIComponent(channelId)}/mute`, {
        method: "DELETE",
      });
    } catch {
      setMutedSet((prev) => {
        const next = new Set(prev);
        next.add(channelId);
        return next;
      });
    }
  }, []);

  const isMuted = useCallback(
    (channelId: string) => mutedSet.has(channelId),
    [mutedSet],
  );

  return { mutedSet, isMuted, mute, unmute, loading, reload };
}
