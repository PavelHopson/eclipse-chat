import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db.js";
import { isAuthProtocolV2Required } from "./protocolGate.js";

const TTL_SECONDS = 15 * 60;
const SELECTOR_RE = /^[A-Za-z0-9_-]{22}$/;

// HKDF domain separation makes media tokens unusable as access JWTs and vice versa.
function key(purpose: string): Buffer {
  const secret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-insecure-eclipse-chat");
  if (!secret) throw new Error("JWT_SECRET is required");
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret), Buffer.from("eclipse-chat-media-v1"), Buffer.from(purpose), 32));
}
function signature(value: string): Buffer { return createHmac("sha256", key("media-signature")).update(value).digest(); }
function selectorFor(sessionId: string, tokenHash: string, authProtocol2 = false): string {
  const mac = createHmac("sha256", key("media-selector")).update(sessionId).update("\0").update(tokenHash);
  // Preserve the legacy selector exactly; v2 uses a separate cookie namespace.
  if (authProtocol2) mac.update("\0attachment-protocol-v2");
  return mac.digest().subarray(0, 16).toString("base64url");
}
function tokenGeneration(tokenHash: string): string {
  return createHmac("sha256", key("media-generation")).update(tokenHash).digest().subarray(0, 16).toString("base64url");
}
function cookieName(selector: string): string {
  return `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}ec-media-${selector}`;
}
function cookieAttributes(maxAge: number): string {
  const path = process.env.MEDIA_COOKIE_PATH ?? (process.env.NODE_ENV === "production" ? "/eclipse-chat/api/attachments/" : "/api/attachments/");
  // Never send media credentials to unrelated applications sharing this host.
  if (!/^(?:\/[A-Za-z0-9_-]+)*\/api\/attachments\/$/.test(path)) throw new Error("Invalid MEDIA_COOKIE_PATH");
  return `Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
/** Validate security configuration at startup, before auth mutates sessions. */
export function assertMediaSessionConfig(): void {
  cookieAttributes(0);
  key("media-signature");
  key("media-selector");
  key("media-generation");
}
function addCookie(reply: FastifyReply, value: string): void {
  reply.header("Set-Cookie", value); // Fastify appends repeated Set-Cookie headers.
  reply.header("Cache-Control", "private, no-store");
}

/** Non-secret selector: the cookie remains the authorization credential. */
export function setMediaSessionCookie(reply: FastifyReply, sessionId: string, userId: string, refreshTokenHash: string, authProtocol2 = false): string {
  const selector = selectorFor(sessionId, refreshTokenHash, authProtocol2);
  const payload = Buffer.from(JSON.stringify({ purpose: "attachment-media-v1", sid: sessionId, sub: userId, gen: tokenGeneration(refreshTokenHash), exp: Math.floor(Date.now() / 1000) + TTL_SECONDS, ...(authProtocol2 ? { authProtocol: 2 } : {}) })).toString("base64url");
  const token = `${payload}.${signature(payload).toString("base64url")}`;
  addCookie(reply, `${cookieName(selector)}=${token}; ${cookieAttributes(TTL_SECONDS)}`);
  return selector;
}
export function clearMediaSessionCookie(reply: FastifyReply, sessionId: string, tokenHash: string): void {
  // Clear both namespaces: the old cookie is not sent to /api/auth/refresh.
  addCookie(reply, `${cookieName(selectorFor(sessionId, tokenHash))}=; ${cookieAttributes(0)}`);
  addCookie(reply, `${cookieName(selectorFor(sessionId, tokenHash, true))}=; ${cookieAttributes(0)}`);
}

/** Checks purpose, signature, expiry, selector, live refresh row and user status. */
export async function validateMediaSession(rawCookies: string | undefined, selector: string): Promise<{ userId: string; sessionId: string } | null> {
  if (!rawCookies || !SELECTOR_RE.test(selector)) return null;
  const name = cookieName(selector);
  const matches = rawCookies.split(";").map((p) => p.trim()).filter((p) => p.startsWith(`${name}=`));
  if (matches.length !== 1) return null; // Never pick between duplicate cookies.
  const token = matches[0].slice(name.length + 1);
  if (token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const supplied = Buffer.from(parts[1], "base64url");
  const expected = signature(parts[0]);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  let payload: unknown;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch { return null; }
  if (!payload || typeof payload !== "object") return null;
  const claim = payload as Record<string, unknown>;
  // The signed cookie must itself carry the negotiated protocol; a header is not proof.
  if (isAuthProtocolV2Required() && claim.authProtocol !== 2) return null;
  if (claim.purpose !== "attachment-media-v1" || typeof claim.sid !== "string" || typeof claim.sub !== "string" ||
      typeof claim.exp !== "number" || !Number.isSafeInteger(claim.exp) || claim.exp <= Math.floor(Date.now() / 1000) ||
      typeof claim.gen !== "string") return null;
  const session = await db.refreshToken.findUnique({
    where: { id: claim.sid },
    select: { id: true, userId: true, tokenHash: true, expiresAt: true, user: { select: { bannedAt: true, deletedAt: true } } },
  });
  if (!session || session.userId !== claim.sub || tokenGeneration(session.tokenHash) !== claim.gen || session.expiresAt.getTime() <= Date.now() || !session.user || session.user.bannedAt || session.user.deletedAt) return null;
  // Previously issued signed v2 cookies used the legacy selector. Accept them
  // until expiry; new v2 cookies use the distinct selector above.
  const legacySelector = selectorFor(claim.sid as string, session.tokenHash);
  const selectorMatches = selector === legacySelector ||
    (claim.authProtocol === 2 && selector === selectorFor(claim.sid as string, session.tokenHash, true));
  if (!selectorMatches) return null;
  return { userId: session.userId, sessionId: session.id };
}

/** Bootstrap is only allowed from the configured app origin. */
export function isAllowedMediaBootstrapOrigin(req: FastifyRequest): boolean {
  const origin = req.headers.origin;
  if (!origin || origin === "null") return false;
  const allowed = process.env.PUBLIC_WEB_ORIGIN ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
  try { return new URL(allowed).origin === origin && new URL(origin).origin === origin; } catch { return false; }
}
