import { useCallback, useEffect, useState } from "react";
import { listServerEmojis } from "../lib/emojis";

/**
 * v1.2.22 — Custom emoji map для active server. RichContent / picker /
 * autocomplete используют этот hook, чтобы преобразовать `:shortcode:`
 * в `<img src=url>`. Refresh на серверный switch + manual refresh из
 * AdminEmojisTab после upload/delete (через returned refresh callback).
 *
 * Real-time invalidation через socket — следующим слайсом.
 */
export function useServerEmojis(serverId: string | null) {
  const [emojis, setEmojis] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!serverId) {
      setEmojis({});
      return;
    }
    try {
      const list = await listServerEmojis(serverId);
      const map: Record<string, string> = {};
      for (const e of list) map[e.shortcode] = e.url;
      setEmojis(map);
    } catch {
      // Forbid (не member) / network — silently empty. Не критично для UX:
      // custom emoji остаются как text (`:shortcode:`), Unicode emoji работают
      // через локальный whitelist в RichContent.
      setEmojis({});
    }
  }, [serverId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Cross-component invalidation: AdminEmojisTab dispatches event после
  // upload/delete, чтобы все потребители (RichContent в AppShell)
  // перечитали список без switch'а сервера. Real-time через socket —
  // следующим слайсом.
  useEffect(() => {
    if (!serverId) return;
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ serverId: string }>).detail;
      if (detail?.serverId === serverId) {
        void refresh();
      }
    };
    window.addEventListener("eclipse:emojis-changed", onChanged);
    return () => window.removeEventListener("eclipse:emojis-changed", onChanged);
  }, [serverId, refresh]);

  return { emojis, refresh };
}

/** Dispatcher: вызывается из AdminEmojisTab после upload/delete. */
export function notifyEmojisChanged(serverId: string) {
  window.dispatchEvent(
    new CustomEvent("eclipse:emojis-changed", { detail: { serverId } }),
  );
}

