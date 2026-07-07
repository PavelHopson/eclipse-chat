export type ManualStatus = "ONLINE" | "IDLE" | "DND" | "INVISIBLE";

export type FriendshipStatus = "PENDING" | "ACCEPTED" | "BLOCKED";

export type UserActivityFields = {
  activityText: string | null;
  activityEmoji: string | null;
};

export type UserQuietHoursFields = {
  quietFrom: string | null;
  quietTo: string | null;
  timezone: string | null;
};

export type PublicProfile = UserActivityFields & UserQuietHoursFields & {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  status?: ManualStatus;
  twoFactorEnabled?: boolean;
  createdAt: string;
};

export type FriendshipDto = {
  id: string;
  status: FriendshipStatus;
  requestedByUserId: string;
  blockedByUserId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  other: {
    id: string;
    displayName: string;
    avatar: string | null;
    manualStatus: ManualStatus;
    activityText: string | null;
    activityEmoji: string | null;
  };
};

export type FriendsResponse = {
  accepted: FriendshipDto[];
  pendingIn: FriendshipDto[];
  pendingOut: FriendshipDto[];
  blocked: FriendshipDto[];
  blockedBy: FriendshipDto[];
};

export type FriendRequestInput =
  | { userId: string; email?: never; displayName?: never }
  | { userId?: never; email: string; displayName?: never }
  | { userId?: never; email?: never; displayName: string };

export type FriendRequestResponse = {
  friendship: FriendshipDto;
  autoAccepted?: boolean;
  alreadyPending?: boolean;
};

export type ChannelType = "TEXT" | "VOICE" | "BROADCAST" | "EXECUTION";

export type CategoryDto = {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type ChannelDto = {
  id: string;
  name: string;
  slug: string;
  type?: ChannelType;
  position: number;
  categoryId?: string | null;
  description?: string | null;
  emoji?: string | null;
  internal?: boolean;
  expiresAt?: string | null;
  /** v1.7.0 — дефолтный TTL исчезающих сообщений (секунды; null = выкл). */
  messageTtlSeconds?: number | null;
  createdAt: string;
  _count?: { messages: number };
};
