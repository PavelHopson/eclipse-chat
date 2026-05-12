import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import {
  SocketEvents,
  type DmConversationBumpedPayload,
} from "../lib/socket";

/**
 * Список моих DM conversations. Sort по lastMessageAt desc.
 *
 * Initial load — GET /api/dm/conversations. После — incremental updates
 * через `dm:conversation:bumped` event (на every new message в любой моей DM).
 *
 * Open-or-create: `openDmWith(userId)` upserts conversation на backend и
 * возвращает её id. Используется кнопкой «Написать в личку» в MemberList.
 */

export type DmOther = {
  id: string;
  displayName: string;
  avatar: string | null;
  manualStatus?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
};

export type DmLastMessage = {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  mine: boolean;
};

export type DmConversation = {
  id: string;
  other: DmOther;
  createdAt: string;
  lastMessageAt: string;
  lastMessage: DmLastMessage | null;
  /** Локальный unread count — incrementится при dm:conversation:bumped от не-меня
   *  для не-активной conversation. Сбрасывается при select. */
  unread: number;
};

type ApiConversation = Omit<DmConversation, "unread">;

type ApiResponse = { conversations: ApiConversation[] };

export function useDirectConversations(socket: Socket | null, currentUserId: string) {
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ApiResponse>("/api/dm/conversations");
      setConversations(data.conversations.map((c) => ({ ...c, unread: 0 })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load DMs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Subscribe to bumped events — обновляем preview + sort + unread.
  useEffect(() => {
    if (!socket) return;
    const onBumped = (p: DmConversationBumpedPayload) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === p.conversationId);
        if (idx === -1) {
          // Новый conversation — reload вычитает всё из БД (proper).
          // Можно делать optimistic insert если хочется быстрее.
          void reload();
          return prev;
        }
        const old = prev[idx];
        const updated: DmConversation = {
          ...old,
          lastMessageAt: p.lastMessageAt,
          lastMessage: {
            id: old.lastMessage?.id ?? "",
            content: p.lastMessagePreview,
            createdAt: p.lastMessageAt,
            userId: p.lastSenderUserId,
            mine: p.lastSenderUserId === currentUserId,
          },
          // Unread bump только если sender не я И эта conversation не открыта сейчас
          unread:
            p.lastSenderUserId !== currentUserId && old.id !== selectedDmId
              ? old.unread + 1
              : old.unread,
        };
        // Resort by lastMessageAt — поднимаем bumped в начало
        const rest = prev.filter((c) => c.id !== p.conversationId);
        return [updated, ...rest];
      });
    };
    socket.on(SocketEvents.DmConversationBumped, onBumped);
    return () => {
      socket.off(SocketEvents.DmConversationBumped, onBumped);
    };
  }, [socket, currentUserId, selectedDmId, reload]);

  /** Сброс unread при выборе. */
  const selectDm = useCallback((id: string | null) => {
    setSelectedDmId(id);
    if (id) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
      );
    }
  }, []);

  /**
   * Get-or-create conversation с given user. Возвращает её id (или null на error).
   * Используется кнопкой «Написать в личку» в MemberList.
   */
  const openDmWith = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      try {
        const data = await apiJson<{ conversation: ApiConversation }>(
          `/api/dm/conversations/${encodeURIComponent(otherUserId)}`,
          { method: "POST" },
        );
        const convo = data.conversation;
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === convo.id);
          if (existing) return prev;
          return [{ ...convo, lastMessage: null, unread: 0 }, ...prev];
        });
        setSelectedDmId(convo.id);
        return convo.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to open DM");
        return null;
      }
    },
    [],
  );

  return {
    conversations,
    loading,
    error,
    selectedDmId,
    selectDm,
    openDmWith,
    reload,
  };
}
