import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  member: vi.fn(),
  user: vi.fn(),
  token: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    channel: { findUnique: mocks.channel },
    member: { findUnique: mocks.member },
    user: { findUnique: mocks.user },
  },
}));
vi.mock("../auth/requireJwt.js", () => ({
  getUserId: (request: FastifyRequest) => request.headers["x-test-user"] ?? null,
  requireJwt: async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.headers["x-test-user"]) return reply.code(401).send({ error: "Unauthorized" });
  },
}));
vi.mock("../livekit.js", () => ({
  getLivekitConfig: () => ({
    apiKey: ["fixture", "key"].join("-"),
    apiSecret: ["fixture", "secret"].join("-"),
    wsUrl: "wss://voice.invalid",
  }),
  roomNameForChannel: (channelId: string) => `eclipse-${channelId}`,
  generateLivekitToken: mocks.token,
}));

import {
  registerVoiceRoutes,
  VOICE_TOKEN_RATE_LIMIT,
  VOICE_TOKEN_TTL_SECONDS,
} from "./voice.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.channel.mockResolvedValue({
    id: "voice-room",
    type: "VOICE",
    serverId: "workspace",
    name: "Call",
    internal: false,
    server: { mode: "ENGINEERING" },
  });
  mocks.member.mockResolvedValue({ id: "member", role: "MEMBER" });
  mocks.user.mockResolvedValue({ id: "alice", displayName: "Alice", avatar: null });
  mocks.token.mockReturnValue("fixture-livekit-token");
});

async function request() {
  const app = Fastify({ logger: false });
  await registerVoiceRoutes(app);
  try {
    return await app.inject({
      method: "POST",
      url: "/api/channels/voice-room/voice/join",
      headers: { "x-test-user": "alice" },
    });
  } finally {
    await app.close();
  }
}

describe("voice token authorization", () => {
  it("denies missing workspace membership without minting a token", async () => {
    mocks.member.mockResolvedValue(null);
    const response = await request();
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Channel access denied" });
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it.each(["CLIENT", "GUEST", "MEMBER"])(
    "denies %s access to an internal client-workspace voice room",
    async role => {
      mocks.channel.mockResolvedValue({
        id: "voice-room",
        type: "VOICE",
        serverId: "workspace",
        name: "Internal call",
        internal: true,
        server: { mode: "CLIENT" },
      });
      mocks.member.mockResolvedValue({ id: "member", role });
      const response = await request();
      expect(response.statusCode).toBe(403);
      expect(mocks.token).not.toHaveBeenCalled();
    },
  );

  it.each(["OWNER", "ADMIN", "MODERATOR", "ARCHITECT", "DEVELOPER", "OPERATOR", "VIEWER"])(
    "allows explicitly privileged %s access to an internal client-workspace voice room",
    async role => {
      mocks.channel.mockResolvedValue({
        id: "voice-room",
        type: "VOICE",
        serverId: "workspace",
        name: "Internal call",
        internal: true,
        server: { mode: "CLIENT" },
      });
      mocks.member.mockResolvedValue({ id: "member", role });
      expect((await request()).statusCode).toBe(200);
      expect(mocks.token).toHaveBeenCalledOnce();
    },
  );

  it("allows ordinary members in engineering or external client rooms", async () => {
    expect((await request()).statusCode).toBe(200);
    mocks.token.mockClear();
    mocks.channel.mockResolvedValue({
      id: "voice-room",
      type: "VOICE",
      serverId: "workspace",
      name: "Client call",
      internal: false,
      server: { mode: "CLIENT" },
    });
    expect((await request()).statusCode).toBe(200);
    expect(mocks.token).toHaveBeenCalledOnce();
  });

  it("issues a short-lived room-scoped token", async () => {
    const response = await request();
    expect(response.statusCode).toBe(200);
    expect(mocks.token.mock.calls[0][0]).toMatchObject({
      room: "eclipse-voice-room",
      ttlSeconds: VOICE_TOKEN_TTL_SECONDS,
      canPublishData: false,
    });
    expect(VOICE_TOKEN_TTL_SECONDS).toBe(300);
  });

  it("rate limits token minting by authenticated user, independent of spoofed IP headers", async () => {
    const app = Fastify({ logger: false });
    await registerVoiceRoutes(app);
    try {
      for (let index = 0; index < VOICE_TOKEN_RATE_LIMIT; index++) {
        expect((await app.inject({
          method: "POST",
          url: "/api/channels/voice-room/voice/join",
          headers: {
            "x-test-user": "alice",
            "x-forwarded-for": `198.51.100.${index}, 203.0.113.10`,
          },
        })).statusCode).toBe(200);
      }
      const blocked = await app.inject({
        method: "POST",
        url: "/api/channels/voice-room/voice/join",
        headers: { "x-test-user": "alice", "x-forwarded-for": "192.0.2.99" },
      });
      expect(blocked.statusCode).toBe(429);
      expect(blocked.headers["retry-after"]).toBe("60");
      expect((await app.inject({
        method: "POST",
        url: "/api/channels/voice-room/voice/join",
        headers: { "x-test-user": "bob", "x-forwarded-for": "192.0.2.99" },
      })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
