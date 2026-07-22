import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";
import type { MemberRole, UserManualStatus } from "./useMembers";
import type { ProfileImage } from "./useProfile";

export type ViewedUserProfile = {
  id: string;
  displayName: string;
  avatar: string | null;
  profileBanner: string | null;
  profileImages: ProfileImage[];
  bio: string | null;
  status: UserManualStatus;
  activityText: string | null;
  activityEmoji: string | null;
  createdAt: string;
  online: boolean;
  isSelf: boolean;
  canMessage: boolean;
  serverContext: {
    role: MemberRole;
    joinedAt: string;
  } | null;
};

type ProfileResponse = { user: ViewedUserProfile };

export function useUserProfile(userId: string | null, serverId: string | null) {
  const [profile, setProfile] = useState<ViewedUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const query = serverId ? `?serverId=${encodeURIComponent(serverId)}` : "";
      const data = await apiJson<ProfileResponse>(
        `/api/users/${encodeURIComponent(userId)}/profile${query}`,
      );
      setProfile(data.user);
    } catch (cause) {
      setProfile(null);
      setError(cause instanceof ApiError ? cause.message : "Не удалось открыть профиль");
    } finally {
      setLoading(false);
    }
  }, [serverId, userId]);

  useEffect(() => {
    setProfile(null);
    setError(null);
    if (userId) void reload();
  }, [reload, userId]);

  return { profile, loading, error, reload };
}
