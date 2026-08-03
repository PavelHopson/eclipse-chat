import type { Server as SocketServer } from "socket.io";
import { describe, expect, it } from "vitest";
import {
  canAccessRealtimeChannel,
  restrictedRealtimeRooms,
  serverRealtimeRoom,
} from "../src/lib/realtimeAccess.js";
import { emitActionItemCreated, setSocketIO } from "../src/realtime.js";
import {
  setVoicePresenceIO,
  trackVoiceJoin,
  trackVoiceLeave,
} from "../src/voicePresence.js";

function recordingIo() {
  const events: Array<{ rooms: string[]; event: string }> = [];
  const rooms: string[] = [];
  const target = {
    to(room: string) {
      rooms.push(room);
      return target;
    },
    emit(event: string) {
      events.push({ rooms: [...rooms], event });
      rooms.length = 0;
      return true;
    },
  };
  return { io: target as unknown as SocketServer, events };
}

const actionPayload = {
  id: "action-1",
  title: "Internal action",
  type: "TASK" as const,
  status: "OPEN" as const,
  serverId: "server-1",
  channelId: "channel-1",
  sourceMessageId: "message-1",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  dueAt: null,
  createdBy: { id: "user-1", displayName: "Owner", avatar: null },
  assignee: null,
};

describe("realtime internal-room isolation", () => {
  it("mirrors REST visibility for client workspaces", () => {
    for (const role of ["CLIENT", "GUEST", "MEMBER"] as const) {
      expect(canAccessRealtimeChannel("CLIENT", true, role), role).toBe(false);
      expect(canAccessRealtimeChannel("CLIENT", false, role), role).toBe(true);
    }
    expect(canAccessRealtimeChannel("CLIENT", true, "OWNER")).toBe(true);
    expect(canAccessRealtimeChannel("ENGINEERING", true, "MEMBER")).toBe(true);
  });

  it("uses a separate server room for internal events", () => {
    expect(serverRealtimeRoom("workspace", false)).toBe("server:workspace");
    expect(serverRealtimeRoom("workspace", true)).toBe("server-internal:workspace");
  });

  it("revokes stale internal channel and thread subscriptions", () => {
    const rooms = restrictedRealtimeRooms(
      new Set(["socket-1", "server:workspace", "channel:public", "channel:internal", "thread:secret"]),
      new Set(["internal"]),
      new Set(["secret"]),
    );
    expect(rooms).toEqual(["channel:internal", "thread:secret"]);
  });

  it("keeps internal action events out of the public server room", () => {
    const recorder = recordingIo();
    setSocketIO(recorder.io);

    emitActionItemCreated("channel-1", { ...actionPayload, internal: true });

    expect(recorder.events).toEqual([
      {
        rooms: ["channel:channel-1", "server-internal:server-1"],
        event: "action:item:created",
      },
    ]);
  });

  it("routes internal voice presence only to authorized subscribers", () => {
    const recorder = recordingIo();
    setVoicePresenceIO(recorder.io);

    trackVoiceJoin("socket-internal", "user-1", "voice-1", "server-1", true);
    trackVoiceLeave("socket-internal");

    expect(recorder.events.map((entry) => entry.rooms)).toEqual([
      ["server-internal:server-1"],
      ["server-internal:server-1"],
    ]);
  });
});
