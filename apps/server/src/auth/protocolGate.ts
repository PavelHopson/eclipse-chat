import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db.js";

export type ProtocolGateResult = "ok" | "client_update_required" | "unauthorized" | "unavailable";

/** Reject configuration typos at startup instead of silently disabling the gate. */
export function assertAuthProtocolConfig(): void {
  const value = process.env.AUTH_PROTOCOL_V2_REQUIRED;
  if (value !== undefined && value !== "true" && value !== "false") {
    throw new Error("Invalid AUTH_PROTOCOL_V2_REQUIRED: expected true or false");
  }
}

/** Compatibility gate; only the exact explicit setting enables enforcement. */
export function isAuthProtocolV2Required(): boolean {
  return process.env.AUTH_PROTOCOL_V2_REQUIRED === "true";
}

/** The marker selects a protocol version; it is not authentication. */
export function isAuthProtocolV2Request(req: FastifyRequest): boolean {
  return req.headers["x-eclipse-auth-protocol"] === "2";
}

export function requireAuthProtocolMarker(req: FastifyRequest, reply: FastifyReply): boolean {
  if (isAuthProtocolV2Required() && !isAuthProtocolV2Request(req)) {
    reply.status(426).send({ code: "CLIENT_UPDATE_REQUIRED", error: "Обновите приложение и повторите вход." });
    return false;
  }
  return true;
}

/** Call only after verifying JWT signature and expiry with the JWT library. */
export async function verifySessionClaims(payload: unknown): Promise<ProtocolGateResult> {
  if (!isAuthProtocolV2Required()) return "ok";
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "unauthorized";
  const claim = payload as Record<string, unknown>;
  if (claim.authProtocol !== 2) return "client_update_required";
  if (typeof claim.sub !== "string" || !claim.sub || typeof claim.sid !== "string" || !claim.sid ||
      typeof claim.exp !== "number" || !Number.isFinite(claim.exp) || claim.exp <= Date.now() / 1000) return "unauthorized";
  try {
    const session = await db.refreshToken.findUnique({ where: { id: claim.sid }, select: {
      userId: true, expiresAt: true, user: { select: { bannedAt: true, deletedAt: true } },
    } });
    if (!session || session.userId !== claim.sub || session.expiresAt <= new Date() ||
        !session.user || session.user.bannedAt || session.user.deletedAt) return "unauthorized";
    return "ok";
  } catch {
    return "unavailable";
  }
}

export async function verifyRequestJwt(req: FastifyRequest): Promise<ProtocolGateResult> {
  try { await req.jwtVerify(); } catch { return "unauthorized"; }
  return verifySessionClaims(req.user);
}

export function sendProtocolGateError(reply: FastifyReply, result: Exclude<ProtocolGateResult, "ok">, req?: FastifyRequest) {
  if (result === "client_update_required") {
    const code = req && isAuthProtocolV2Request(req) ? "SESSION_UPGRADE_REQUIRED" : "CLIENT_UPDATE_REQUIRED";
    return reply.status(426).send({ code, error: code === "SESSION_UPGRADE_REQUIRED" ? "Требуется обновить сеанс." : "Обновите приложение и повторите вход." });
  }
  if (result === "unavailable") return reply.status(503).send({ code: "AUTH_UNAVAILABLE", error: "Проверка сессии временно недоступна." });
  if (!isAuthProtocolV2Required()) return reply.status(401).send({ error: "Unauthorized" });
  return reply.status(401).send({ code: "REAUTH_REQUIRED", error: "Unauthorized" });
}
