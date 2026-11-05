import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { isAuthProtocolV2Required, verifySessionClaims } from "./protocolGate.js";

type JwtSub = { sub: string; email: string; sid?: string; iat?: number; exp?: number };
const authReady = new WeakMap<Socket, Promise<boolean>>();

function authError(code: string): Error {
  return Object.assign(new Error(code), { data: { code } });
}

/**
 * With the v2 gate enabled, every authenticated socket must have a supported
 * protocol and a currently valid session. Legacy behavior remains available
 * only while the gate is explicitly disabled.
 */
export function registerSocketAuth(io: Server, secret: string) {
  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (isAuthProtocolV2Required()) {
      if (typeof token !== "string" || !token) return next(authError("CLIENT_UPDATE_REQUIRED"));
      let payload: JwtSub;
      try {
        const verified = jwt.verify(token, secret);
        if (typeof verified === "string") return next(authError("UNAUTHORIZED"));
        payload = verified as JwtSub;
      } catch (error) {
        // jsonwebtoken verifies the signature before reporting expiry. Only
        // this distinct result permits a single client refresh attempt.
        return next(authError(error instanceof jwt.TokenExpiredError ? "TOKEN_EXPIRED" : "UNAUTHORIZED"));
      }
      try {
        const result = await verifySessionClaims(payload);
        if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
          return next(authError("TOKEN_EXPIRED"));
        }
        if (result !== "ok") {
          const modern = (socket.handshake.auth as { protocol?: unknown } | undefined)?.protocol === 2;
          return next(authError(result === "client_update_required" ? (modern ? "SESSION_UPGRADE_REQUIRED" : "CLIENT_UPDATE_REQUIRED") :
            result === "unavailable" ? "AUTH_UNAVAILABLE" : "UNAUTHORIZED"));
        }
        if (typeof payload.sub !== "string" || typeof payload.sid !== "string" ||
            typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
          return next(authError("UNAUTHORIZED"));
        }
        socket.data.userId = payload.sub;
        socket.data.sessionId = payload.sid;
        socket.data.sessionExpiresAt = payload.exp * 1000;
        // The ready check below runs after the socket has joined the session
        // room and before it may join user/server rooms or receive their data.
        socket.data.sessionClaims = payload;
        return next();
      } catch {
        return next(authError("AUTH_UNAVAILABLE"));
      }
    }

    if (typeof token !== "string" || !token) {
      socket.data.userId = null;
      return next();
    }
    try {
      const payload = jwt.verify(token, secret) as JwtSub;
      const userId = payload.sub ?? null;
      if (userId) {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { bannedAt: true, deletedAt: true },
        });
        if (user) {
          if (user.deletedAt !== null) return next(new Error("deleted"));
          if (user.bannedAt !== null) return next(new Error("banned"));
        }
      }
      socket.data.userId = userId;
    } catch {
      socket.data.userId = null;
    }
    return next();
  });

  io.on("connection", (socket) => {
    const claims = socket.data.sessionClaims as JwtSub | undefined;
    if (!claims || !socket.data.sessionId) return;
    const ready = (async () => {
      try {
        await socket.join([`auth:session:${socket.data.sessionId}`, `auth:user:${socket.data.userId}`]);
        const result = await verifySessionClaims(claims);
        if (claims.exp && claims.exp * 1000 <= Date.now() && socket.connected) {
          socket.emit("auth:expired");
          socket.disconnect(true);
          return false;
        }
        if (result !== "ok" || !claims.exp || !socket.connected) {
          socket.disconnect(true);
          return false;
        }
        return true;
      } catch {
        socket.disconnect(true);
        return false;
      }
    })();
    authReady.set(socket, ready);

    // Gate-on sockets must not outlive the access token. The client receives a
    // distinct event and may refresh the same session before reconnecting.
    const expiresAt = socket.data.sessionExpiresAt;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const stopExpired = () => {
      if (!socket.connected) return;
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        socket.emit("auth:expired");
        socket.disconnect(true);
      } else {
        expiryTimer = setTimeout(stopExpired, Math.min(remaining, 2_147_483_647));
      }
    };
    if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) stopExpired();
    socket.once("disconnect", () => { if (expiryTimer) clearTimeout(expiryTimer); });
  });
}

/** Await before exposing user-specific rooms or registering protected handlers. */
export function waitForSocketAuth(socket: Socket): Promise<boolean> | null {
  return authReady.get(socket) ?? null;
}