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

import jwt from "jsonwebtoken";

export type LivekitGrant = {
  identity: string;
  name?: string;
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
