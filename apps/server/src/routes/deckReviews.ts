import type { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import {
  MAX_DECK_IMPORT_BYTES,
  MAX_PENDING_DECK_REVIEWS_PER_OPERATOR,
  parseDeckIdempotencyKey,
  parseDeckJobImport,
  parseStoredDeckJob,
} from "../lib/deckJobContract.js";
import { encodeRfc5987Filename, renderDeckPptx } from "../lib/deckPptx.js";
import { hasPermission } from "../lib/permissions.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { recordAudit } from "../security/audit.js";
import type { MemberRole } from "./servers.js";

const READ_RATE_LIMIT = { max: 60, timeWindow: 60 * 1000 };
const IMPORT_RATE_LIMIT = { max: 10, timeWindow: 15 * 60 * 1000 };
const REVIEW_RATE_LIMIT = { max: 30, timeWindow: 5 * 60 * 1000 };
const RENDER_RATE_LIMIT = { max: 5, timeWindow: 15 * 60 * 1000 };
const importBodySchema = z.object({ job: z.unknown() }).strict();
const reviewBodySchema = z.object({
  version: z.number().int().positive(),
  decision: z.enum(["APPROVE", "REJECT"]),
  claimsVerified: z.boolean().optional(),
  rightsConfirmed: z.boolean().optional(),
  finalReviewComplete: z.boolean().optional(),
  note: z.string().trim().max(1_000).refine(
    (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
    "Управляющие символы запрещены",
  ).optional(),
}).strict().superRefine((body, context) => {
  if (body.decision === "APPROVE"
    && (!body.claimsVerified || !body.rightsConfirmed || !body.finalReviewComplete)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claimsVerified"],
      message: "Подтвердите факты, права на материалы и финальную проверку",
    });
  }
  if (body.decision === "REJECT" && (body.note?.length ?? 0) < 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Укажите причину отклонения" });
  }
});

const deckReviewInclude = {
  importedBy: { select: { id: true, displayName: true, avatar: true } },
  reviewedBy: { select: { id: true, displayName: true, avatar: true } },
} as const;
type DeckReviewRow = Prisma.DeckReviewGetPayload<{ include: typeof deckReviewInclude }>;

function reviewView(row: DeckReviewRow) {
  return {
    id: row.id,
    sourceJobId: row.sourceJobId,
    schemaVersion: row.schemaVersion,
    reviewStatus: row.reviewStatus,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy ?? null,
    importedBy: row.importedBy ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    job: parseStoredDeckJob(row.payload),
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

export function approvedDeckRenderSelector(serverId: string, reviewId: string) {
  return { id: reviewId, serverId, reviewStatus: "APPROVED" as const };
}

export function registerDeckReviewRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/deck-reviews",
    { onRequest: [requireJwt], config: { rateLimit: READ_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      if (!(await loadMembership(userId, serverId))) return reply.status(403).send({ error: "Not a member" });
      const rows = await db.deckReview.findMany({
        where: { serverId },
        include: deckReviewInclude,
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return {
        reviews: rows.map(reviewView),
        policy: {
          maxPendingReviewsPerOperator: MAX_PENDING_DECK_REVIEWS_PER_OPERATOR,
          pptxRenderingEnabled: true,
          renderRequiresApproval: true,
        },
      };
    },
  );

  app.post(
    "/api/servers/:id/deck-reviews/import",
    {
      onRequest: [requireJwt],
      bodyLimit: MAX_DECK_IMPORT_BYTES + 1_024,
      config: { rateLimit: IMPORT_RATE_LIMIT },
    },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_CREATE")) {
        return reply.status(403).send({ error: "Недостаточно прав для импорта презентаций" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const idempotencyKey = parseDeckIdempotencyKey(req.headers["idempotency-key"]);
      if (!idempotencyKey) return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" });
      const body = importBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: "Некорректный import body" });

      let parsed: ReturnType<typeof parseDeckJobImport>;
      try { parsed = parseDeckJobImport(body.data.job); }
      catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Некорректный deck.job.v1" });
      }

      const [byKey, bySource] = await Promise.all([
        db.deckReview.findUnique({ where: { serverId_idempotencyKey: { serverId, idempotencyKey } }, include: deckReviewInclude }),
        db.deckReview.findUnique({ where: { serverId_sourceJobId: { serverId, sourceJobId: parsed.job.id } }, include: deckReviewInclude }),
      ]);
      const existing = byKey ?? bySource;
      if (existing) {
        if ((byKey && bySource && byKey.id !== bySource.id) || existing.payloadHash !== parsed.payloadHash) {
          return reply.status(409).send({ error: "Source job или idempotency key уже связан с другим содержимым" });
        }
        return { review: reviewView(existing), idempotent: true };
      }

      const pendingCount = await db.deckReview.count({
        where: { serverId, importedByUserId: userId, reviewStatus: "PENDING" },
      });
      if (pendingCount >= MAX_PENDING_DECK_REVIEWS_PER_OPERATOR) {
        return reply.status(429).send({ error: "Сначала разберите текущую очередь презентаций" });
      }

      let created;
      try {
        created = await db.deckReview.create({
          data: {
            sourceJobId: parsed.job.id,
            serverId,
            importedByUserId: userId,
            schemaVersion: parsed.job.schemaVersion,
            payload: parsed.payload,
            payloadHash: parsed.payloadHash,
            idempotencyKey,
          },
          include: deckReviewInclude,
        });
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== "P2002") throw error;
        const raced = await db.deckReview.findUnique({
          where: { serverId_sourceJobId: { serverId, sourceJobId: parsed.job.id } },
          include: deckReviewInclude,
        });
        if (!raced || raced.payloadHash !== parsed.payloadHash) {
          return reply.status(409).send({ error: "Deck job уже импортирован с другим содержимым" });
        }
        return { review: reviewView(raced), idempotent: true };
      }

      recordAudit("DECK_REVIEW_IMPORTED", {
        userId,
        req,
        metadata: {
          serverId,
          deckReviewId: created.id,
          sourceJobId: parsed.job.id,
          sourceApprovalClaimed: parsed.sourceApprovalClaimed,
          slideCount: parsed.job.slides.length,
        },
      });
      return reply.status(201).send({ review: reviewView(created), idempotent: false });
    },
  );

  app.post(
    "/api/servers/:id/deck-reviews/:reviewId/render",
    { onRequest: [requireJwt], config: { rateLimit: RENDER_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, reviewId } = req.params as { id: string; reviewId: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Недостаточно прав для создания PPTX" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;

      // Tenant and approval predicates stay in the data query: a guessed reviewId
      // from another workspace never becomes a renderable object.
      const review = await db.deckReview.findFirst({
        where: approvedDeckRenderSelector(serverId, reviewId),
        select: { payload: true, sourceJobId: true },
      });
      if (!review) return reply.status(404).send({ error: "Утверждённая презентация не найдена" });

      let rendered;
      try {
        rendered = renderDeckPptx(parseStoredDeckJob(review.payload));
      } catch (error) {
        return reply.status(422).send({ error: error instanceof Error ? error.message : "Не удалось создать PPTX" });
      }

      recordAudit("DECK_PPTX_RENDERED", {
        userId,
        req,
        metadata: {
          serverId,
          deckReviewId: reviewId,
          sourceJobId: review.sourceJobId,
          outputBytes: rendered.buffer.length,
        },
      });
      return reply
        .type("application/vnd.openxmlformats-officedocument.presentationml.presentation")
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Disposition", `attachment; filename="eclipse-deck.pptx"; filename*=UTF-8''${encodeRfc5987Filename(rendered.filename)}`)
        .header("Content-Length", String(rendered.buffer.length))
        .send(rendered.buffer);
    },
  );

  app.patch(
    "/api/servers/:id/deck-reviews/:reviewId",
    { onRequest: [requireJwt], config: { rateLimit: REVIEW_RATE_LIMIT } },
    async (req, reply) => {
      const userId = requestUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId, reviewId } = req.params as { id: string; reviewId: string };
      const membership = await loadMembership(userId, serverId);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!hasPermission(membership.role as MemberRole, "TASK_APPROVE")) {
        return reply.status(403).send({ error: "Недостаточно прав для review презентаций" });
      }
      if (!(await ensureServerActive(serverId, reply))) return;
      const body = reviewBodySchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Некорректное решение" });
      const current = await db.deckReview.findFirst({ where: { id: reviewId, serverId } });
      if (!current) return reply.status(404).send({ error: "Deck review не найден" });
      const job = parseStoredDeckJob(current.payload);
      if (job.status !== "ready_for_review") return reply.status(409).send({ error: "Deck job не готов к review" });

      const nextStatus = body.data.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const changed = await db.deckReview.updateMany({
        where: { id: reviewId, serverId, version: body.data.version, reviewStatus: "PENDING" },
        data: {
          reviewStatus: nextStatus,
          reviewNote: body.data.note || null,
          reviewedAt: new Date(),
          reviewedByUserId: userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const latest = await db.deckReview.findFirst({ where: { id: reviewId, serverId } });
        if (!latest) return reply.status(404).send({ error: "Deck review не найден" });
        return reply.status(409).send({
          error: "Решение уже изменилось. Обновите список перед повтором",
          currentVersion: latest.version,
          currentStatus: latest.reviewStatus,
        });
      }
      const updated = await db.deckReview.findFirst({ where: { id: reviewId, serverId }, include: deckReviewInclude });
      if (!updated) return reply.status(404).send({ error: "Deck review не найден" });
      recordAudit("DECK_REVIEW_DECIDED", {
        userId,
        req,
        metadata: { serverId, deckReviewId: reviewId, decision: nextStatus, version: updated.version },
      });
      return { review: reviewView(updated) };
    },
  );
}
