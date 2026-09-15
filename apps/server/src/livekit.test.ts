import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import {
  deleteLivekitRoomsForChannels,
  removeLivekitUsersFromChannels,
  roomNameForChannel,
  type LivekitConfig,
} from "./livekit.js";

const config: LivekitConfig = {
  apiKey: ["fixture", "key"].join("-"),
  apiSecret: ["fixture", "secret"].join("-"),
  wsUrl: "wss://voice.example.test/eclipse-chat/livekit",
};

describe("LiveKit runtime access revocation", () => {
  it("lists a room and removes every exact user session without prefix collisions", async () => {
    const calls: Array<[URL | RequestInfo, RequestInit | undefined]> = [];
    const request = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push([input, init]);
      if (String(input).endsWith("/ListParticipants")) {
        return Response.json({ participants: [
          { identity: "user-42:session-a" },
          { identity: "user-42:session-b" },
          { identity: "user-420:foreign-prefix" },
          { identity: "another-user:session" },
        ] });
      }
      return new Response("{}", { status: 200 });
    });

    await expect(
      removeLivekitUsersFromChannels(
        ["user-42"],
        ["voice-a", "voice-a"],
        config,
        request as typeof fetch,
      ),
    ).resolves.toBe(2);

    expect(request).toHaveBeenCalledTimes(3);
    expect(String(calls[0]![0])).toBe(
      "https://voice.example.test/eclipse-chat/livekit/twirp/livekit.RoomService/ListParticipants",
    );
    const removedIdentities = calls.slice(1).map(([, init]) => JSON.parse(String(init?.body)).identity);
    expect(removedIdentities).toEqual(["user-42:session-a", "user-42:session-b"]);
    const bearer = String(
      (calls[0]![1]?.headers as Record<string, string>).authorization,
    ).replace("Bearer ", "");
    const claims = jwt.verify(bearer, config.apiSecret) as jwt.JwtPayload;
    expect(claims.iss).toBe(config.apiKey);
    expect(claims.video).toEqual({ room: "eclipse-voice-a", roomAdmin: true });
    expect(Number(claims.exp) - Number(claims.nbf)).toBe(60);
  });

  it("supports multiple revoked users and an older deterministic identity", async () => {
    const removed: string[] = [];
    const request = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input).endsWith("/ListParticipants")) {
        return Response.json({ participants: [
          { identity: "user-a" },
          { identity: "user-b:phone" },
          { identity: "user-c:web" },
        ] });
      }
      removed.push(JSON.parse(String(init?.body)).identity);
      return new Response("{}", { status: 200 });
    });
    await expect(
      removeLivekitUsersFromChannels(
        ["user-a", "user-b"],
        ["voice-a"],
        config,
        request as typeof fetch,
      ),
    ).resolves.toBe(2);
    expect(removed).toEqual(["user-a", "user-b:phone"]);
  });

  it("accepts absent rooms and fails closed on listing, payload, or removal errors", async () => {
    const absent = vi.fn(async () => new Response("not found", { status: 404 }));
    await expect(
      removeLivekitUsersFromChannels(["user-42"], ["voice-a"], config, absent as typeof fetch),
    ).resolves.toBe(0);

    const unavailable = vi.fn(async () => new Response("unavailable", { status: 503 }));
    await expect(
      removeLivekitUsersFromChannels(["user-42"], ["voice-a"], config, unavailable as typeof fetch),
    ).rejects.toThrow("LiveKit participant listing failed (503)");

    const malformed = vi.fn(async () => Response.json({ participants: "hidden" }));
    await expect(
      removeLivekitUsersFromChannels(["user-42"], ["voice-a"], config, malformed as typeof fetch),
    ).rejects.toThrow("invalid payload");

    const removeUnavailable = vi.fn(async (input: URL | RequestInfo) =>
      String(input).endsWith("/ListParticipants")
        ? Response.json({ participants: [{ identity: "user-42:web" }] })
        : new Response("unavailable", { status: 503 }),
    );
    await expect(
      removeLivekitUsersFromChannels(
        ["user-42"], ["voice-a"], config, removeUnavailable as typeof fetch,
      ),
    ).rejects.toThrow("LiveKit access revocation failed (503)");
  });

  it("deletes voice rooms idempotently for channel/server removal", async () => {
    const calls: Array<[URL | RequestInfo, RequestInit | undefined]> = [];
    const request = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response("not found", { status: 404 });
    });
    await expect(
      deleteLivekitRoomsForChannels(["voice-a", "voice-a", "voice-b"], config, request as typeof fetch),
    ).resolves.toBe(2);
    expect(calls).toHaveLength(2);
    expect(String(calls[0]![0])).toContain("/twirp/livekit.RoomService/DeleteRoom");
    expect(JSON.parse(String(calls[0]![1]?.body))).toEqual({ room: roomNameForChannel("voice-a") });
    const bearer = String(
      (calls[0]![1]?.headers as Record<string, string>).authorization,
    ).replace("Bearer ", "");
    const claims = jwt.verify(bearer, config.apiSecret) as jwt.JwtPayload;
    expect(claims.video).toEqual({ roomCreate: true });
  });

  it("does not call a network service when LiveKit is not configured", async () => {
    const request = vi.fn();
    await expect(
      removeLivekitUsersFromChannels(["user-42"], ["voice-a"], null, request as typeof fetch),
    ).resolves.toBe(0);
    await expect(
      deleteLivekitRoomsForChannels(["voice-a"], null, request as typeof fetch),
    ).resolves.toBe(0);
    expect(request).not.toHaveBeenCalled();
  });
});
