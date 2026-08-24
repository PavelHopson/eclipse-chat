import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
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
import { consumeGrowthBudgetOnceWithClient, getGrowthBudget, type GrowthBudgetTransactionClient } from "../lib/growthBudget.js";
import { executeGrowthHubStep, getGrowthHubPolicy, GrowthHubError } from "../ai/growthHub.js";
import { hasPermission } from "../lib/permissions.js";
import { GrowthStepLeaseRegistry } from "../lib/growthStepLease.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { recordAudit } from "../security/audit.js";
import {
  enqueueGrowthApprovalResolved,
  enqueueGrowthTaskCancelled,
  enqueueGrowthTaskCreated,
  enqueueGrowthTaskProgressed,
  enqueueGrowthTaskStarted,
} from "../office/growthEvents.js";
import { dispatchOfficeEventOutboxBestEffort } from "../office/outbox.js";
import type { MemberRole } from "./servers.js";

const READ_RATE_LIMIT = { max: 60, timeWindow: 60 * 1000 };
const IMPORT_RATE_LIMIT = { max: 10, timeWindow: 15 * 60 * 1000 };
const REVIEW_RATE_LIMIT = { max: 30, timeWindow: 5 * 60 * 1000 };
const EXECUTE_RATE_LIMIT = { max: 30, timeWindow: 15 * 60 * 1000 };
const GROWTH_EXECUTION_LEASE_MS = 3 * 60 * 1000;
const GROWTH_EXECUTION_POLL_MS = 2 * 1000;

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
  const localActive = activeGrowthSteps.get(row.id);
  const leaseActive = Boolean(
    row.executionLeaseId
    && row.executionLeaseStep
    && row.executionLeaseUntil
    && row.executionLeaseUntil.getTime() > Date.now(),
  );
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
    executionState: row.executionCancelRequestedAt && leaseActive
      ? "CANCELLING"
      : localActive || leaseActive ? "RUNNING" : "IDLE",
    activeStep: localActive?.step ?? (leaseActive ? row.executionLeaseStep : null),
    run: parseStoredGrowthRun(row.payload),
  };
}

function storedPayload(run: ReturnType<typeof parseStoredGrowthRun>) {
  const payload = JSON.stringify(run);
  return { payload, payloadHash: createHash("sha256").update(payload).digest("hex") };
}

function growthExecutionLeaseUntil(now = Date.now()): Date {
  return new Date(now + GROWTH_EXECUTION_LEASE_MS);
}

type GrowthDbClockClient = Pick<Prisma.TransactionClient, "$queryRaw">;

async function readGrowthDatabaseNow(client: unknown): Promise<Date> {
  const rows = await (client as GrowthDbClockClient).$queryRaw<Array<{ now: Date }>>(
    Prisma.sql`SELECT CURRENT_TIMESTAMP AS "now"`,
  );
  const now = rows[0]?.now;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Growth database clock unavailable");
  }
  return now;
}

async function releaseGrowthExecutionLease(
  runId: string,
  serverId: string,
  leaseId: string,
): Promise<void> {
  await db.growthRun.updateMany({
    where: { id: runId, serverId, executionLeaseId: leaseId },
    data: {
      executionLeaseId: null,
      executionLeaseUserId: null,
      executionLeaseStep: null,
      executionLeaseUntil: null,
      executionCancelRequestedAt: null,
    },
  });
}

function startGrowthExecutionMonitor(options: {
  runId: string;
  serverId: string;
  leaseId: string;
  controller: AbortController;
}): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const poll = async () => {
    try {
      const current = await db.growthRun.findFirst({
        where: { id: options.runId, serverId: options.serverId },
        select: { executionLeaseId: true, executionCancelRequestedAt: true },
      });
      if (
        !current
        || current.executionLeaseId !== options.leaseId
        || current.executionCancelRequestedAt !== null
      ) {
        options.controller.abort();
        return;
      }
      const heartbeatAt = await readGrowthDatabaseNow(db);
      const renewed = await db.growthRun.updateMany({
        where: {
          id: options.runId,
          serverId: options.serverId,
          executionLeaseId: options.leaseId,
          executionCancelRequestedAt: null,
          executionLeaseUntil: { gt: heartbeatAt },
        },
        data: { executionLeaseUntil: growthExecutionLeaseUntil(heartbeatAt.getTime()) },
      });
      if (renewed.count !== 1) options.controller.abort();
    } catch {
      options.controller.abort();
    } finally {
      if (!stopped && !options.controller.signal.aborted) {
        timer = setTimeout(poll, GROWTH_EXECUTION_POLL_MS);
        timer.unref();
      }
    }
  };

  timer = setTimeout(poll, GROWTH_EXECUTION_POLL_MS);
  timer.unref();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
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
        const { created, outboxId } = await db.$transaction(async (tx) => {
          const created = await tx.growthRun.create({
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
          const outboxId = await enqueueGrowthTaskCreated(tx, {
            workspaceId: serverId,
            runId: created.id,
            releaseName: run.input.releaseName,
          }, "chat");
          return { created, outboxId };
        });
        recordAudit("GROWTH_RUN_CREATED", {
          userId,
          req,
          metadata: { serverId, growthRunId: created.id, sourceRunId },
        });
        await dispatchOfficeEventOutboxBestEffort({ ids: [outboxId] });
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

      const logicalExecutionId = createHash("sha256")
        .update(JSON.stringify([runId, next.step, row.version]))
        .digest("hex");

      const hubPolicy = getGrowthHubPolicy();
      if (!hubPolicy.configured) {
        return reply.status(503).send({ error: "Growth executor пока не настроен администратором" });
      }

      const leaseId = randomUUID();
      const claimAt = await readGrowthDatabaseNow(db);
      const claimed = await db.growthRun.updateMany({
        where: {
          id: runId,
          serverId,
          version: row.version,
          reviewStatus: "PENDING",
          OR: [
            { executionLeaseId: null },
            { executionLeaseUntil: { lt: claimAt } },
          ],
        },
        data: {
          executionLeaseId: leaseId,
          executionLeaseUserId: userId,
          executionLeaseStep: next.step,
          executionLeaseUntil: growthExecutionLeaseUntil(claimAt.getTime()),
          executionCancelRequestedAt: null,
        },
      });
      if (claimed.count !== 1) {
        return reply.status(409).send({ error: "Этот шаг уже выполняется" });
      }

      const controller = new AbortController();
      if (!activeGrowthSteps.reserve(runId, {
        leaseId,
        userId,
        step: next.step,
        controller,
      })) {
        await releaseGrowthExecutionLease(runId, serverId, leaseId);
        return reply.status(409).send({ error: "Этот шаг уже выполняется" });
      }

      const stopMonitor = startGrowthExecutionMonitor({ runId, serverId, leaseId, controller });
      try {
        const startTransition = await db.$transaction(async (tx) => {
          const startAt = await readGrowthDatabaseNow(tx);
          const kept = await tx.growthRun.updateMany({
            where: {
              id: runId,
              serverId,
              executionLeaseId: leaseId,
              executionCancelRequestedAt: null,
              executionLeaseUntil: { gt: startAt },
            },
            data: { executionLeaseUntil: growthExecutionLeaseUntil(startAt.getTime()) },
          });
          if (kept.count !== 1) return { state: "cancelled" as const };

          const budget = await consumeGrowthBudgetOnceWithClient(
            tx as unknown as GrowthBudgetTransactionClient,
            userId,
            hubPolicy.dailyRequestLimit,
            logicalExecutionId,
            startAt,
          );
          if (!budget) return { state: "exhausted" as const };

          const outboxId = budget.idempotent
            ? null
            : await enqueueGrowthTaskStarted(tx, {
              workspaceId: serverId,
              runId,
              releaseName: run.input.releaseName,
            }, next.step, next.role);
          return { state: "started" as const, budget, outboxId };
        });
        if (startTransition.state === "cancelled") {
          return reply.status(409).send({ error: "Запуск был отменён до обращения к AI Hub" });
        }
        if (startTransition.state === "exhausted") {
          return reply.status(429).send({ error: "Дневной лимит Growth-запросов исчерпан. Он обновится в 00:00 UTC" });
        }
        const { budget } = startTransition;
        if (startTransition.outboxId) {
          await dispatchOfficeEventOutboxBestEffort({ ids: [startTransition.outboxId] });
        }
        const providerRequestId = logicalExecutionId;
        const result = await executeGrowthHubStep(run, next.step, {
          signal: controller.signal,
          requestId: providerRequestId,
        });
        const updatedRun = appendGrowthArtifact(run, result);
        const serialized = storedPayload(updatedRun);
        const transition = await db.$transaction(async (tx) => {
          const changed = await tx.growthRun.updateMany({
            where: {
              id: runId,
              serverId,
              version: row.version,
              reviewStatus: "PENDING",
              executionLeaseId: leaseId,
              executionCancelRequestedAt: null,
            },
            data: {
              ...serialized,
              lastExecutionKey: executionKey,
              lastExecutedStep: next.step,
              executionLeaseId: null,
              executionLeaseUserId: null,
              executionLeaseStep: null,
              executionLeaseUntil: null,
              executionCancelRequestedAt: null,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) return { changed: changed.count, outboxId: null };
          const outboxId = await enqueueGrowthTaskProgressed(tx, {
            workspaceId: serverId,
            runId,
            releaseName: updatedRun.input.releaseName,
          }, result.step, result.role, updatedRun.artifacts.length, GROWTH_STEP_DEFINITIONS.length);
          return { changed: changed.count, outboxId };
        });
        if (transition.changed !== 1 || !transition.outboxId) {
          return reply.status(409).send({ error: "Материал изменился или запуск был отменён во время выполнения" });
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
        await dispatchOfficeEventOutboxBestEffort({ ids: [transition.outboxId] });
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
        stopMonitor();
        activeGrowthSteps.release(runId, controller);
        await releaseGrowthExecutionLease(runId, serverId, leaseId);
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
      const row = await db.growthRun.findFirst({
        where: { id: runId, serverId },
        select: {
          id: true,
          payload: true,
          executionLeaseId: true,
          executionLeaseUserId: true,
          executionLeaseStep: true,
          executionLeaseUntil: true,
          executionCancelRequestedAt: true,
        },
      });
      if (!row) return reply.status(404).send({ error: "Growth run не найден" });
      const executionLeaseId = row.executionLeaseId;
      const executionLeaseStep = row.executionLeaseStep;
      if (!executionLeaseId || !executionLeaseStep || !row.executionLeaseUntil) {
        return reply.status(409).send({ error: "Сейчас нет выполняющегося шага" });
      }
      if (row.executionLeaseUserId !== userId && !hasPermission(membership.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Остановить чужой запуск может только участник с правом approval" });
      }

      const local = activeGrowthSteps.get(runId);
      if (row.executionCancelRequestedAt) {
        if (local?.leaseId === executionLeaseId) local.controller.abort();
        return reply.status(202).send({ cancelled: true, idempotent: true });
      }

      const run = parseStoredGrowthRun(row.payload);
      const cancellation = await db.$transaction(async (tx) => {
        const cancellationAt = await readGrowthDatabaseNow(tx);
        const changed = await tx.growthRun.updateMany({
          where: {
            id: runId,
            serverId,
            executionLeaseId: executionLeaseId,
            executionCancelRequestedAt: null,
            executionLeaseUntil: { gt: cancellationAt },
          },
          data: { executionCancelRequestedAt: cancellationAt },
        });
        if (changed.count !== 1) return null;
        return enqueueGrowthTaskCancelled(tx, {
          workspaceId: serverId,
          runId,
          releaseName: run.input.releaseName,
        }, executionLeaseStep);
      });
      if (!cancellation) {
        return reply.status(409).send({ error: "Запуск уже завершился или был отменён" });
      }

      if (local?.leaseId === executionLeaseId) local.controller.abort();
      recordAudit("GROWTH_STEP_CANCELLED", {
        userId,
        req,
        metadata: { serverId, growthRunId: runId, step: executionLeaseStep },
      });
      await dispatchOfficeEventOutboxBestEffort({ ids: [cancellation] });
      return reply.status(202).send({ cancelled: true, idempotent: false });
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

      let created: GrowthRunRow;
      let outboxId: string;
      try {
        const transaction = await db.$transaction(async (tx) => {
          const created = await tx.growthRun.create({
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
          const outboxId = await enqueueGrowthTaskCreated(tx, {
            workspaceId: serverId,
            runId: created.id,
            releaseName: parsed.run.input.releaseName,
          }, "import");
          return { created, outboxId };
        });
        created = transaction.created;
        outboxId = transaction.outboxId;
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
      await dispatchOfficeEventOutboxBestEffort({ ids: [outboxId] });
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
      const transition = await db.$transaction(async (tx) => {
        const changed = await tx.growthRun.updateMany({
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
        if (changed.count !== 1) return { changed: changed.count, outboxId: null };
        const outboxId = await enqueueGrowthApprovalResolved(tx, {
          workspaceId: serverId,
          runId,
          releaseName: reviewPayload.input.releaseName,
        }, nextStatus);
        return { changed: changed.count, outboxId };
      });
      if (transition.changed !== 1 || !transition.outboxId) {
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
      await dispatchOfficeEventOutboxBestEffort({ ids: [transition.outboxId] });
      return { run: growthRunView(updated) };
    },
  );
}
