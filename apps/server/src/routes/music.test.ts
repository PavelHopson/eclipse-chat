import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { editMusicQueue, queueEditBody } from "../lib/musicQueue.js";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(), member: vi.fn(), session: vi.fn(), updateMany: vi.fn(), attachments: vi.fn(), attachment: vi.fn(), deleteMany: vi.fn(), emit: vi.fn(),
}));
vi.mock("../db.js", () => ({ db: {
  channel: { findUnique: mocks.channel }, member: { findUnique: mocks.member },
  musicSession: { findUnique: mocks.session, updateMany: mocks.updateMany, deleteMany: mocks.deleteMany },
  attachment: { findMany: mocks.attachments, findUnique: mocks.attachment },
} }));
vi.mock("../realtime.js", () => ({ emitMusicSessionUpdated: mocks.emit }));
vi.mock("../auth/requireJwt.js", () => ({
  getUserId: (request: FastifyRequest) => request.headers["x-test-user"] ?? null,
  requireJwt: async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.headers["x-test-user"]) return reply.code(401).send({ error: "Unauthorized" });
  },
}));
import { registerMusicRoutes } from "./music.js";

const queue = ["track-a", "track-b", "track-a"];
const session = {
  id: "session", channelId: "room", queue: JSON.stringify(queue), hostUserId: "host",
  currentTrackAttachmentId: null, currentTrack: null, positionMs: 12000, startedAt: null,
  isPlaying: false, host: { id: "host", displayName: "Host", avatar: null }, updatedAt: new Date("2026-08-28T10:00:00Z"),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.channel.mockResolvedValue({ id: "room", serverId: "space", type: "VOICE" });
  mocks.member.mockResolvedValue({ id: "member", role: "MEMBER" });
  mocks.session.mockResolvedValue(session);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.attachment.mockResolvedValue({ id: "track-a", mimeType: "audio/mpeg", message: { channel: { serverId: "space" }, deletedAt: null } });
  mocks.attachments.mockResolvedValue([{ id: "track-a", filename: "A.mp3" }, { id: "track-b", filename: "B.mp3" }]);
});
async function request(payload: unknown, user: string | null = "host", method: "PATCH" | "GET" | "POST" = "PATCH", action = "queue") {
  const app = Fastify({ logger: false });
  await registerMusicRoutes(app);
  try {
    return await app.inject({ method, url: "/api/channels/room/music/" + action,
      headers: { ...(user ? { "x-test-user": user } : {}), ...(method === "PATCH" ? { "content-type": "application/json" } : {}) }, ...(method === "PATCH" ? { payload: JSON.stringify(payload) } : {}) });
  } finally { await app.close(); }
}
const remove = { action: "remove", from: 2, expectedQueue: queue };

describe("shared media queue authorization and concurrency", () => {
  it("requires authentication", async () => {
    expect((await request(remove, null)).statusCode).toBe(401);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("requires workspace membership even for the session host", async () => {
    mocks.member.mockResolvedValue(null);
    expect((await request(remove)).statusCode).toBe(403);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("does not grant queue editing to an ordinary listener", async () => {
    expect((await request(remove, "listener")).statusCode).toBe(403);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it.each(["OWNER", "ADMIN", "MODERATOR", "OPERATOR"])("permits the existing %s moderation role", async role => {
    mocks.member.mockResolvedValue({ id: "member", role });
    expect((await request(remove, "moderator")).statusCode).toBe(200);
  });
  it("removes the selected occurrence, preserving playback and other occurrences", async () => {
    expect((await request(remove)).statusCode).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "session", queue: JSON.stringify(queue), hostUserId: "host" },
      data: { queue: JSON.stringify(["track-a", "track-b"]) },
    });
    expect(mocks.emit).toHaveBeenCalledOnce();
  });
  it("moves an existing occurrence without allowing arbitrary attachment insertion", async () => {
    expect((await request({ action: "move", from: 2, to: 0, expectedQueue: queue })).statusCode).toBe(200);
    expect(mocks.updateMany.mock.calls[0][0].data).toEqual({ queue: '["track-a","track-a","track-b"]' });
    mocks.updateMany.mockClear();
    expect((await request({ ...remove, expectedQueue: ["private-attachment"] })).statusCode).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("rejects stale snapshots and emits nothing", async () => {
    expect((await request({ ...remove, expectedQueue: [...queue].reverse().slice(1) })).statusCode).toBe(409);
    expect(mocks.emit).not.toHaveBeenCalled();
  });
  it("detects a concurrent queue or host change during compare-and-swap", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(remove)).statusCode).toBe(409);
    expect(mocks.emit).not.toHaveBeenCalled();
  });
  it.each([
    { ...remove, from: -1 }, { ...remove, from: 1.5 }, { ...remove, attachmentId: "other" },
    { action: "move", from: 0, expectedQueue: queue },
    { ...remove, expectedQueue: Array(1001).fill("x") },
  ])("validates malformed or oversized edits", async body => {
    expect((await request(body)).statusCode).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("keeps queue indices for duplicate and unavailable files", async () => {
    mocks.attachments.mockResolvedValue([{ id: "track-a", filename: "A.mp3" }]);
    const response = await request(null, "listener", "GET");
    expect(response.statusCode).toBe(200);
    expect(response.json().queue).toEqual([
      { id: "track-a", queueIndex: 0, filename: "A.mp3", available: true },
      { id: "track-b", queueIndex: 1, filename: "Трек недоступен", available: false },
      { id: "track-a", queueIndex: 2, filename: "A.mp3", available: true },
    ]);
    expect(mocks.attachments.mock.calls[0][0].where.message).toEqual({ channel: { serverId: "space" }, deletedAt: null });
  });
});
describe("queue edit model", () => {
  it("is immutable and preserves duplicate occurrence identity", () => {
    expect(editMusicQueue(queue, { action: "move", from: 0, to: 2, expectedQueue: queue })).toEqual(["track-b", "track-a", "track-a"]);
    expect(queue).toEqual(["track-a", "track-b", "track-a"]);
  });
  it("rejects out-of-range indices and unknown keys", () => {
    expect(editMusicQueue(queue, { action: "remove", from: 3, expectedQueue: queue })).toBeNull();
    expect(queueEditBody.safeParse({ ...remove, hostUserId: "attacker" }).success).toBe(false);
  });
});

describe("skip cannot overwrite a concurrent queue edit", () => {
  it("compares both queue and current track before advancing", async () => {
    expect((await request(null, "host", "POST", "skip")).statusCode).toBe(200);
    expect(mocks.updateMany.mock.calls[0][0].where).toEqual({
      id: "session", queue: JSON.stringify(queue), hostUserId: "host", currentTrackAttachmentId: null,
    });
    expect(mocks.updateMany.mock.calls[0][0].data.queue).toBe('["track-b","track-a"]');
  });
  it("rejects a concurrent edit without broadcasting stale state", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(null, "host", "POST", "skip")).statusCode).toBe(409);
    expect(mocks.emit).not.toHaveBeenCalled();
  });
  it("does not delete a session if a track was added concurrently", async () => {
    mocks.session.mockResolvedValue({ ...session, queue: "[]" });
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    expect((await request(null, "host", "POST", "skip")).statusCode).toBe(409);
    expect(mocks.emit).not.toHaveBeenCalled();
  });
  it("discards deleted media without starting it", async () => {
    mocks.attachment.mockResolvedValue({ id: "track-a", mimeType: "audio/mpeg",
      message: { channel: { serverId: "space" }, deletedAt: new Date() } });
    expect((await request(null, "host", "POST", "skip")).statusCode).toBe(409);
    expect(mocks.updateMany.mock.calls[0][0].data).toEqual({ queue: '["track-b","track-a"]' });
  });
});
