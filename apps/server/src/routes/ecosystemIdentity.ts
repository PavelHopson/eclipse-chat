import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  EcosystemIdentityError,
  EcosystemIdentityService,
} from "../security/ecosystemIdentity.js";

const authorizeBody = z.object({
  clientId: z.literal("eclipse-dnd-forge"),
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  codeChallengeMethod: z.literal("S256"),
  redirectUri: z.string().url().max(2048),
  responseType: z.literal("code"),
  state: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
}).strict();

const tokenBody = z.object({
  clientId: z.literal("eclipse-dnd-forge"),
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
      try {
        const issued = service.issueCode({
          clientId: parsed.data.clientId,
          codeChallenge: parsed.data.codeChallenge,
          displayName: user.displayName,
          redirectUri: parsed.data.redirectUri,
          subject: user.id,
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
        const token = service.exchangeCode(parsed.data);
        return reply.header("Cache-Control", "no-store").send(token);
      } catch (error) {
        return sendIdentityError(reply, error);
      }
    },
  );
}
