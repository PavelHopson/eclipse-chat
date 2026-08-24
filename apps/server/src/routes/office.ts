import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { hasPermission } from "../lib/permissions.js";
import { recordAudit } from "../security/audit.js";
import {
  OFFICE_EVENT_SCHEMA_VERSION,
  officeEventInputSchema,
} from "../office/contracts.js";
import {
  DurableOfficeEventError,
  durableOfficeEventRepository,
  type DurableOfficeEventRepository,
} from "../office/durableEventStore.js";
import {
  OFFICE_INGEST_SCHEMA_VERSION,
  OfficeIngestAuthError,
  loadOfficeIngestRegistry,
  verifyOfficeIngestAuthentication,
  type OfficeIngestHeaders,
  type OfficeIngestRegistry,
} from "../office/ingestAuth.js";
import {
  getOfficeJournalStatus,
  redriveOfficeEventOutboxDeadLetters,
  type OfficeJournalStatus,
} from "../office/outbox.js";
import type { MemberRole } from "./servers.js";

const READ_RATE_LIMIT = { max: 120, timeWindow: 60 * 1000 };
const INGEST_RATE_LIMIT = { max: 60, timeWindow: 60 * 1000 };
const REDRIVE_RATE_LIMIT = { max: 5, timeWindow: 15 * 60 * 1000 };
const INGEST_BODY_LIMIT_BYTES = 64 * 1024;

const querySchema = z.object({
  after: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

const redriveBodySchema = z.object({
  humanConfirmed: z.literal(true),
  reason: z.string().trim().min(3).max(500).refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Управляющие символы запрещены",
  ),
  limit: z.number().int().min(1).max(50).optional(),
}).strict();

const ingestEnvelopeSchema = z.object({
  schemaVersion: z.literal(OFFICE_INGEST_SCHEMA_VERSION),
  events: z.array(officeEventInputSchema).min(1).max(50),
}).strict();

type OfficeRouteRepository = Pick<DurableOfficeEventRepository, "appendBatch" | "list" | "currentCursor">;

export type OfficeRouteDependencies = {
  repository?: OfficeRouteRepository;
  registry?: OfficeIngestRegistry;
  loadRegistry?: () => OfficeIngestRegistry;
  now?: () => number;
  status?: (workspaceId: string) => Promise<OfficeJournalStatus>;
  redrive?: (workspaceId: string, options: { actorUserId: string; reason: string; limit?: number }) => Promise<number>;
};

function authHeaders(headers: Record<string, unknown>): OfficeIngestHeaders {
  return {
    "x-office-key-id": headers["x-office-key-id"] as string | string[] | undefined,
    "x-office-timestamp": headers["x-office-timestamp"] as string | string[] | undefined,
    "x-office-nonce": headers["x-office-nonce"] as string | string[] | undefined,
    "x-office-signature": headers["x-office-signature"] as string | string[] | undefined,
  };
}

function mapAuthError(reply: {
  status: (code: number) => { send: (payload: unknown) => unknown };
}, error: OfficeIngestAuthError) {
  if (error.code === "config_unavailable") {
    return reply.status(503).send({ error: "Office ingest unavailable", code: "office_ingest_unavailable" });
  }
  if (error.code === "workspace_denied") return reply.status(401).send({ error: "Office ingest authentication failed", code: "office_ingest_unauthorized" });
  if (error.code === "invalid_payload") {
    return reply.status(400).send({ error: "Invalid Office ingest payload", code: "invalid_payload" });
  }
  return reply.status(401).send({ error: "Office ingest authentication failed", code: "office_ingest_unauthorized" });
}

export function registerOfficeRoutes(app: FastifyInstance, dependencies: OfficeRouteDependencies = {}) {
  const repository = dependencies.repository ?? durableOfficeEventRepository;
  const now = dependencies.now ?? Date.now;
  const registryLoader = dependencies.loadRegistry ?? (() => dependencies.registry ?? loadOfficeIngestRegistry());
  const statusReader = dependencies.status ?? getOfficeJournalStatus;
  const redrive = dependencies.redrive ?? redriveOfficeEventOutboxDeadLetters;

  app.get(
    "/api/servers/:id/office/events",
    { onRequest: [requireJwt], config: { rateLimit: READ_RATE_LIMIT } },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const membership = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true },
      });
      if (!membership) return reply.status(403).send({ error: "Not a member" });

      const query = querySchema.safeParse(req.query);
      if (!query.success) return reply.status(400).send({ error: "Некорректный cursor Office Event Bus" });

      // Read the append-only journal tail before the page. If an event commits
      // between these reads, the page either contains it or the returned cursor
      // remains behind it, so a client can never advance past an unseen event.
      const snapshotCursor = await repository.currentCursor(serverId);
      const events = await repository.list(serverId, query.data);
      return {
        schemaVersion: OFFICE_EVENT_SCHEMA_VERSION,
        source: "office-core-runtime",
        events,
        cursor: events.at(-1)?.sequence ?? snapshotCursor,
      };
    },
  );

  app.get(
    "/api/servers/:id/office/status",
    { onRequest: [requireJwt], config: { rateLimit: READ_RATE_LIMIT } },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const membership = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true },
      });
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      return statusReader(serverId);
    },
  );

  app.post(
    "/api/servers/:id/office/outbox/redrive",
    { onRequest: [requireJwt], config: { rateLimit: REDRIVE_RATE_LIMIT } },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const membership = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Недостаточно прав для восстановления Office outbox" });
      }
      const body = redriveBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Требуется явное подтверждение восстановления Office outbox" });
      }
      const redriven = await redrive(serverId, { actorUserId: userId, reason: body.data.reason, limit: body.data.limit });
      recordAudit("OFFICE_OUTBOX_REDRIVEN", {
        userId,
        req,
        metadata: { serverId, redriven },
      });
      return { redriven };
    },
  );
  app.post(
    "/api/servers/:id/office/events/ingest",
    {
      bodyLimit: INGEST_BODY_LIMIT_BYTES,
      config: { rateLimit: INGEST_RATE_LIMIT },
    },
    async (req, reply) => {
      const { id: workspaceId } = req.params as { id: string };

      let registry: OfficeIngestRegistry;
      try {
        registry = registryLoader();
      } catch (error) {
        if (error instanceof OfficeIngestAuthError) return mapAuthError(reply, error);
        throw error;
      }
      if (registry.size === 0) {
        return reply.status(503).send({ error: "Office ingest unavailable", code: "office_ingest_unavailable" });
      }

      let authentication;
      try {
        authentication = verifyOfficeIngestAuthentication({
          headers: authHeaders(req.headers as Record<string, unknown>),
          workspaceId,
          body: req.body,
          registry,
          now: now(),
        });
      } catch (error) {
        if (error instanceof OfficeIngestAuthError) return mapAuthError(reply, error);
        throw error;
      }

      const envelope = ingestEnvelopeSchema.safeParse(req.body);
      if (!envelope.success) {
        return reply.status(400).send({ error: "Invalid Office ingest envelope", code: "invalid_envelope" });
      }
      if (envelope.data.events.some((event) => event.workspaceId !== workspaceId)) {
        return reply.status(400).send({ error: "Every Office event must match the workspace", code: "workspace_mismatch" });
      }

      try {
        const result = await repository.appendBatch({
          workspaceId,
          producerId: authentication.producerId,
          inputs: envelope.data.events,
          replay: {
            keyId: authentication.keyId,
            nonce: authentication.nonce,
            requestDigest: authentication.requestDigest,
            expiresAt: authentication.expiresAt,
          },
          now: new Date(now()),
        });
        return {
          schemaVersion: OFFICE_EVENT_SCHEMA_VERSION,
          source: "office-core-runtime",
          events: result.events,
          cursor: result.events.at(-1)?.sequence ?? 0,
        };
      } catch (error) {
        if (error instanceof DurableOfficeEventError) {
          if (error.code === "invalid_batch") {
            return reply.status(400).send({ error: "Invalid Office event batch", code: "invalid_batch" });
          }
          if (error.code === "replay_conflict") {
            return reply.status(409).send({ error: "Office ingest replay conflict", code: "replay_conflict" });
          }
        }
        throw error;
      }
    },
  );
}
