export type ManualStatus = "ONLINE" | "IDLE" | "DND" | "INVISIBLE";

export type FriendshipStatus = "PENDING" | "ACCEPTED" | "BLOCKED";

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
