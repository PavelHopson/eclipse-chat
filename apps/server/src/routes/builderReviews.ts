import type { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  MAX_BUILDER_IMPORT_BYTES,
  MAX_PENDING_BUILDER_REVIEWS_PER_OPERATOR,
  parseBuilderIdempotencyKey,
  parseBuilderProjectImport,
  parseStoredBuilderProject,
} from "../lib/builderProjectContract.js";
import { hasPermission } from "../lib/permissions.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { recordAudit } from "../security/audit.js";
import type { MemberRole } from "./servers.js";

const READ_RATE_LIMIT = { max: 60, timeWindow: 60 * 1000 };
const IMPORT_RATE_LIMIT = { max: 10, timeWindow: 15 * 60 * 1000 };
const REVIEW_RATE_LIMIT = { max: 30, timeWindow: 5 * 60 * 1000 };
const importBodySchema = z.object({ project: z.unknown() }).strict();
const reviewBodySchema = z.object({
  version: z.number().int().positive(),
  decision: z.enum(["APPROVE", "REJECT"]),
  requirementsConfirmed: z.boolean().optional(),
  securityBoundaryConfirmed: z.boolean().optional(),
  previewReviewed: z.boolean().optional(),
  note: z.string().trim().max(1_000).refine(
    (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
    "Управляющие символы запрещены",
  ).optional(),
}).strict().superRefine((body, context) => {
  if (body.decision === "APPROVE"
    && (!body.requirementsConfirmed || !body.securityBoundaryConfirmed || !body.previewReviewed)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requirementsConfirmed"],
      message: "Подтвердите требования, границы безопасности и preview",
    });
  }
  if (body.decision === "REJECT" && (body.note?.length ?? 0) < 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Укажите причину отклонения" });
  }
});

const builderReviewInclude = {
  importedBy: { select: { id: true, displayName: true, avatar: true } },
  reviewedBy: { select: { id: true, displayName: true, avatar: true } },
} as const;
type BuilderReviewRow = Prisma.BuilderReviewGetPayload<{ include: typeof builderReviewInclude }>;

function reviewView(row: BuilderReviewRow) {
  return {
    id: row.id,
    sourceProjectId: row.sourceProjectId,
    schemaVersion: row.schemaVersion,
    reviewStatus: row.reviewStatus,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy ?? null,
    importedBy: row.importedBy ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: parseStoredBuilderProject(row.payload),
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

export function builderReviewSelector(serverId: string, reviewId: string) {
  return { id: reviewId, serverId };
}

export function registerBuilderReviewRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/builder-reviews",
    { onRequest: [requireJwt], config: { rateLimit: READ_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      if (!(await loadMembership(userId, serverId))) return reply.status(403).send({ error: "Not a member" });
      const rows = await db.builderReview.findMany({
        where: { serverId },
        include: builderReviewInclude,
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return {
        reviews: rows.map(reviewView),
        policy: {
          maxPendingReviewsPerOperator: MAX_PENDING_BUILDER_REVIEWS_PER_OPERATOR,
          importedApprovalReset: true,
          externalActionsEnabled: false,
        },
      };
    },
  );

  app.post(
    "/api/servers/:id/builder-reviews/import",
    {
      onRequest: [requireJwt],
      bodyLimit: MAX_BUILDER_IMPORT_BYTES + 1_024,
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
      const idempotencyKey = parseBuilderIdempotencyKey(req.headers["idempotency-key"]);
      if (!idempotencyKey) return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" });
      const body = importBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: "Некорректный import body" });

      let parsed: ReturnType<typeof parseBuilderProjectImport>;
      try { parsed = parseBuilderProjectImport(body.data.project); }
      catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Некорректный builder.project.v1" });
      }

      const [byKey, bySource] = await Promise.all([
        db.builderReview.findUnique({ where: { serverId_idempotencyKey: { serverId, idempotencyKey } }, include: builderReviewInclude }),
        db.builderReview.findUnique({ where: { serverId_sourceProjectId: { serverId, sourceProjectId: parsed.project.id } }, include: builderReviewInclude }),
      ]);
      const existing = byKey ?? bySource;
      if (existing) {
        if ((byKey && bySource && byKey.id !== bySource.id) || existing.payloadHash !== parsed.payloadHash) {
          return reply.status(409).send({ error: "Source project или idempotency key уже связан с другим содержимым" });
        }
        return { review: reviewView(existing), idempotent: true };
      }

      const pendingCount = await db.builderReview.count({
        where: { serverId, importedByUserId: userId, reviewStatus: "PENDING" },
      });
      if (pendingCount >= MAX_PENDING_BUILDER_REVIEWS_PER_OPERATOR) {
        return reply.status(429).send({ error: "Сначала разберите текущую очередь проектов" });
      }

      let created;
      try {
        created = await db.builderReview.create({
          data: {
            sourceProjectId: parsed.project.id,
            serverId,
            importedByUserId: userId,
            schemaVersion: parsed.project.schemaVersion,
            payload: parsed.payload,
            payloadHash: parsed.payloadHash,
            idempotencyKey,
          },
          include: builderReviewInclude,
        });
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== "P2002") throw error;
        const raced = await db.builderReview.findUnique({
          where: { serverId_sourceProjectId: { serverId, sourceProjectId: parsed.project.id } },
          include: builderReviewInclude,
        });
        if (!raced || raced.payloadHash !== parsed.payloadHash) {
          return reply.status(409).send({ error: "Builder project уже импортирован с другим содержимым" });
        }
        return { review: reviewView(raced), idempotent: true };
      }

      recordAudit("BUILDER_REVIEW_IMPORTED", {
        userId,
        req,
        metadata: {
          serverId,
          builderReviewId: created.id,
          sourceProjectId: parsed.project.id,
          sourceApprovalClaimed: parsed.sourceApprovalClaimed,
          routeCount: parsed.project.blueprint.routes.length,
          sectionCount: parsed.project.blueprint.sections.length,
        },
      });
      return reply.status(201).send({ review: reviewView(created), idempotent: false });
    },
  );

  app.patch(
    "/api/servers/:id/builder-reviews/:reviewId",
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
      const current = await db.builderReview.findFirst({ where: builderReviewSelector(serverId, reviewId) });
      if (!current) return reply.status(404).send({ error: "Builder review не найден" });
      const project = parseStoredBuilderProject(current.payload);
      if (project.status !== "ready_for_review") return reply.status(409).send({ error: "Builder project не готов к review" });

      const nextStatus = body.data.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const changed = await db.builderReview.updateMany({
        where: { ...builderReviewSelector(serverId, reviewId), version: body.data.version, reviewStatus: "PENDING" },
        data: {
          reviewStatus: nextStatus,
          reviewNote: body.data.note || null,
          reviewedAt: new Date(),
          reviewedByUserId: userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const latest = await db.builderReview.findFirst({ where: builderReviewSelector(serverId, reviewId) });
        if (!latest) return reply.status(404).send({ error: "Builder review не найден" });
        return reply.status(409).send({
          error: "Решение уже изменилось. Обновите список перед повтором",
          currentVersion: latest.version,
          currentStatus: latest.reviewStatus,
        });
      }
      const updated = await db.builderReview.findFirst({
        where: builderReviewSelector(serverId, reviewId),
        include: builderReviewInclude,
      });
      if (!updated) return reply.status(404).send({ error: "Builder review не найден" });
      recordAudit("BUILDER_REVIEW_DECIDED", {
        userId,
        req,
        metadata: { serverId, builderReviewId: reviewId, decision: nextStatus, version: updated.version },
      });
      return { review: reviewView(updated) };
    },
  );
}
