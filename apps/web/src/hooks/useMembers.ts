import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, apiJson } from "../lib/api";
import {
  SocketEvents,
  type MemberJoinedPayload,
  type MemberLeftPayload,
  type PresenceUpdatePayload,
} from "../lib/socket";

export type MemberRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";

export type MemberRow = {
  id: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  online: boolean;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatar: string | null;
    createdAt: string;
  };
};

type MembersResponse = { members: MemberRow[] };

/**
 * Список участников активного сервера + live presence.
 *
 * Изменения отслеживаются через сокеты: `member:joined` / `member:left`
 * + `presence:update` (online/offline). Initial load — REST GET /members
 * с встроенным online-флагом из in-memory presence-tracker (`apps/server/presence.ts`).
 */
export function useMembers(serverId: string | null, socket: Socket | null) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson<MembersResponse>(
        `/api/servers/${encodeURIComponent(serverId)}/members`,
      );
      setMembers(data.members);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить участников");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // socket: member:joined
  useEffect(() => {
    if (!socket || !serverId) return;
    const onJoined = (p: MemberJoinedPayload) => {
      if (p.serverId !== serverId) return;
      setMembers((prev) => {
        if (prev.some((m) => m.id === p.memberId)) return prev;
        const role: MemberRole =
          p.role === "OWNER" || p.role === "ADMIN" || p.role === "MODERATOR" ? (p.role as MemberRole) : "MEMBER";
        return [
          ...prev,
          {
            id: p.memberId,
            userId: p.userId,
            role,
            joinedAt: p.joinedAt,
            online: true, // user только что подключился — точно online
            user: {
              id: p.userId,
              displayName: p.displayName,
              email: "",
              avatar: p.avatar,
              createdAt: p.joinedAt,
            },
          },
        ];
      });
    };
    socket.on(SocketEvents.MemberJoined, onJoined);
    return () => {
      socket.off(SocketEvents.MemberJoined, onJoined);
    };
  }, [socket, serverId]);

  // socket: member:left
  useEffect(() => {
    if (!socket || !serverId) return;
    const onLeft = (p: MemberLeftPayload) => {
      if (p.serverId !== serverId) return;
      setMembers((prev) => prev.filter((m) => m.id !== p.memberId));
    };
    socket.on(SocketEvents.MemberLeft, onLeft);
    return () => {
      socket.off(SocketEvents.MemberLeft, onLeft);
    };
  }, [socket, serverId]);

  // socket: presence:update
  useEffect(() => {
    if (!socket || !serverId) return;
    const onPresence = (p: PresenceUpdatePayload) => {
      setMembers((prev) => {
        if (!prev.some((m) => m.userId === p.userId)) return prev;
        return prev.map((m) =>
          m.userId === p.userId ? { ...m, online: p.status === "online" } : m,
        );
      });
    };
    socket.on(SocketEvents.PresenceUpdate, onPresence);
    return () => {
      socket.off(SocketEvents.PresenceUpdate, onPresence);
    };
  }, [socket, serverId]);

  return { members, loading, error, reload };
}
