import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { InMemoryPairingStore, maskPairingHandle, PairingError, type PairingErrorCode } from "../auth/pairing.js";

const targetKeySchema = z.string().trim().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/, "Некорректный ephemeral key");
const challengeBody = z.object({ targetKey: targetKeySchema }).strict();
const approveBody = z.object({ code: z.string().regex(/^\d{6}$/, "Код должен содержать 6 цифр") }).strict();
const exchangeBody = z.object({ targetKey: targetKeySchema }).strict();
const challengeRouteConfig = { config: { rateLimit: { max: 10, timeWindow: 60_000 } }, logLevel: "silent" as const };
const approveRouteConfig = { onRequest: [requireJwt], config: { rateLimit: { max: 20, timeWindow: 60_000 } }, logLevel: "silent" as const };
const exchangeRouteConfig = { config: { rateLimit: { max: 20, timeWindow: 60_000 } }, logLevel: "silent" as const };
const revokeRouteConfig = { onRequest: [requireJwt], config: { rateLimit: { max: 30, timeWindow: 60_000 } }, logLevel: "silent" as const };

type HandleParams = { handle: string };

/**
 * Test-only QR pairing contract. It deliberately stops before auth-session
 * issuance: a production implementation must add durable storage, signature
 * verification and an explicit session-transfer policy first.
 */
export async function registerAuthPairingRoutes(
  app: FastifyInstance,
  options: { store?: InMemoryPairingStore } = {},
): Promise<void> {
  const store = options.store ?? new InMemoryPairingStore();

  app.post("/api/auth/pairing/challenge", challengeRouteConfig, async (req, reply) => {
    const parsed = challengeBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });
    try {
      const created = store.create(parsed.data.targetKey, req.ip);
      reply.header("cache-control", "no-store");
      // The six-digit code is for UI confirmation only. No QR/URL payload is
      // generated here, and no access/refresh credential is returned.
      logPairingEvent(app, "challenge", created.handle, "created");
      return { challengeHandle: created.handle, confirmationCode: created.code, expiresAt: created.expiresAt };
    } catch (error) {
      logPairingEvent(app, "challenge", null, error instanceof PairingError ? error.code : "unavailable");
      return sendPairingError(reply, error);
    }
  });

  app.post("/api/auth/pairing/:handle/approve", approveRouteConfig, async (req, reply) => {
    const parsed = approveBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    const { handle } = req.params as HandleParams;
    try {
      store.approve(handle, parsed.data.code, userId);
      reply.header("cache-control", "no-store");
      logPairingEvent(app, "approve", handle, "approved");
      return { ok: true, status: "approved" as const };
    } catch (error) {
      logPairingEvent(app, "approve", handle, error instanceof PairingError ? error.code : "unavailable");
      return sendPairingError(reply, error);
    }
  });

  app.post("/api/auth/pairing/:handle/exchange", exchangeRouteConfig, async (req, reply) => {
    const parsed = exchangeBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });
    const { handle } = req.params as HandleParams;
    try {
      const result = store.exchange(handle, parsed.data.targetKey);
      reply.header("cache-control", "no-store");
      // This is intentionally not a JWT/session response. The target device
      // only receives a contract acknowledgement until auth issuance is wired.
      logPairingEvent(app, "exchange", handle, "exchanged");
      return result;
    } catch (error) {
      logPairingEvent(app, "exchange", handle, error instanceof PairingError ? error.code : "unavailable");
      return sendPairingError(reply, error);
    }
  });

  app.post("/api/auth/pairing/:handle/revoke", revokeRouteConfig, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    const { handle } = req.params as HandleParams;
    try {
      store.revoke(handle, userId);
      reply.header("cache-control", "no-store");
      logPairingEvent(app, "revoke", handle, "revoked");
      return { ok: true, status: "revoked" as const };
    } catch (error) {
      logPairingEvent(app, "revoke", handle, error instanceof PairingError ? error.code : "unavailable");
      return sendPairingError(reply, error);
    }
  });
}

function logPairingEvent(app: FastifyInstance, operation: string, handle: string | null, outcome: string): void {
  // Pairing routes opt out of Fastify's default request log because it includes
  // the opaque handle in the URL. Keep correlation without retaining the secret.
  app.log.info({ event: "auth_pairing", operation, pairingHandle: handle ? maskPairingHandle(handle) : null, outcome }, "auth pairing");
}

function sendPairingError(reply: FastifyReply, error: unknown) {
  const code = error instanceof PairingError ? error.code : null;
  if (!code) return reply.status(500).send({ error: "Pairing unavailable" });
  const status = statusFor(code);
  const message = code === "rate_limited" ? "Слишком много попыток" : code === "not_approved" ? "Подтверждение ещё не выполнено" : code === "target_mismatch" ? "Устройство не совпадает" : code === "invalid_code" ? "Неверный код" : code === "not_approver" ? "Нет права отменить это подключение" : "Подключение недоступно";
  return reply.status(status).send({ error: message });
}

function statusFor(code: PairingErrorCode): number {
  if (code === "not_found") return 404;
  if (code === "expired" || code === "revoked") return 410;
  if (code === "consumed" || code === "not_approved") return 409;
  if (code === "rate_limited") return 429;
  if (code === "not_approver") return 403;
  return 400;
}
