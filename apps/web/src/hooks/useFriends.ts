import { useCallback, useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import {
  SocketEvents,
  type FriendBlockedPayload,
  type FriendRemovedPayload,
  type FriendRequestAcceptedPayload,
  type FriendRequestReceivedPayload,
} from "../lib/socket";
import type {
  FriendRequestInput,
  FriendRequestResponse,
  FriendsResponse,
  FriendshipDto,
} from "../types/api";

type FriendsState = FriendsResponse;

const EMPTY_FRIENDS: FriendsState = {
  accepted: [],
  pendingIn: [],
  pendingOut: [],
  blocked: [],
  blockedBy: [],
};

function removeById(list: FriendshipDto[], friendshipId: string): FriendshipDto[] {
  return list.filter((f) => f.id !== friendshipId);
}

function replaceAccepted(list: FriendshipDto[], friendship: FriendshipDto): FriendshipDto[] {
  const without = removeById(list, friendship.id);
  return [friendship, ...without].sort((a, b) =>
    a.other.displayName.localeCompare(b.other.displayName, "ru"),
  );
}

async function throwApiError(res: Response): Promise<never> {
  let detail: unknown = null;
  try {
    detail = await res.json();
  } catch {
    /* non-json body */
  }
  const message =
    detail && typeof detail === "object" && "error" in detail
      ? String((detail as { error: unknown }).error)
      : `HTTP ${res.status}`;
  throw new ApiError(message, res.status, detail);
}

export function useFriends(socket: Socket | null) {
  const [state, setState] = useState<FriendsState>(EMPTY_FRIENDS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiJson<FriendsResponse>("/api/friends");
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить друзей");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void mutate();
    const id = window.setInterval(() => {
      void mutate();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [mutate]);

  useEffect(() => {
    if (!socket) return;

    const reload = () => {
      void mutate();
    };

    const onReceived = (_payload: FriendRequestReceivedPayload) => reload();
    const onAccepted = (_payload: FriendRequestAcceptedPayload) => reload();
    const onRemoved = (payload: FriendRemovedPayload) => {
      setState((prev) => ({
        accepted: removeById(prev.accepted, payload.friendshipId),
        pendingIn: removeById(prev.pendingIn, payload.friendshipId),
        pendingOut: removeById(prev.pendingOut, payload.friendshipId),
        blocked: removeById(prev.blocked, payload.friendshipId),
        blockedBy: removeById(prev.blockedBy, payload.friendshipId),
      }));
      void mutate();
    };
    const onBlocked = (_payload: FriendBlockedPayload) => reload();

    socket.on(SocketEvents.FriendRequestReceived, onReceived);
    socket.on(SocketEvents.FriendRequestAccepted, onAccepted);
    socket.on(SocketEvents.FriendRemoved, onRemoved);
    socket.on(SocketEvents.FriendBlocked, onBlocked);

    return () => {
      socket.off(SocketEvents.FriendRequestReceived, onReceived);
      socket.off(SocketEvents.FriendRequestAccepted, onAccepted);
      socket.off(SocketEvents.FriendRemoved, onRemoved);
      socket.off(SocketEvents.FriendBlocked, onBlocked);
    };
  }, [socket, mutate]);

  const sendRequest = useCallback(async (input: FriendRequestInput) => {
    const data = await apiJson<FriendRequestResponse>("/api/friends/request", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setState((prev) => {
      const friendship = data.friendship;
      if (friendship.status === "ACCEPTED") {
        return {
          ...prev,
          accepted: replaceAccepted(prev.accepted, friendship),
          pendingIn: removeById(prev.pendingIn, friendship.id),
          pendingOut: removeById(prev.pendingOut, friendship.id),
        };
      }
      return {
        ...prev,
        pendingOut: [friendship, ...removeById(prev.pendingOut, friendship.id)],
      };
    });
    return data;
  }, []);

  const acceptRequest = useCallback(async (friendshipId: string) => {
    const data = await apiJson<{ friendship: FriendshipDto }>(
      `/api/friends/${encodeURIComponent(friendshipId)}/accept`,
      { method: "POST" },
    );
    setState((prev) => ({
      ...prev,
      accepted: replaceAccepted(prev.accepted, data.friendship),
      pendingIn: removeById(prev.pendingIn, friendshipId),
    }));
    return data.friendship;
  }, []);

  const removeFriendship = useCallback(async (friendshipId: string) => {
    const res = await api(`/api/friends/${encodeURIComponent(friendshipId)}`, {
      method: "DELETE",
    });
    if (!res.ok) await throwApiError(res);
    setState((prev) => ({
      accepted: removeById(prev.accepted, friendshipId),
      pendingIn: removeById(prev.pendingIn, friendshipId),
      pendingOut: removeById(prev.pendingOut, friendshipId),
      blocked: removeById(prev.blocked, friendshipId),
      blockedBy: removeById(prev.blockedBy, friendshipId),
    }));
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    const data = await apiJson<{ friendship: FriendshipDto }>("/api/friends/block", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    setState((prev) => ({
      ...prev,
      accepted: removeById(prev.accepted, data.friendship.id),
      pendingIn: removeById(prev.pendingIn, data.friendship.id),
      pendingOut: removeById(prev.pendingOut, data.friendship.id),
      blocked: [data.friendship, ...removeById(prev.blocked, data.friendship.id)],
    }));
    return data.friendship;
  }, []);

  const unblockUser = useCallback(async (userId: string) => {
    const res = await api(`/api/friends/block/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (!res.ok) await throwApiError(res);
    setState((prev) => ({
      ...prev,
      blocked: prev.blocked.filter((f) => f.other.id !== userId),
    }));
  }, []);

  return useMemo(
    () => ({
      accepted: state.accepted,
      pendingIn: state.pendingIn,
      pendingOut: state.pendingOut,
      blocked: state.blocked,
      blockedBy: state.blockedBy,
      isLoading,
      error,
      mutate,
      sendRequest,
      acceptRequest,
      removeFriendship,
      blockUser,
      unblockUser,
    }),
    [
      state,
      isLoading,
      error,
      mutate,
      sendRequest,
      acceptRequest,
      removeFriendship,
      blockUser,
      unblockUser,
    ],
  );
}
