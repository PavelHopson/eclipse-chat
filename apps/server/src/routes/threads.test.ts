import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  messageFindUnique: vi.fn(),
  messageFindMany: vi.fn(),
  memberFindUnique: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    message: {
      findUnique: mocks.messageFindUnique,
      findMany: mocks.messageFindMany,
    },
    member: { findUnique: mocks.memberFindUnique },
  },
}));

vi.mock("../auth/requireJwt.js", () => ({
  getUserId: (request: FastifyRequest) => request.headers["x-test-user"] ?? null,
  requireJwt: async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.headers["x-test-user"]) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  },
}));

vi.mock("../lib/userView.js", () => ({
  serializeUser: (user: unknown) => user,
}));
vi.mock("../ai/embedSync.js", () => ({ scheduleEmbed: vi.fn() }));
vi.mock("../realtime.js", () => ({
  emitThreadReplyNew: vi.fn(),
  emitThreadMetaUpdate: vi.fn(),
}));
vi.mock("../attachments.js", () => ({
  ATTACHMENTS_PER_MESSAGE: 8,
  MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS: 12 * 1024 * 1024,
  kickoffTranscription: vi.fn(),
  processAttachment: vi.fn(),
}));

import { registerThreadRoutes } from "./threads.js";

const user = {
  id: "user-1",
  displayName: "Alice",
  avatar: null,
  botProfile: null,
  email: "alice@example.test",
};

function buildRoot(overrides: Record<string, unknown> = {}) {
  return {
    id: "root-1",
    content: "Root message",
    createdAt: new Date("2026-10-24T08:00:00.000Z"),
    editedAt: null,
    deletedAt: null,
    pinnedAt: null,
    parentMessageId: null,
    channelId: "channel-1",
    user,
    reactions: [],
    attachments: [],
    channel: {
      serverId: "server-1",
      internal: false,
      server: { mode: "ENGINEERING" },
    },
    ...overrides,
  };
}

async function request(userId: string | null, root = buildRoot()) {
  const app = Fastify({ logger: false });
  await registerThreadRoutes(app);
  try {
    return await app.inject({
      method: "GET",
      url: "/api/messages/root-1/thread",
      headers: userId ? { "x-test-user": userId } : undefined,
    });
  } finally {
    await app.close();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.messageFindUnique.mockResolvedValue(buildRoot());
  mocks.messageFindMany.mockResolvedValue([]);
  mocks.memberFindUnique.mockResolvedValue({ role: "MEMBER" });
});

describe("GET /api/messages/:id/thread access control", () => {
  it("requires a JWT before reading the root message", async () => {
    const response = await request(null);

    expect(response.statusCode).toBe(401);
    expect(mocks.messageFindUnique).not.toHaveBeenCalled();
    expect(mocks.memberFindUnique).not.toHaveBeenCalled();
  });

  it("rejects an authenticated user who is not a server member", async () => {
    mocks.memberFindUnique.mockResolvedValue(null);

    const response = await request("outsider");

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Not a member of this server" });
    expect(mocks.messageFindMany).not.toHaveBeenCalled();
  });

  it("hides internal CLIENT channels from members without internal-room permission", async () => {
    mocks.messageFindUnique.mockResolvedValue(
      buildRoot({
        channel: {
          serverId: "server-1",
          internal: true,
          server: { mode: "CLIENT" },
        },
      }),
    );
    mocks.memberFindUnique.mockResolvedValue({ role: "CLIENT" });

    const response = await request("client-user");

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Root message not found" });
    expect(mocks.messageFindMany).not.toHaveBeenCalled();
  });

  it("returns the thread for an allowed member", async () => {
    mocks.memberFindUnique.mockResolvedValue({ role: "MEMBER" });
    mocks.messageFindMany.mockResolvedValue([
      {
        ...buildRoot({ id: "reply-1", parentMessageId: "root-1", content: "Reply" }),
      },
    ]);

    const response = await request("user-1");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      channelId: "channel-1",
      root: { id: "root-1", content: "Root message" },
      replies: [{ id: "reply-1", content: "Reply" }],
    });
    expect(mocks.memberFindUnique).toHaveBeenCalledWith({
      where: { userId_serverId: { userId: "user-1", serverId: "server-1" } },
      select: { role: true },
    });
  });
});
