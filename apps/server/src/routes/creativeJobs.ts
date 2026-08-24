import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  creativeJobInputSchema,
  creativeJobPackage,
  createCreativeJob,
  decideCreativeJob,
  executeCreativePreview,
  MAX_PENDING_CREATIVE_JOBS_PER_OPERATOR,
  parseStoredCreativeJob,
  serializeCreativeJob,
} from "../lib/creativeJobContract.js";
import { hasPermission } from "../lib/permissions.js";
import { ensureServerActive } from "../lib/serverGating.js";
import {
  creativeApprovalRequestedInput,
  creativeApprovalResolvedInput,
  creativeDeliverableReadyInput,
  creativeTaskCreatedInput,
  creativeTaskStartedInput,
  enqueueCreativeEvent,
} from "../office/creativeEvents.js";
import { dispatchOfficeEventOutboxBestEffort } from "../office/outbox.js";
import { recordAudit } from "../security/audit.js";
import type { MemberRole } from "./servers.js";

const READ_RATE_LIMIT = { max: 60, timeWindow: 60 * 1000 };
const CREATE_RATE_LIMIT = { max: 12, timeWindow: 15 * 60 * 1000 };
const REVIEW_RATE_LIMIT = { max: 30, timeWindow: 5 * 60 * 1000 };
const EXECUTE_RATE_LIMIT = { max: 10, timeWindow: 15 * 60 * 1000 };
const BODY_LIMIT_BYTES = 64 * 1024;

const createBodySchema = z.object({ input: creativeJobInputSchema }).strict();
const executeBodySchema = z.object({ version: z.number().int().positive() }).strict();
const reviewBodySchema = z.object({
  version: z.number().int().positive(),
  decision: z.enum(["APPROVE", "REJECT"]),
  humanConfirmed: z.boolean().optional(),
  rightsConfirmed: z.boolean().optional(),
  costConfirmed: z.boolean().optional(),
  note: z.string().trim().max(1_000).refine(
    (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value),
    "Управляющие символы запрещены",
  ).optional(),
}).strict();

type CreativeJobRow = {
  id: string;
  sourceJobId: string;
  serverId: string;
  createdByUserId: string;
  schemaVersion: string;
  payload: string;
  payloadHash: string;
  idempotencyKey: string;
  lastExecutionKey: string | null;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

function idempotencyKey(value: string | string[] | undefined): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  if (!key || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{7,127}$/.test(key)) return null;
  return key;
}

function view(row: CreativeJobRow) {
  return {
    id: row.id,
    sourceJobId: row.sourceJobId,
    schemaVersion: row.schemaVersion,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    job: parseStoredCreativeJob(row.payload),
  };
}

function requestUserId(req: FastifyRequest): string | null {
  return getUserId(req);
}

async function membership(userId: string, serverId: string) {
  return db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
}

function context(serverId: string, row: CreativeJobRow) {
  const job = parseStoredCreativeJob(row.payload);
  return { workspaceId: serverId, jobId: row.id, title: job.input.title };
}

export function registerCreativeJobRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/creative-jobs",
    { onRequest: [requireJwt], config: { rateLimit: READ_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      if (!(await membership(userId, serverId))) return reply.status(403).send({ error: "Not a member" });
      const rows = await db.creativeJob.findMany({
        where: { serverId },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return {
        jobs: rows.map((row) => view(row)),
        policy: {
          maxPendingJobsPerOperator: MAX_PENDING_CREATIVE_JOBS_PER_OPERATOR,
          previewEnabled: true,
          higgsfield: {
            configured: false,
            mcpUrl: "https://mcp.higgsfield.ai/mcp",
            creditsAlwaysCharged: true,
            reason: "OAuth и закреплённое описание MCP-инструментов ещё не настроены на сервере.",
          },
          localSend: { automaticSelectionAllowed: false },
        },
      };
    },
  );

  app.post(
    "/api/servers/:id/creative-jobs",
    { onRequest: [requireJwt], bodyLimit: BODY_LIMIT_BYTES, config: { rateLimit: CREATE_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const member = await membership(userId, serverId);
      if (!member) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(member.role as MemberRole, "TASK_CREATE")) {
        return reply.status(403).send({ error: "Недостаточно прав для создания Creative-заданий" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const key = idempotencyKey(req.headers["idempotency-key"]);
      if (!key) return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" });
      const body = createBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Некорректное Creative-задание" });
      }
      const existing = await db.creativeJob.findUnique({
        where: { serverId_idempotencyKey: { serverId, idempotencyKey: key } },
      });
      if (existing) return { job: view(existing), idempotent: true };
      const pending = await db.creativeJob.count({
        where: { serverId, createdByUserId: userId, status: { in: ["awaiting_quote", "awaiting_approval", "approved"] } },
      });
      if (pending >= MAX_PENDING_CREATIVE_JOBS_PER_OPERATOR) {
        return reply.status(429).send({ error: "Сначала разберите текущую очередь Creative Studio" });
      }

      const job = createCreativeJob(body.data.input);
      const serialized = serializeCreativeJob(job);
      try {
        const result = await db.$transaction(async (tx) => {
          const created = await tx.creativeJob.create({
            data: {
              sourceJobId: job.id,
              serverId,
              createdByUserId: userId,
              schemaVersion: job.schemaVersion,
              status: job.status,
              ...serialized,
              idempotencyKey: key,
            },
          });
          const eventContext = context(serverId, created);
          const outboxIds = [await enqueueCreativeEvent(tx, creativeTaskCreatedInput(eventContext, job.input.providerMode))];
          if (job.quote.state === "quoted") {
            outboxIds.push(await enqueueCreativeEvent(tx, creativeApprovalRequestedInput(eventContext, job.quote.credits)));
          }
          return { created, outboxIds };
        });
        recordAudit("CREATIVE_JOB_CREATED", {
          userId,
          req,
          metadata: { serverId, creativeJobId: result.created.id, mode: job.input.providerMode, mediaType: job.input.mediaType },
        });
        await dispatchOfficeEventOutboxBestEffort({ ids: result.outboxIds });
        return reply.status(201).send({ job: view(result.created), idempotent: false });
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== "P2002") throw error;
        const raced = await db.creativeJob.findUnique({ where: { serverId_idempotencyKey: { serverId, idempotencyKey: key } } });
        if (!raced) throw error;
        return { job: view(raced), idempotent: true };
      }
    },
  );

  app.patch(
    "/api/servers/:id/creative-jobs/:jobId/review",
    { onRequest: [requireJwt], bodyLimit: BODY_LIMIT_BYTES, config: { rateLimit: REVIEW_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, jobId } = req.params as { id: string; jobId: string };
      const member = await membership(userId, serverId);
      if (!member) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(member.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Недостаточно прав для подтверждения Creative-заданий" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const body = reviewBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Некорректное решение" });
      const current = await db.creativeJob.findFirst({ where: { id: jobId, serverId } });
      if (!current) return reply.status(404).send({ error: "Creative-задание не найдено" });
      if (current.version !== body.data.version) return reply.status(409).send({ error: "Задание уже изменилось. Обновите список" });

      let decided;
      try { decided = decideCreativeJob(parseStoredCreativeJob(current.payload), body.data); }
      catch (error) { return reply.status(409).send({ error: error instanceof Error ? error.message : "Решение невозможно" }); }
      const serialized = serializeCreativeJob(decided);
      const nextStatus = decided.status;
      const result = await db.$transaction(async (tx) => {
        const changed = await tx.creativeJob.updateMany({
          where: { id: jobId, serverId, version: current.version, status: "awaiting_approval" },
          data: { ...serialized, status: nextStatus, version: { increment: 1 } },
        });
        if (changed.count !== 1) return null;
        return enqueueCreativeEvent(tx, creativeApprovalResolvedInput(
          context(serverId, current),
          body.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        ));
      });
      if (!result) return reply.status(409).send({ error: "Решение уже принято другим участником" });
      const updated = await db.creativeJob.findFirst({ where: { id: jobId, serverId } });
      if (!updated) return reply.status(404).send({ error: "Creative-задание не найдено" });
      recordAudit("CREATIVE_JOB_REVIEWED", {
        userId,
        req,
        metadata: { serverId, creativeJobId: jobId, decision: body.data.decision },
      });
      await dispatchOfficeEventOutboxBestEffort({ ids: [result] });
      return { job: view(updated) };
    },
  );

  app.post(
    "/api/servers/:id/creative-jobs/:jobId/execute",
    { onRequest: [requireJwt], bodyLimit: BODY_LIMIT_BYTES, config: { rateLimit: EXECUTE_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, jobId } = req.params as { id: string; jobId: string };
      const member = await membership(userId, serverId);
      if (!member) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(member.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Недостаточно прав для запуска Creative-заданий" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const body = executeBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: "Некорректная версия Creative-задания" });
      const key = idempotencyKey(req.headers["idempotency-key"]);
      if (!key) return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" });
      const current = await db.creativeJob.findFirst({ where: { id: jobId, serverId } });
      if (!current) return reply.status(404).send({ error: "Creative-задание не найдено" });
      if (current.lastExecutionKey === key && current.status === "ready") return { job: view(current), idempotent: true };
      if (current.version !== body.data.version) return reply.status(409).send({ error: "Задание уже изменилось. Обновите список" });
      const job = parseStoredCreativeJob(current.payload);
      if (job.input.providerMode === "higgsfield") {
        return reply.status(503).send({
          error: "Higgsfield ещё не подключён к серверному Tool Gateway. Платный вызов не выполнен.",
          code: "higgsfield_not_configured",
        });
      }

      let completed;
      try { completed = executeCreativePreview(job, randomUUID()); }
      catch (error) { return reply.status(409).send({ error: error instanceof Error ? error.message : "Запуск невозможен" }); }
      const serialized = serializeCreativeJob(completed);
      const result = await db.$transaction(async (tx) => {
        const changed = await tx.creativeJob.updateMany({
          where: { id: jobId, serverId, version: current.version, status: "approved" },
          data: { ...serialized, status: completed.status, lastExecutionKey: key, version: { increment: 1 } },
        });
        if (changed.count !== 1) return null;
        const eventContext = context(serverId, current);
        const startedId = await enqueueCreativeEvent(tx, creativeTaskStartedInput(eventContext));
        const readyId = await enqueueCreativeEvent(tx, creativeDeliverableReadyInput(eventContext, completed.artifact!.filename));
        return [startedId, readyId];
      });
      if (!result) return reply.status(409).send({ error: "Задание уже выполняется или изменилось" });
      const updated = await db.creativeJob.findFirst({ where: { id: jobId, serverId } });
      if (!updated) return reply.status(404).send({ error: "Creative-задание не найдено" });
      recordAudit("CREATIVE_JOB_EXECUTED", {
        userId,
        req,
        metadata: { serverId, creativeJobId: jobId, provider: "eclipse-preview", chargedCredits: 0 },
      });
      await dispatchOfficeEventOutboxBestEffort({ ids: result });
      return { job: view(updated), idempotent: false };
    },
  );

  app.get(
    "/api/servers/:id/creative-jobs/:jobId/artifact",
    { onRequest: [requireJwt], config: { rateLimit: READ_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, jobId } = req.params as { id: string; jobId: string };
      if (!(await membership(userId, serverId))) return reply.status(403).send({ error: "Not a member" });
      const row = await db.creativeJob.findFirst({ where: { id: jobId, serverId, status: "ready" } });
      if (!row) return reply.status(404).send({ error: "Готовый Creative-пакет не найден" });
      const job = parseStoredCreativeJob(row.payload);
      if (!job.artifact) return reply.status(404).send({ error: "Готовый Creative-пакет не найден" });
      const payload = creativeJobPackage(job);
      recordAudit("CREATIVE_PACKAGE_DOWNLOADED", {
        userId,
        req,
        metadata: { serverId, creativeJobId: jobId, bytes: Buffer.byteLength(payload, "utf8") },
      });
      return reply
        .type("application/json; charset=utf-8")
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Disposition", `attachment; filename="${job.artifact.filename}"`)
        .send(payload);
    },
  );
}
