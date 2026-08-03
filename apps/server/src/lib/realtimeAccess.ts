import type { MemberRole } from "../routes/servers.js";
import { hasPermission } from "./permissions.js";

export type RealtimeWorkspaceMode = "ENGINEERING" | "CLIENT";

/** Mirrors the REST visibility rule for Socket.IO subscriptions and broadcasts. */
export function canAccessRealtimeChannel(
  mode: RealtimeWorkspaceMode,
  internal: boolean,
  role: MemberRole,
): boolean {
  return mode !== "CLIENT" || !internal || hasPermission(role, "ROOM_VIEW_INTERNAL");
}

export function serverRealtimeRoom(serverId: string, internal: boolean): string {
  return internal ? `server-internal:${serverId}` : `server:${serverId}`;
}

export function restrictedRealtimeRooms(
  rooms: Iterable<string>,
  channelIds: ReadonlySet<string>,
  threadRootIds: ReadonlySet<string>,
): string[] {
  const restricted: string[] = [];
  for (const room of rooms) {
    if (room.startsWith("channel:") && channelIds.has(room.slice("channel:".length))) {
      restricted.push(room);
    } else if (room.startsWith("thread:") && threadRootIds.has(room.slice("thread:".length))) {
      restricted.push(room);
    }
  }
  return restricted;
}
