import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import { deriveGroupTitle } from "../components/GroupAvatar";
import {
  SocketEvents,
  type DmConversationBumpedPayload,
} from "../lib/socket";

/**
 * Список моих DM conversations (1-to-1 + group). Sort по lastMessageAt desc.
 *
 * Initial load — GET /api/dm/conversations. После — incremental updates
 * через `dm:conversation:bumped` event (на every new message в любой моей DM,
 * fan-out по всем participants).
 *
 * Open-or-create:
 *   - `openDmWith(userId)` — 1-to-1 upsert (POST /api/dm/conversations/:userId).
 *   - `createGroupDm(memberUserIds, name?)` — новый group (POST /api/dm/groups).
 *
 * Backend возвращает discriminated union — `isGroup: true` → group row с
 * `participants[]` и `name?`; `isGroup: false` → legacy row с `other`.
 */

export type DmOther = {
  id: string;
  displayName: string;
  avatar: string | null;
  manualStatus?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
};

export type DmParticipant = {
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

type DmConversationBase = {
  id: string;
  createdAt: string;
  lastMessageAt: string;
  lastMessage: DmLastMessage | null;
  /** Локальный unread count — incrementится при dm:conversation:bumped от не-меня
   *  для не-активной conversation. Сбрасывается при select. */
  unread: number;
};

export type DmConversationOneToOne = DmConversationBase & {
  isGroup: false;
  other: DmOther;
  /** «Избранное» — self-conversation. Пинится сверху списка, особый header. */
  saved?: boolean;
};

export type DmConversationGroup = DmConversationBase & {
  isGroup: true;
  name: string | null;
  createdByUserId: string | null;
  participants: DmParticipant[];
};

export type DmConversation = DmConversationOneToOne | DmConversationGroup;

/**
 * Унифицированный title для DM (1-to-1 или group). Для group — берёт user-set
 * name или auto-derive из participant displayName'ов (без меня). Используется
 * везде где нужно показать «название диалога»: chat header, sidebar row title,
 * mention name, composer placeholder.
 */
export function dmTitle(dm: DmConversation, currentUserId: string): string {
  if (dm.isGroup) {
    return dm.name?.trim() || deriveGroupTitle(dm.participants, currentUserId);
  }
  if (dm.saved) return "Избранное";
  return dm.other.displayName;
}

/** Type guard — Saved Messages (self-conversation). */
export function dmIsSaved(dm: DmConversation): dm is DmConversationOneToOne & { saved: true } {
  return !dm.isGroup && dm.saved === true;
}

type ApiOneToOne = Omit<DmConversationOneToOne, "unread">;
type ApiGroup = Omit<DmConversationGroup, "unread">;
type ApiConversation = ApiOneToOne | ApiGroup;

type ApiResponse = { conversations: ApiConversation[] };

function withUnread(c: ApiConversation, unread = 0): DmConversation {
  return { ...c, unread } as DmConversation;
}

export function useDirectConversations(socket: Socket | null, currentUserId: string) {
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Список обычных DM + «Избранное» (self-conversation) параллельно.
      const [data, savedData] = await Promise.all([
        apiJson<ApiResponse>("/api/dm/conversations"),
        apiJson<{ conversation: ApiOneToOne }>("/api/dm/saved", {
          method: "POST",
        }),
      ]);
      const saved: DmConversationOneToOne = {
        ...savedData.conversation,
        saved: true,
        unread: 0,
      };
      setConversations([saved, ...data.conversations.map((c) => withUnread(c))]);
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
          // Новый conversation (e.g. кто-то добавил меня в group) — reload.
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
   * Get-or-create 1-to-1 conversation с given user. Возвращает её id.
   * Используется кнопкой «Написать в личку» в MemberList.
   */
  const openDmWith = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      try {
        const data = await apiJson<{ conversation: ApiOneToOne }>(
          `/api/dm/conversations/${encodeURIComponent(otherUserId)}`,
          { method: "POST" },
        );
        const convo = data.conversation;
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === convo.id);
          if (existing) return prev;
          return [
            { ...convo, lastMessage: null, unread: 0 } as DmConversationOneToOne,
            ...prev,
          ];
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

  /**
   * Создать group DM. Возвращает id новой conversation (или null на error).
   * Backend требует ≥2 другие user-id'а; creator (me) добавляется автоматически.
   */
  const createGroupDm = useCallback(
    async (memberUserIds: string[], name?: string): Promise<string | null> => {
      try {
        const data = await apiJson<{ conversation: ApiGroup }>(
          "/api/dm/groups",
          {
            method: "POST",
            body: JSON.stringify({ memberUserIds, name }),
            headers: { "Content-Type": "application/json" },
          },
        );
        const convo = data.conversation;
        setConversations((prev) => [
          { ...convo, lastMessage: null, unread: 0 } as DmConversationGroup,
          ...prev,
        ]);
        setSelectedDmId(convo.id);
        return convo.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create group");
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
    createGroupDm,
    reload,
  };
}
