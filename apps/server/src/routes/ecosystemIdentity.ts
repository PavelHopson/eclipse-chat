import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { EcosystemSessionService } from "../security/ecosystemSessions.js";
import { isAuthProtocolV2Required } from "../auth/protocolGate.js";
import { disconnectSession } from "../realtime.js";
import {
  EcosystemIdentityError,
  EcosystemIdentityService,
} from "../security/ecosystemIdentity.js";

const authorizeBody = z.object({
  clientId: z.string().regex(/^eclipse-[a-z0-9-]{1,48}$/),
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  codeChallengeMethod: z.literal("S256"),
  redirectUri: z.string().url().max(2048),
  responseType: z.literal("code"),
  state: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
}).strict();

const tokenBody = z.object({
  clientId: z.string().regex(/^eclipse-[a-z0-9-]{1,48}$/),
  code: z.string().max(256),
  codeVerifier: z.string().max(128),
  grantType: z.literal("authorization_code"),
  redirectUri: z.string().url().max(2048),
}).strict();

function statusFor(error: EcosystemIdentityError): number {
  if (error.code === "identity_unavailable" || error.code === "temporarily_unavailable") return 503;
  if (error.code === "invalid_client") return 400;
  return 400;
}

function sendIdentityError(reply: FastifyReply, error: unknown) {
  if (error instanceof EcosystemIdentityError) {
    return reply.status(statusFor(error)).send({
      error: error.code,
      error_description: error.message,
    });
  }
  throw error;
}

export async function registerEcosystemIdentityRoutes(
  app: FastifyInstance,
  service = new EcosystemIdentityService(),
  sessions = new EcosystemSessionService(),
) {
  app.get("/api/ecosystem/.well-known/jwks.json", async (_req, reply) => {
    if (!service.enabled) {
      return reply.status(503).send({ error: "identity_unavailable" });
    }
    return reply
      .header("Cache-Control", "public, max-age=300, stale-while-revalidate=300")
      .send(service.jwks);
  });

  app.post(
    "/api/ecosystem/authorize",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 20, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const parsed = authorizeBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "invalid_request" });
      }
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "unauthorized" });
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, bannedAt: true, deletedAt: true },
      });
      if (!user || user.bannedAt || user.deletedAt) {
        return reply.status(403).send({ error: "account_unavailable" });
      }
      const sessionId = (req.user as { sid?: unknown })?.sid;
      if (service.allowsSessions(parsed.data.clientId)) {
        if (!isAuthProtocolV2Required()) return reply.status(503).send({ error: "session_enforcement_required" });
        if (typeof sessionId !== "string" || !sessionId) return reply.status(401).send({ error: "session_required" });
        const parent = await db.refreshToken.findFirst({ where: { id: sessionId, userId, expiresAt: { gt: new Date() } }, select: { id: true } });
        if (!parent) return reply.status(401).send({ error: "session_required" });
      }
      try {
        const issued = service.issueCode({
          clientId: parsed.data.clientId,
          codeChallenge: parsed.data.codeChallenge,
          displayName: user.displayName,
          redirectUri: parsed.data.redirectUri,
          subject: user.id,
          ...(typeof sessionId === "string" ? { sessionId } : {}),
        });
        const redirect = new URL(parsed.data.redirectUri);
        redirect.searchParams.set("code", issued.code);
        redirect.searchParams.set("state", parsed.data.state);
        app.log.info({ event: "ecosystem_identity_code_issued", clientId: parsed.data.clientId, userId });
        return reply.header("Cache-Control", "no-store").send({
          redirectTo: redirect.toString(),
          expiresIn: issued.expiresIn,
        });
      } catch (error) {
        return sendIdentityError(reply, error);
      }
    },
  );

  app.post(
    "/api/ecosystem/token",
    { config: { rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 } } },
    async (req, reply) => {
      const parsed = tokenBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "invalid_request" });
      }
      try {
        if (service.allowsSessions(parsed.data.clientId) && !isAuthProtocolV2Required()) return reply.status(503).send({ error: "session_enforcement_required" });
        const redeemed = service.redeemCode(parsed.data);
        const sessionGrant = redeemed.session ? await sessions.issue(redeemed.session) : undefined;
        if (redeemed.session && !sessionGrant) return reply.status(401).header("Cache-Control", "no-store").send({ error: "session_unavailable" });
        return reply.header("Cache-Control", "no-store").send({ ...redeemed.token, ...(sessionGrant ? { sessionGrant } : {}) });
      } catch (error) {
        return sendIdentityError(reply, error);
      }
    },
  );
  const sessionBody = z.object({ clientId: z.string().regex(/^eclipse-[a-z0-9-]{1,48}$/), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
  for (const action of ["inspect", "revoke"] as const) {
    app.post(`/api/ecosystem/session/${action}`, { config: { rateLimit: { max: 600, timeWindow: 60_000 } } }, async (req, reply) => {
      reply.header("Cache-Control", "no-store");
      const input = sessionBody.safeParse(req.body);
      if (!input.success) return reply.status(400).send({ error: "invalid_request" });
      if (!service.enabled || !service.allowsSessions(input.data.clientId) || !isAuthProtocolV2Required()) return reply.status(503).send({ error: "identity_unavailable" });
      try {
        if (action === "inspect") return reply.send(await sessions.inspect(input.data.clientId, input.data.token));
        const sessionId = await sessions.revoke(input.data.clientId, input.data.token);
        if (sessionId) disconnectSession(sessionId);
        return reply.send({ ok: true });
      } catch {
        return reply.status(503).send({ error: "identity_unavailable" });
      }
    });
  }

}
