import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  appendGrowthArtifact,
  createGrowthRunPayload,
  GROWTH_STEP_DEFINITIONS,
  growthInputSchema,
  MAX_PENDING_GROWTH_RUNS_PER_OPERATOR,
  parseGrowthIdempotencyKey,
  parseGrowthRunImport,
  parseStoredGrowthRun,
} from "../lib/growthRunContract.js";
import { consumeGrowthBudget, getGrowthBudget } from "../lib/growthBudget.js";
import { executeGrowthHubStep, getGrowthHubPolicy, GrowthHubError } from "../ai/growthHub.js";
import { hasPermission } from "../lib/permissions.js";
import { GrowthStepLeaseRegistry } from "../lib/growthStepLease.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { recordAudit } from "../security/audit.js";
import type { MemberRole } from "./servers.js";

const READ_RATE_LIMIT = { max: 60, timeWindow: 60 * 1000 };
const IMPORT_RATE_LIMIT = { max: 10, timeWindow: 15 * 60 * 1000 };
const REVIEW_RATE_LIMIT = { max: 30, timeWindow: 5 * 60 * 1000 };
const EXECUTE_RATE_LIMIT = { max: 30, timeWindow: 15 * 60 * 1000 };

const importBodySchema = z.object({ run: z.unknown() }).strict();
const createBodySchema = z.object({ input: growthInputSchema }).strict();
const executeBodySchema = z.object({ version: z.number().int().positive() }).strict();
const reviewBodySchema = z
  .object({
    version: z.number().int().positive(),
    decision: z.enum(["APPROVE", "REJECT"]),
    humanConfirmed: z.boolean().optional(),
    note: z
      .string()
      .trim()
      .max(1_000)
      .refine(
        (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
        "Управляющие символы запрещены",
      )
      .optional(),
  })
  .strict()
  .superRefine((body, context) => {
    if (body.decision === "APPROVE" && body.humanConfirmed !== true) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["humanConfirmed"],
        message: "Нужно подтвердить ручную проверку фактов, ссылок и CTA",
      });
    }
    if (body.decision === "REJECT" && (body.note?.length ?? 0) < 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "Для отклонения укажите причину",
      });
    }
  });

const growthRunInclude = {
  importedBy: { select: { id: true, displayName: true, avatar: true } },
  reviewedBy: { select: { id: true, displayName: true, avatar: true } },
} as const;

type GrowthRunRow = Prisma.GrowthRunGetPayload<{ include: typeof growthRunInclude }>;

const activeGrowthSteps = new GrowthStepLeaseRegistry();

function growthRunView(row: GrowthRunRow) {
  const active = activeGrowthSteps.get(row.id);
  return {
    id: row.id,
    sourceRunId: row.sourceRunId,
    schemaVersion: row.schemaVersion,
    reviewStatus: row.reviewStatus,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy ?? null,
    importedBy: row.importedBy ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    origin: row.sourceRunId.startsWith("chat:") ? "chat" : "import",
    executionState: active ? "RUNNING" : "IDLE",
    activeStep: active?.step ?? null,
    run: parseStoredGrowthRun(row.payload),
  };
}

function storedPayload(run: ReturnType<typeof parseStoredGrowthRun>) {
  const payload = JSON.stringify(run);
  return { payload, payloadHash: createHash("sha256").update(payload).digest("hex") };
}

async function loadMembership(userId: string, serverId: string) {
  return db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
}

function requestUserId(req: FastifyRequest): string | null {
  return getUserId(req);
}

export function registerGrowthRunRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/growth-runs",
    { onRequest: [requireJwt], config: { rateLimit: READ_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });

      const rows = await db.growthRun.findMany({
        where: { serverId },
        include: growthRunInclude,
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      const hubPolicy = getGrowthHubPolicy();
      const budget = await getGrowthBudget(userId, hubPolicy.dailyRequestLimit);
      return {
        runs: rows.map((row) => growthRunView(row)),
        policy: {
          maxPendingRunsPerOperator: MAX_PENDING_GROWTH_RUNS_PER_OPERATOR,
          executionEnabled: hubPolicy.configured,
          publicationEnabled: false,
          budget,
          maxRequestsPerRun: GROWTH_STEP_DEFINITIONS.length,
        },
      };
    },
  );

  app.post(
    "/api/servers/:id/growth-runs",
    { onRequest: [requireJwt], config: { rateLimit: IMPORT_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_CREATE")) {
        return reply.status(403).send({ error: "Недостаточно прав для создания Growth-материалов" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const idempotencyKey = parseGrowthIdempotencyKey(req.headers["idempotency-key"]);
      if (!idempotencyKey) return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" });
      const body = createBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Некорректные данные материала" });
      }

      const existing = await db.growthRun.findUnique({
        where: { serverId_idempotencyKey: { serverId, idempotencyKey } },
        include: growthRunInclude,
      });
      if (existing) return { run: growthRunView(existing), idempotent: true };

      const pendingCount = await db.growthRun.count({
        where: { serverId, importedByUserId: userId, reviewStatus: "PENDING" },
      });
      if (pendingCount >= MAX_PENDING_GROWTH_RUNS_PER_OPERATOR) {
        return reply.status(429).send({ error: "Сначала разберите текущую очередь Growth-материалов" });
      }

      const sourceRunId = `chat:${randomUUID()}`;
      const hubPolicy = getGrowthHubPolicy();
      const run = createGrowthRunPayload(body.data.input, sourceRunId, {
        provider: "eclipse-ai-hub",
        model: hubPolicy.model,
      });
      const serialized = storedPayload(run);
      try {
        const created = await db.growthRun.create({
          data: {
            sourceRunId,
            serverId,
            importedByUserId: userId,
            schemaVersion: run.schemaVersion,
            ...serialized,
            idempotencyKey,
          },
          include: growthRunInclude,
        });
        recordAudit("GROWTH_RUN_CREATED", {
          userId,
          req,
          metadata: { serverId, growthRunId: created.id, sourceRunId },
        });
        return reply.status(201).send({ run: growthRunView(created), idempotent: false });
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== "P2002") throw error;
        const raced = await db.growthRun.findUnique({
          where: { serverId_idempotencyKey: { serverId, idempotencyKey } },
          include: growthRunInclude,
        });
        if (!raced) throw error;
        return { run: growthRunView(raced), idempotent: true };
      }
    },
  );

  app.post(
    "/api/servers/:id/growth-runs/:runId/steps",
    { onRequest: [requireJwt], config: { rateLimit: EXECUTE_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, runId } = req.params as { id: string; runId: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_CREATE")) {
        return reply.status(403).send({ error: "Недостаточно прав для запуска Growth-ролей" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const body = executeBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: "Некорректная версия Growth run" });
      const executionKey = parseGrowthIdempotencyKey(req.headers["idempotency-key"]);
      if (!executionKey) return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" });

      const row = await db.growthRun.findFirst({ where: { id: runId, serverId }, include: growthRunInclude });
      if (!row) return reply.status(404).send({ error: "Growth run не найден" });
      if (row.lastExecutionKey === executionKey) {
        return { run: growthRunView(row), idempotent: true };
      }
      if (row.version !== body.data.version) {
        return reply.status(409).send({ error: "Материал уже изменился. Обновите список перед повтором" });
      }
      if (row.reviewStatus !== "PENDING") {
        return reply.status(409).send({ error: "Проверенный материал нельзя повторно запускать" });
      }
      const run = parseStoredGrowthRun(row.payload);
      const next = GROWTH_STEP_DEFINITIONS[run.artifacts.length];
      if (!next) return reply.status(409).send({ error: "Все пять ролей уже завершены" });
      if (activeGrowthSteps.get(runId)) return reply.status(409).send({ error: "Этот шаг уже выполняется" });

      const hubPolicy = getGrowthHubPolicy();
      if (!hubPolicy.configured) {
        return reply.status(503).send({ error: "Growth executor пока не настроен администратором" });
      }
      const controller = new AbortController();
      // Reserve the run synchronously before the first await below. This prevents
      // two clicks from starting duplicate provider requests in the same server process.
      if (!activeGrowthSteps.reserve(runId, { userId, step: next.step, controller })) {
        return reply.status(409).send({ error: "Этот шаг уже выполняется" });
      }
      try {
        const budget = await consumeGrowthBudget(userId, hubPolicy.dailyRequestLimit);
        if (!budget) {
          return reply.status(429).send({ error: "Дневной лимит Growth-запросов исчерпан. Он обновится в 00:00 UTC" });
        }
        const result = await executeGrowthHubStep(run, next.step, {
          signal: controller.signal,
          requestId: randomUUID(),
        });
        const updatedRun = appendGrowthArtifact(run, result);
        const serialized = storedPayload(updatedRun);
        const changed = await db.growthRun.updateMany({
          where: { id: runId, serverId, version: row.version, reviewStatus: "PENDING" },
          data: {
            ...serialized,
            lastExecutionKey: executionKey,
            lastExecutedStep: next.step,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          return reply.status(409).send({ error: "Материал изменился во время выполнения. Обновите список" });
        }
        const updated = await db.growthRun.findFirst({ where: { id: runId, serverId }, include: growthRunInclude });
        if (!updated) return reply.status(404).send({ error: "Growth run не найден" });
        recordAudit("GROWTH_STEP_EXECUTED", {
          userId,
          req,
          metadata: {
            serverId,
            growthRunId: runId,
            step: next.step,
            version: updated.version,
            budgetRemaining: budget.remaining,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
          },
        });
        activeGrowthSteps.release(runId, controller);
        return { run: growthRunView(updated), budget, idempotent: false };
      } catch (error) {
        if (error instanceof GrowthHubError) {
          const status = error.code === "cancelled" ? 409
            : error.code === "rate_limited" ? 429
              : error.code === "not_configured" ? 503
                : error.code === "timeout" ? 504
                  : 502;
          return reply.status(status).send({ error: error.message, code: error.code });
        }
        throw error;
      } finally {
        activeGrowthSteps.release(runId, controller);
      }
    },
  );

  app.post(
    "/api/servers/:id/growth-runs/:runId/cancel",
    { onRequest: [requireJwt], config: { rateLimit: REVIEW_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, runId } = req.params as { id: string; runId: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      const row = await db.growthRun.findFirst({ where: { id: runId, serverId }, select: { id: true } });
      if (!row) return reply.status(404).send({ error: "Growth run не найден" });
      const active = activeGrowthSteps.get(runId);
      if (!active) return reply.status(409).send({ error: "Сейчас нет выполняющегося шага" });
      if (active.userId !== userId && !hasPermission(membership.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Остановить чужой запуск может только участник с правом approval" });
      }
      active.controller.abort();
      recordAudit("GROWTH_STEP_CANCELLED", {
        userId,
        req,
        metadata: { serverId, growthRunId: runId, step: active.step },
      });
      return reply.status(202).send({ cancelled: true });
    },
  );

  app.post(
    "/api/servers/:id/growth-runs/import",
    { onRequest: [requireJwt], config: { rateLimit: IMPORT_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!(await ensureServerActive(serverId, reply))) return;

      const idempotencyKey = parseGrowthIdempotencyKey(req.headers["idempotency-key"]);
      if (!idempotencyKey) {
        return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" });
      }
      const body = importBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: "Некорректный import body" });

      let parsed: ReturnType<typeof parseGrowthRunImport>;
      try {
        parsed = parseGrowthRunImport(body.data.run);
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Некорректный growth.run.v1",
        });
      }

      const [byKey, bySource] = await Promise.all([
        db.growthRun.findUnique({
          where: { serverId_idempotencyKey: { serverId, idempotencyKey } },
          include: growthRunInclude,
        }),
        db.growthRun.findUnique({
          where: { serverId_sourceRunId: { serverId, sourceRunId: parsed.run.id } },
          include: growthRunInclude,
        }),
      ]);
      const existing = byKey ?? bySource;
      if (existing) {
        if ((byKey && bySource && byKey.id !== bySource.id) || existing.payloadHash !== parsed.payloadHash) {
          return reply.status(409).send({
            error: "Этот source run или idempotency key уже связан с другим содержимым",
          });
        }
        return { run: growthRunView(existing), idempotent: true };
      }

      const pendingCount = await db.growthRun.count({
        where: { serverId, importedByUserId: userId, reviewStatus: "PENDING" },
      });
      if (pendingCount >= MAX_PENDING_GROWTH_RUNS_PER_OPERATOR) {
        return reply.status(429).send({
          error: "Сначала разберите текущую очередь: у вас уже 20 запусков на проверке",
        });
      }

      let created;
      try {
        created = await db.growthRun.create({
          data: {
            sourceRunId: parsed.run.id,
            serverId,
            importedByUserId: userId,
            schemaVersion: parsed.run.schemaVersion,
            payload: parsed.payload,
            payloadHash: parsed.payloadHash,
            idempotencyKey,
          },
          include: growthRunInclude,
        });
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== "P2002") throw error;
        const raced = await db.growthRun.findUnique({
          where: { serverId_sourceRunId: { serverId, sourceRunId: parsed.run.id } },
          include: growthRunInclude,
        });
        if (!raced || raced.payloadHash !== parsed.payloadHash) {
          return reply.status(409).send({ error: "Growth run уже импортирован с другим содержимым" });
        }
        return { run: growthRunView(raced), idempotent: true };
      }

      recordAudit("GROWTH_RUN_IMPORTED", {
        userId,
        req,
        metadata: {
          serverId,
          growthRunId: created.id,
          sourceRunId: parsed.run.id,
          sourceApprovalClaimed: parsed.sourceApprovalClaimed,
          completedRequests: parsed.run.execution.completedRequests,
        },
      });
      return reply.status(201).send({ run: growthRunView(created), idempotent: false });
    },
  );

  app.patch(
    "/api/servers/:id/growth-runs/:runId/review",
    { onRequest: [requireJwt], config: { rateLimit: REVIEW_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, runId } = req.params as { id: string; runId: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Недостаточно прав для утверждения материалов" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;

      const body = reviewBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Некорректное решение" });
      }

      const reviewTarget = await db.growthRun.findFirst({ where: { id: runId, serverId } });
      if (!reviewTarget) return reply.status(404).send({ error: "Growth run не найден" });
      const reviewPayload = parseStoredGrowthRun(reviewTarget.payload);
      if (reviewPayload.status !== "ready_for_approval" || reviewPayload.artifacts.length !== GROWTH_STEP_DEFINITIONS.length) {
        return reply.status(409).send({ error: "Сначала завершите все пять Growth-ролей" });
      }

      const nextStatus = body.data.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const now = new Date();
      const changed = await db.growthRun.updateMany({
        where: {
          id: runId,
          serverId,
          version: body.data.version,
          reviewStatus: "PENDING",
        },
        data: {
          reviewStatus: nextStatus,
          reviewNote: body.data.note || null,
          reviewedAt: now,
          reviewedByUserId: userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const current = await db.growthRun.findFirst({ where: { id: runId, serverId } });
        if (!current) return reply.status(404).send({ error: "Growth run не найден" });
        return reply.status(409).send({
          error: "Решение уже изменилось. Обновите список перед повтором",
          currentVersion: current.version,
          currentStatus: current.reviewStatus,
        });
      }

      const updated = await db.growthRun.findFirst({
        where: { id: runId, serverId },
        include: growthRunInclude,
      });
      if (!updated) return reply.status(404).send({ error: "Growth run не найден" });
      recordAudit("GROWTH_RUN_REVIEWED", {
        userId,
        req,
        metadata: { serverId, growthRunId: runId, decision: nextStatus, version: updated.version },
      });
      return { run: growthRunView(updated) };
    },
  );
}
