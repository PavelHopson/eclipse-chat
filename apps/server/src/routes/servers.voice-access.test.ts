import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  server: vi.fn(),
  members: vi.fn(),
  revokeUsers: vi.fn(),
  deleteRooms: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    server: { findUnique: mocks.server },
    member: { findMany: mocks.members },
  },
}));
vi.mock("../livekit.js", () => ({
  removeLivekitUsersFromChannels: mocks.revokeUsers,
  deleteLivekitRoomsForChannels: mocks.deleteRooms,
}));

import {
  revokeLostVoiceAccess,
  revokeLostVoiceChannelAccess,
  revokeLostVoiceServerModeAccess,
} from "./servers.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.server.mockResolvedValue({
    mode: "CLIENT",
    channels: [
      { id: "public-voice", internal: false },
      { id: "internal-voice", internal: true },
    ],
    members: [],
  });
  mocks.members.mockResolvedValue([]);
  mocks.revokeUsers.mockResolvedValue(1);
  mocks.deleteRooms.mockResolvedValue(1);
});

describe("workspace voice access revocation", () => {
  it("removes every session of a demoted user only from rooms the new role cannot access", async () => {
    await revokeLostVoiceAccess("user-42", "workspace", "ADMIN", "MEMBER");
    expect(mocks.revokeUsers).toHaveBeenCalledWith(["user-42"], ["internal-voice"]);
  });

  it("removes every session of a leaving user from all previously accessible rooms", async () => {
    await revokeLostVoiceAccess("user-42", "workspace", "ADMIN", null);
    expect(mocks.revokeUsers).toHaveBeenCalledWith(
      ["user-42"],
      ["public-voice", "internal-voice"],
    );
  });

  it("does not revoke rooms when a role change preserves or expands access", async () => {
    await revokeLostVoiceAccess("user-42", "workspace", "MEMBER", "ADMIN");
    expect(mocks.revokeUsers).toHaveBeenCalledWith(["user-42"], []);
  });

  it("revokes users who lose an internal voice channel after its visibility changes", async () => {
    mocks.members.mockResolvedValue([
      { userId: "member", role: "MEMBER" },
      { userId: "moderator", role: "MODERATOR" },
    ]);
    await revokeLostVoiceChannelAccess(
      "workspace", "voice", "CLIENT", "CLIENT", false, true,
    );
    expect(mocks.revokeUsers).toHaveBeenCalledWith(["member"], ["voice"]);
  });

  it("revokes affected users from every internal room on Engineering to Client mode", async () => {
    mocks.server.mockResolvedValue({
      channels: [
        { id: "public-voice", internal: false },
        { id: "internal-a", internal: true },
        { id: "internal-b", internal: true },
      ],
      members: [
        { userId: "member", role: "MEMBER" },
        { userId: "moderator", role: "MODERATOR" },
      ],
    });
    mocks.revokeUsers.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    await expect(
      revokeLostVoiceServerModeAccess("workspace", "ENGINEERING", "CLIENT"),
    ).resolves.toBe(2);
    expect(mocks.revokeUsers.mock.calls).toEqual([
      [["member"], ["internal-a"]],
      [["member"], ["internal-b"]],
    ]);
  });

  it("propagates RoomService failures so access mutations can abort", async () => {
    mocks.revokeUsers.mockRejectedValue(new Error("RoomService unavailable"));
    await expect(
      revokeLostVoiceAccess("user-42", "workspace", "ADMIN", "MEMBER"),
    ).rejects.toThrow("RoomService unavailable");
  });

  it("wires revoke/delete before every database mutation that can remove voice access", () => {
    const source = readFileSync(new URL("./servers.ts", import.meta.url), "utf8")
      .replaceAll("\r\n", "\n");
    const serverDelete = source.slice(
      source.indexOf('app.delete("/api/servers/:id"'),
      source.indexOf('/** POST /api/servers/join/:code'),
    );
    expect(serverDelete.indexOf("deleteLivekitRoomsForChannels")).toBeLessThan(
      serverDelete.indexOf("db.server.delete"),
    );

    const channelPatch = source.slice(
      source.indexOf('"/api/channels/:id",'),
      source.indexOf('/**\n   * PATCH /api/servers/:id/channels/reorder'),
    );
    expect(channelPatch.indexOf("revokeLostVoiceChannelAccess")).toBeLessThan(
      channelPatch.indexOf("db.channel.update"),
    );

    const channelDelete = source.slice(
      source.indexOf('app.delete("/api/channels/:id"'),
      source.indexOf('/**\n   * POST /api/servers/:id/icon'),
    );
    expect(channelDelete.indexOf("deleteLivekitRoomsForChannels")).toBeLessThan(
      channelDelete.indexOf("db.channel.delete"),
    );

    const modePatch = source.slice(source.indexOf('"/api/servers/:id/identity"'));
    expect(modePatch.indexOf("revokeLostVoiceServerModeAccess")).toBeLessThan(
      modePatch.indexOf("db.server.update"),
    );
  });
});
