/**
 * LiveKit access-token generation.
 *
 * Эквивалент `livekit-server-sdk` `AccessToken.toJwt()` — реализован
 * вручную через `jsonwebtoken` (уже в deps). Не требует extra пакета,
 * полный контроль над claims structure.
 *
 * LiveKit JWT format:
 *   iss   — API key id  (LIVEKIT_API_KEY)
 *   sub   — identity (наш userId)
 *   nbf   — not before (now)
 *   exp   — expiration (now + 6 hours по умолчанию)
 *   name  — display name (опционально, показывается LiveKit'у)
 *   video — VideoGrant: { room, roomJoin: true, canPublish, canSubscribe }
 *
 * Подписывается HMAC-SHA256 на LIVEKIT_API_SECRET. Frontend передаёт
 * этот JWT в Room.connect(url, token).
 */

import { createHash, timingSafeEqual } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";

export type LivekitGrant = {
  identity: string;
  name?: string;
  metadata?: string;
  room: string;
  /** TTL в секундах. Default — 6 часов (LiveKit рекомендация). */
  ttlSeconds?: number;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
};

export type LivekitConfig = {
  apiKey: string;
  apiSecret: string;
  /** WebSocket URL клиенту, обычно `wss://app.star-crm.ru/eclipse-chat/livekit` */
  wsUrl: string;
};

export function getLivekitConfig(): LivekitConfig | null {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_WS_URL;
  if (!apiKey || !apiSecret || !wsUrl) return null;
  return { apiKey, apiSecret, wsUrl };
}

export function generateLivekitToken(grant: LivekitGrant, cfg: LivekitConfig): string {
  const ttl = grant.ttlSeconds ?? 6 * 60 * 60; // 6 часов
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: cfg.apiKey,
    sub: grant.identity,
    nbf: now,
    exp: now + ttl,
    name: grant.name,
    metadata: grant.metadata,
    video: {
      room: grant.room,
      roomJoin: true,
      canPublish: grant.canPublish ?? true,
      canSubscribe: grant.canSubscribe ?? true,
      canPublishData: grant.canPublishData ?? true,
    },
  };
  return jwt.sign(payload, cfg.apiSecret, { algorithm: "HS256" });
}

/**
 * Имя LiveKit room — `eclipse-${channelId}`. Каждый voice channel = одна
 * room, никакого pre-creation: LiveKit auto-create при первом join.
 */
export function roomNameForChannel(channelId: string): string {
  return `eclipse-${channelId}`;
}

function livekitHttpBase(wsUrl: string): URL {
  const target = new URL(wsUrl);
  if (target.protocol === "wss:") target.protocol = "https:";
  else if (target.protocol === "ws:") target.protocol = "http:";
  else if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new Error("Unsupported LiveKit URL protocol");
  }
  target.pathname = `${target.pathname.replace(/\/$/, "")}/`;
  target.search = "";
  target.hash = "";
  return target;
}

function generateLivekitRoomAdminToken(room: string, cfg: LivekitConfig): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: cfg.apiKey,
      nbf: now,
      exp: now + 60,
      video: { room, roomAdmin: true },
    },
    cfg.apiSecret,
    { algorithm: "HS256" },
  );
}

function generateLivekitRoomCreateToken(cfg: LivekitConfig): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: cfg.apiKey,
      nbf: now,
      exp: now + 60,
      video: { roomCreate: true },
    },
    cfg.apiSecret,
    { algorithm: "HS256" },
  );
}

type LivekitParticipantInfo = { identity: string };

export type LivekitWebhookEvent = {
  event: string;
  id?: string;
  room?: { name?: string };
  participant?: { identity?: string; metadata?: string };
};

function equalText(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Protocol-compatible equivalent of LiveKit WebhookReceiver.receive().
 * LiveKit signs a short-lived HS256 JWT whose `sha256` claim is the standard
 * base64 SHA-256 digest of the exact request body. The issuer is the configured
 * API key. Never parse or act on the body before these checks succeed.
 */
export function verifyLivekitWebhook(
  rawBody: string,
  authorization: string,
  cfg: LivekitConfig,
): LivekitWebhookEvent {
  if (!rawBody || !authorization) throw new Error("Invalid LiveKit webhook");
  const claims = jwt.verify(authorization, cfg.apiSecret, {
    algorithms: ["HS256"],
    issuer: cfg.apiKey,
    clockTolerance: 10,
  }) as JwtPayload;
  if (
    typeof claims !== "object" ||
    typeof claims.exp !== "number" ||
    typeof claims.nbf !== "number" ||
    typeof claims.sha256 !== "string"
  ) {
    throw new Error("Invalid LiveKit webhook claims");
  }
  const digest = createHash("sha256").update(rawBody, "utf8").digest("base64");
  if (!equalText(claims.sha256, digest)) {
    throw new Error("Invalid LiveKit webhook digest");
  }
  const parsed: unknown = JSON.parse(rawBody);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid LiveKit webhook payload");
  }
  return parsed as LivekitWebhookEvent;
}

export function channelIdFromLivekitRoom(room: string): string | null {
  if (!room.startsWith("eclipse-")) return null;
  const channelId = room.slice("eclipse-".length);
  return /^[A-Za-z0-9_-]{1,128}$/.test(channelId) ? channelId : null;
}

export function userIdFromLivekitIdentity(identity: string): string | null {
  const match = /^([^:]{1,128}):([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(identity);
  return match?.[1] ?? null;
}

function matchesLivekitUser(identity: string, userIds: readonly string[]): boolean {
  return userIds.some(userId => identity === userId || identity.startsWith(`${userId}:`));
}

async function livekitRoomRequest(
  endpoint: URL,
  room: string,
  body: Record<string, string>,
  cfg: LivekitConfig,
  request: typeof fetch,
  permission: "roomAdmin" | "roomCreate" = "roomAdmin",
): Promise<Response> {
  return request(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${
        permission === "roomCreate"
          ? generateLivekitRoomCreateToken(cfg)
          : generateLivekitRoomAdminToken(room, cfg)
      }`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3_000),
  });
}

export async function removeLivekitParticipant(
  room: string,
  identity: string,
  cfg: LivekitConfig | null = getLivekitConfig(),
  request: typeof fetch = fetch,
): Promise<boolean> {
  if (!cfg) throw new Error("LiveKit is not configured");
  if (!room || room.length > 256 || !identity || identity.length > 256) {
    throw new Error("Invalid LiveKit participant coordinates");
  }
  const endpoint = new URL(
    "twirp/livekit.RoomService/RemoveParticipant",
    livekitHttpBase(cfg.wsUrl),
  );
  const response = await livekitRoomRequest(
    endpoint,
    room,
    { room, identity },
    cfg,
    request,
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`LiveKit access revocation failed (${response.status})`);
  }
  return true;
}

export async function removeLivekitUsersFromChannels(
  userIds: Iterable<string>,
  channelIds: Iterable<string>,
  cfg: LivekitConfig | null = getLivekitConfig(),
  request: typeof fetch = fetch,
): Promise<number> {
  if (!cfg) return 0;
  const users = [...new Set(userIds)];
  const ids = [...new Set(channelIds)];
  if (users.length === 0 || ids.length === 0) return 0;
  const listEndpoint = new URL(
    "twirp/livekit.RoomService/ListParticipants",
    livekitHttpBase(cfg.wsUrl),
  );
  const removeEndpoint = new URL(
    "twirp/livekit.RoomService/RemoveParticipant",
    livekitHttpBase(cfg.wsUrl),
  );
  let removed = 0;
  for (const channelId of ids) {
    const room = roomNameForChannel(channelId);
    const listed = await livekitRoomRequest(listEndpoint, room, { room }, cfg, request);
    if (listed.status === 404) continue;
    if (!listed.ok) {
      throw new Error(`LiveKit participant listing failed (${listed.status})`);
    }
    let payload: unknown;
    try {
      payload = await listed.json();
    } catch {
      throw new Error("LiveKit participant listing returned invalid JSON");
    }
    const rawParticipants =
      payload && typeof payload === "object"
        ? (payload as { participants?: unknown }).participants
        : undefined;
    if (rawParticipants !== undefined && !Array.isArray(rawParticipants)) {
      throw new Error("LiveKit participant listing returned an invalid payload");
    }
    const participants = (rawParticipants ?? []) as unknown[];
    for (const candidate of participants) {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        typeof (candidate as Partial<LivekitParticipantInfo>).identity !== "string"
      ) {
        throw new Error("LiveKit participant listing returned an invalid identity");
      }
      const identity = (candidate as LivekitParticipantInfo).identity;
      if (!matchesLivekitUser(identity, users)) continue;
      const response = await livekitRoomRequest(
        removeEndpoint,
        room,
        { room, identity },
        cfg,
        request,
      );
      if (!response.ok && response.status !== 404) {
        throw new Error(`LiveKit access revocation failed (${response.status})`);
      }
      removed += 1;
    }
  }
  return removed;
}

export async function deleteLivekitRoomsForChannels(
  channelIds: Iterable<string>,
  cfg: LivekitConfig | null = getLivekitConfig(),
  request: typeof fetch = fetch,
): Promise<number> {
  if (!cfg) return 0;
  const ids = [...new Set(channelIds)];
  if (ids.length === 0) return 0;
  const endpoint = new URL(
    "twirp/livekit.RoomService/DeleteRoom",
    livekitHttpBase(cfg.wsUrl),
  );
  for (const channelId of ids) {
    const room = roomNameForChannel(channelId);
    const response = await livekitRoomRequest(
      endpoint,
      room,
      { room },
      cfg,
      request,
      "roomCreate",
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`LiveKit room deletion failed (${response.status})`);
    }
  }
  return ids.length;
}
