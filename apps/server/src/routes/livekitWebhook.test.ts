import { createHash } from "node:crypto";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLivekitToken, type LivekitConfig } from "../livekit.js";
import {
  LIVEKIT_WEBHOOK_BODY_LIMIT,
  registerLivekitWebhookRoutes,
} from "./livekitWebhook.js";

const cfg: LivekitConfig = {
  apiKey: "API-test-webhook",
  apiSecret: "0123456789abcdef0123456789abcdef",
  wsUrl: "wss://voice.example.test/eclipse-chat/livekit",
};
const sessionIdentity = "user-a:123e4567-e89b-42d3-a456-426614174000";

function participantEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: "participant_joined",
    id: "event-1",
    room: { name: "eclipse-channel-a" },
    participant: {
      identity: sessionIdentity,
      metadata: JSON.stringify({ userId: "user-a", displayName: "Alice" }),
    },
    ...overrides,
  };
}

function signBody(rawBody: string, secret = cfg.apiSecret, issuer = cfg.apiKey) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: issuer,
      nbf: now,
      exp: now + 60,
      sha256: createHash("sha256").update(rawBody).digest("base64"),
    },
    secret,
    { algorithm: "HS256" },
  );
}

async function buildApp(options: {
  role?: string | null;
  channel?: null | { id: string; type: string; serverId: string; internal: boolean; server: { mode: "ENGINEERING" | "CLIENT" } };
  removeRejects?: boolean;
} = {}) {
  const app = Fastify({ logger: false });
  await app.register(rateLimit, { global: false });
  app.addContentTypeParser(
    "application/webhook+json",
    { parseAs: "string" },
    (req, body, done) => {
      const raw = typeof body === "string" ? body : body.toString("utf8");
      (req as typeof req & { rawBody?: string }).rawBody = raw;
      done(null, raw);
    },
  );
  const removeParticipant = options.removeRejects
    ? vi.fn(async () => { throw new Error("fixture private upstream failure"); })
    : vi.fn(async () => true);
  await registerLivekitWebhookRoutes(app, {
    config: () => cfg,
    findChannel: vi.fn(async () => options.channel === undefined
      ? { id: "channel-a", type: "VOICE", serverId: "server-a", internal: false, server: { mode: "ENGINEERING" as const } }
      : options.channel),
    findMemberRole: vi.fn(async () => options.role === undefined ? "MEMBER" : options.role),
    removeParticipant,
  });
  await app.ready();
  return { app, removeParticipant };
}

async function injectSigned(app: Awaited<ReturnType<typeof buildApp>>["app"], value: unknown) {
  const rawBody = JSON.stringify(value);
  return app.inject({
    method: "POST",
    url: "/api/webhooks/livekit",
    headers: {
      authorization: signBody(rawBody),
      "content-type": "application/webhook+json",
    },
    payload: rawBody,
  });
}

describe("LiveKit participant authorization webhook", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("allows a current member with realtime access", async () => {
    const { app, removeParticipant } = await buildApp();
    const response = await injectSigned(app, participantEvent());
    expect(response.statusCode).toBe(204);
    expect(removeParticipant).not.toHaveBeenCalled();
    await app.close();
  });

  it("removes a session that reconnects with a token issued before membership revoke", async () => {
    const cachedToken = generateLivekitToken({
      identity: sessionIdentity,
      metadata: JSON.stringify({ userId: "user-a" }),
      room: "eclipse-channel-a",
      ttlSeconds: 300,
    }, cfg);
    expect(jwt.verify(cachedToken, cfg.apiSecret)).toBeTruthy();

    const { app, removeParticipant } = await buildApp({ role: null });
    const response = await injectSigned(app, participantEvent());
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, action: "removed" });
    expect(removeParticipant).toHaveBeenCalledWith("eclipse-channel-a", sessionIdentity, cfg);
    await app.close();
  });

  it("removes a downgraded member from an internal client channel", async () => {
    const { app, removeParticipant } = await buildApp({
      role: "MEMBER",
      channel: { id: "channel-a", type: "VOICE", serverId: "server-a", internal: true, server: { mode: "CLIENT" } },
    });
    const response = await injectSigned(app, participantEvent());
    expect(response.statusCode).toBe(200);
    expect(removeParticipant).toHaveBeenCalledOnce();
    await app.close();
  });

  it.each([
    ["unknown channel", { channel: null }, participantEvent()],
    ["foreign room", {}, participantEvent({ room: { name: "foreign-room" } })],
    ["malformed identity", {}, participantEvent({ participant: { identity: "user-a", metadata: JSON.stringify({ userId: "user-a" }) } })],
    ["mismatched metadata", {}, participantEvent({ participant: { identity: sessionIdentity, metadata: JSON.stringify({ userId: "user-b" }) } })],
  ])("fails closed for %s", async (_name, options, event) => {
    const { app, removeParticipant } = await buildApp(options);
    const response = await injectSigned(app, event);
    expect(response.statusCode).toBe(200);
    expect(removeParticipant).toHaveBeenCalledOnce();
    await app.close();
  });

  it("rejects forged and body-mismatched signatures before ACL work", async () => {
    const { app, removeParticipant } = await buildApp();
    const rawBody = JSON.stringify(participantEvent());
    const forged = await app.inject({
      method: "POST",
      url: "/api/webhooks/livekit",
      headers: { authorization: signBody(rawBody, "fedcba9876543210fedcba9876543210"), "content-type": "application/webhook+json" },
      payload: rawBody,
    });
    const tamperedBody = JSON.stringify(participantEvent({ id: "tampered" }));
    const tampered = await app.inject({
      method: "POST",
      url: "/api/webhooks/livekit",
      headers: { authorization: signBody(rawBody), "content-type": "application/webhook+json" },
      payload: tamperedBody,
    });
    expect(forged.statusCode).toBe(401);
    expect(tampered.statusCode).toBe(401);
    expect(removeParticipant).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns retryable failure when fail-closed removal is unavailable", async () => {
    const { app } = await buildApp({ role: null, removeRejects: true });
    const response = await injectSigned(app, participantEvent());
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toMatch(/fixture|upstream|private/i);
    await app.close();
  });

  it("accepts other signed events without running participant ACL logic", async () => {
    const { app, removeParticipant } = await buildApp();
    const response = await injectSigned(app, { event: "room_finished", id: "event-2" });
    expect(response.statusCode).toBe(204);
    expect(removeParticipant).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects payloads over the route body limit", async () => {
    const { app } = await buildApp();
    const rawBody = JSON.stringify({ event: "room_finished", padding: "x".repeat(LIVEKIT_WEBHOOK_BODY_LIMIT) });
    const response = await app.inject({
      method: "POST",
      url: "/api/webhooks/livekit",
      headers: { authorization: signBody(rawBody), "content-type": "application/webhook+json" },
      payload: rawBody,
    });
    expect(response.statusCode).toBe(413);
    await app.close();
  });
});
