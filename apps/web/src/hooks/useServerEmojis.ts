import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { listServerEmojis } from "../lib/emojis";
import { SocketEvents } from "../lib/socket";

/**
 * v1.2.22 — Custom emoji map для active server. RichContent / picker /
 * autocomplete используют этот hook, чтобы преобразовать `:shortcode:`
 * в `<img src=url>`. Refresh на серверный switch + manual refresh из
 * AdminEmojisTab после upload/delete (через returned refresh callback).
 *
 * v1.2.25 — real-time invalidation через socket (`emoji:created`,
 * `emoji:deleted`); window event оставлен fallback'ом если socket
 * disconnected.
 */
export function useServerEmojis(serverId: string | null, socket?: Socket | null) {
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

  // Cross-component fallback (если socket не подключён): AdminEmojisTab
  // dispatch'ит window event после upload/delete. v1.2.25 — основной
  // канал теперь socket; window event оставлен для optimistic UX в
  // самом AdminEmojisTab (без round-trip через socket-server-socket).
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

  // v1.2.25 — Socket-based real-time invalidation. Other admins на том
  // же сервере → их upload/delete invalidates Pavel'я cached map
  // мгновенно. Payload содержит конкретный emoji — можно optimize'ить
  // patch вместо refetch, но MVP делает refresh (4-6 KB JSON, дешево).
  useEffect(() => {
    if (!serverId || !socket) return;
    const matchesServer = (p: unknown): boolean => {
      return (
        typeof p === "object" &&
        p !== null &&
        "serverId" in p &&
        (p as { serverId: string }).serverId === serverId
      );
    };
    const onCreated = (payload: unknown) => {
      if (matchesServer(payload)) void refresh();
    };
    const onDeleted = (payload: unknown) => {
      if (matchesServer(payload)) void refresh();
    };
    socket.on(SocketEvents.EmojiCreated, onCreated);
    socket.on(SocketEvents.EmojiDeleted, onDeleted);
    return () => {
      socket.off(SocketEvents.EmojiCreated, onCreated);
      socket.off(SocketEvents.EmojiDeleted, onDeleted);
    };
  }, [serverId, socket, refresh]);

  return { emojis, refresh };
}

/** Dispatcher: вызывается из AdminEmojisTab после upload/delete. */
export function notifyEmojisChanged(serverId: string) {
  window.dispatchEvent(
    new CustomEvent("eclipse:emojis-changed", { detail: { serverId } }),
  );
}

