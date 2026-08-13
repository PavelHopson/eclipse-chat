import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  MAX_SPEC_GATE_IMPORT_BYTES,
  MAX_PENDING_SPEC_GATE_REVIEWS_PER_OPERATOR,
  isSafeSpecGateReviewNote,
  parseSpecGateIdempotencyKey,
  parseSpecGateImport,
  parseStoredSpecGate,
} from "../lib/specGateContract.js";
import { hasPermission } from "../lib/permissions.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { recordAudit } from "../security/audit.js";
import type { MemberRole } from "./servers.js";

const READ_RATE_LIMIT = { max: 60, timeWindow: 60 * 1000 };
const IMPORT_RATE_LIMIT = { max: 10, timeWindow: 15 * 60 * 1000 };
const REVIEW_RATE_LIMIT = { max: 30, timeWindow: 5 * 60 * 1000 };
const PENDING_LIMIT_ERROR = "SPEC_GATE_PENDING_LIMIT";
const REVIEW_NOTE_SECRET = /(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S{8,})/i;
const importBodySchema = z.object({ artifact: z.unknown() }).strict();
const reviewBodySchema = z.object({
  version: z.number().int().positive(),
  decision: z.enum(["APPROVE", "REJECT"]),
  scopeConfirmed: z.boolean().optional(),
  risksConfirmed: z.boolean().optional(),
  rollbackConfirmed: z.boolean().optional(),
  note: z.string().trim().max(1_000).refine(
    (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
    "Управляющие символы запрещены",
  ).refine(isSafeSpecGateReviewNote, "Не добавляйте секреты и токены в комментарий").optional(),
}).strict().superRefine((body, context) => {
  if (body.decision === "APPROVE"
    && (!body.scopeConfirmed || !body.risksConfirmed || !body.rollbackConfirmed)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scopeConfirmed"],
      message: "Подтвердите scope, риски и план отката",
    });
  }
  if (body.decision === "REJECT" && (body.note?.length ?? 0) < 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Укажите причину отклонения" });
  }
});

const specGateReviewInclude = {
  importedBy: { select: { id: true, displayName: true, avatar: true } },
  reviewedBy: { select: { id: true, displayName: true, avatar: true } },
} as const;
type SpecGateReviewRow = Prisma.SpecGateReviewGetPayload<{ include: typeof specGateReviewInclude }>;

function reviewView(row: SpecGateReviewRow) {
  return {
    id: row.id,
    sourceSpecId: row.sourceSpecId,
    schemaVersion: row.schemaVersion,
    reviewStatus: row.reviewStatus,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy ?? null,
    importedBy: row.importedBy ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    artifact: parseStoredSpecGate(row.payload),
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

export function specGateReviewSelector(serverId: string, reviewId: string) {
  return { id: reviewId, serverId };
}

export function registerSpecGateReviewRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/spec-gate-reviews",
    { onRequest: [requireJwt], config: { rateLimit: READ_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      if (!(await loadMembership(userId, serverId))) return reply.status(403).send({ error: "Not a member" });
      const rows = await db.specGateReview.findMany({
        where: { serverId },
        include: specGateReviewInclude,
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return {
        reviews: rows.map(reviewView),
        policy: {
          maxPendingReviewsPerOperator: MAX_PENDING_SPEC_GATE_REVIEWS_PER_OPERATOR,
          importedApprovalReset: true,
          externalActionsEnabled: false,
        },
      };
    },
  );

  app.post(
    "/api/servers/:id/spec-gate-reviews/import",
    {
      onRequest: [requireJwt],
      bodyLimit: MAX_SPEC_GATE_IMPORT_BYTES + 1_024,
      config: { rateLimit: IMPORT_RATE_LIMIT },
    },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_CREATE")) {
        return reply.status(403).send({ error: "Недостаточно прав для импорта проектов" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const idempotencyKey = parseSpecGateIdempotencyKey(req.headers["idempotency-key"]);
      if (!idempotencyKey) return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" });
      const body = importBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: "Некорректный import body" });

      let parsed: ReturnType<typeof parseSpecGateImport>;
      try { parsed = parseSpecGateImport(body.data.artifact); }
      catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Некорректный eclipse.spec-gate.v1" });
      }

      const [byKey, bySource] = await Promise.all([
        db.specGateReview.findUnique({ where: { serverId_idempotencyKey: { serverId, idempotencyKey } }, include: specGateReviewInclude }),
        db.specGateReview.findUnique({ where: { serverId_sourceSpecId: { serverId, sourceSpecId: parsed.artifact.id } }, include: specGateReviewInclude }),
      ]);
      const existing = byKey ?? bySource;
      if (existing) {
        if ((byKey && bySource && byKey.id !== bySource.id) || existing.payloadHash !== parsed.payloadHash) {
          return reply.status(409).send({ error: "Source artifact или idempotency key уже связан с другим содержимым" });
        }
        return { review: reviewView(existing), idempotent: true };
      }

      let created;
      try {
        created = await db.$transaction(async (tx) => {
          const pendingCount = await tx.specGateReview.count({
            where: { serverId, importedByUserId: userId, reviewStatus: "PENDING" },
          });
          if (pendingCount >= MAX_PENDING_SPEC_GATE_REVIEWS_PER_OPERATOR) {
            throw new Error(PENDING_LIMIT_ERROR);
          }
          return tx.specGateReview.create({
            data: {
              sourceSpecId: parsed.artifact.id,
              serverId,
              importedByUserId: userId,
              schemaVersion: parsed.artifact.schemaVersion,
              payload: parsed.payload,
              payloadHash: parsed.payloadHash,
              idempotencyKey,
            },
            include: specGateReviewInclude,
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof Error && error.message === PENDING_LIMIT_ERROR) {
          return reply.status(429).send({ error: "Сначала разберите текущую очередь проектов" });
        }
        const code = (error as { code?: string } | null)?.code;
        if (code === "P2034") {
          return reply.status(409).send({ error: "Очередь изменилась. Повторите импорт" });
        }
        if (code !== "P2002") throw error;
        const raced = await db.specGateReview.findFirst({
          where: {
            serverId,
            OR: [{ sourceSpecId: parsed.artifact.id }, { idempotencyKey }],
          },
          include: specGateReviewInclude,
        });
        if (!raced || raced.sourceSpecId !== parsed.artifact.id || raced.payloadHash !== parsed.payloadHash) {
          return reply.status(409).send({ error: "Spec Gate artifact уже импортирован с другим содержимым" });
        }
        return { review: reviewView(raced), idempotent: true };
      }

      recordAudit("SPEC_GATE_REVIEW_IMPORTED", {
        userId,
        req,
        metadata: {
          serverId,
          specGateReviewId: created.id,
          sourceSpecId: parsed.artifact.id,
          sourceApprovalClaimed: parsed.sourceApprovalClaimed,
          acceptanceCount: parsed.artifact.input.acceptanceCriteria.length,
          evidencePathCount: parsed.artifact.verification.evidencePaths.length,
        },
      });
      return reply.status(201).send({ review: reviewView(created), idempotent: false });
    },
  );

  app.patch(
    "/api/servers/:id/spec-gate-reviews/:reviewId",
    { onRequest: [requireJwt], config: { rateLimit: REVIEW_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, reviewId } = req.params as { id: string; reviewId: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Недостаточно прав для review проектов" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const body = reviewBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Некорректное решение" });
      const current = await db.specGateReview.findFirst({ where: specGateReviewSelector(serverId, reviewId) });
      if (!current) return reply.status(404).send({ error: "Spec Gate review не найден" });
      const artifact = parseStoredSpecGate(current.payload);
      if (artifact.status !== "ready_for_review") return reply.status(409).send({ error: "Spec Gate artifact не готов к review" });

      const nextStatus = body.data.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const changed = await db.specGateReview.updateMany({
        where: { ...specGateReviewSelector(serverId, reviewId), version: body.data.version, reviewStatus: "PENDING" },
        data: {
          reviewStatus: nextStatus,
          reviewNote: body.data.note || null,
          reviewedAt: new Date(),
          reviewedByUserId: userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const latest = await db.specGateReview.findFirst({ where: specGateReviewSelector(serverId, reviewId) });
        if (!latest) return reply.status(404).send({ error: "Spec Gate review не найден" });
        return reply.status(409).send({
          error: "Решение уже изменилось. Обновите список перед повтором",
          currentVersion: latest.version,
          currentStatus: latest.reviewStatus,
        });
      }
      const updated = await db.specGateReview.findFirst({
        where: specGateReviewSelector(serverId, reviewId),
        include: specGateReviewInclude,
      });
      if (!updated) return reply.status(404).send({ error: "Spec Gate review не найден" });
      recordAudit("SPEC_GATE_REVIEW_DECIDED", {
        userId,
        req,
        metadata: { serverId, specGateReviewId: reviewId, decision: nextStatus, version: updated.version },
      });
      return { review: reviewView(updated) };
    },
  );
}
