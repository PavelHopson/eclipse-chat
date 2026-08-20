import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { MAX_AUTOMATION_AUDIT_IMPORT_BYTES, MAX_PENDING_AUTOMATION_AUDITS_PER_OPERATOR, isSafeAutomationAuditNote, parseAutomationAuditIdempotencyKey, parseAutomationAuditImport, parseStoredAutomationAudit } from "../lib/automationAuditContract.js";
import { hasPermission } from "../lib/permissions.js";
import { ensureServerActive } from "../lib/serverGating.js";
import { recordAudit } from "../security/audit.js";
import type { MemberRole } from "./servers.js";

const importBody = z.object({ artifact: z.unknown() }).strict();
const reviewBody = z.object({ version: z.number().int().positive(), decision: z.enum(["APPROVE", "REJECT"]), scopeConfirmed: z.boolean().optional(), claimsConfirmed: z.boolean().optional(), noExternalActionsConfirmed: z.boolean().optional(), note: z.string().trim().max(1000).refine(isSafeAutomationAuditNote, "Не добавляйте секреты").optional() }).strict().superRefine((body, ctx) => {
  if (body.decision === "APPROVE" && (!body.scopeConfirmed || !body.claimsConfirmed || !body.noExternalActionsConfirmed)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Подтвердите scope, claims и запрет внешних действий" });
  if (body.decision === "REJECT" && (body.note?.length ?? 0) < 3) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Укажите причину отклонения" });
});
const include = { importedBy: { select: { id: true, displayName: true, avatar: true } }, reviewedBy: { select: { id: true, displayName: true, avatar: true } } } as const;
type Row = Prisma.AutomationAuditReviewGetPayload<{ include: typeof include }>;
export const automationAuditReviewSelector = (serverId: string, reviewId: string) => ({ id: reviewId, serverId });
const membership = (userId: string, serverId: string) => db.member.findUnique({ where: { userId_serverId: { userId, serverId } }, select: { role: true } });
const uid = (req: FastifyRequest) => getUserId(req);
const view = (row: Row) => ({ id: row.id, sourceAuditId: row.sourceAuditId, schemaVersion: row.schemaVersion, reviewStatus: row.reviewStatus, reviewNote: row.reviewNote, reviewedAt: row.reviewedAt?.toISOString() ?? null, reviewedBy: row.reviewedBy, importedBy: row.importedBy, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), artifact: parseStoredAutomationAudit(row.payload), receipt: row.reviewStatus === "APPROVED" && row.reviewedAt ? { receiptId: `chat-receipt-${row.id}`, decision: "approved", issuedAt: row.reviewedAt.toISOString(), statement: "Eclipse Chat human review approved this read-only proposal. No external action was executed." } : null });

export function registerAutomationAuditReviewRoutes(app: FastifyInstance) {
  app.get("/api/servers/:id/automation-audit-reviews", { onRequest: [requireJwt], config: { rateLimit: { max: 60, timeWindow: 60_000 } } }, async (req, reply) => {
    const userId = uid(req); if (!userId) return reply.status(401).send({ error: "Unauthorized" }); const { id: serverId } = req.params as { id: string };
    if (!(await membership(userId, serverId))) return reply.status(403).send({ error: "Not a member" });
    const rows = await db.automationAuditReview.findMany({ where: { serverId }, include, orderBy: { createdAt: "desc" }, take: 30 });
    return { reviews: rows.map(view), policy: { importedApprovalReset: true, externalActionsEnabled: false, maxPendingReviewsPerOperator: MAX_PENDING_AUTOMATION_AUDITS_PER_OPERATOR } };
  });
  app.post("/api/servers/:id/automation-audit-reviews/import", { onRequest: [requireJwt], bodyLimit: MAX_AUTOMATION_AUDIT_IMPORT_BYTES + 1024, config: { rateLimit: { max: 10, timeWindow: 900_000 } } }, async (req, reply) => {
    const userId = uid(req); if (!userId) return reply.status(401).send({ error: "Unauthorized" }); const { id: serverId } = req.params as { id: string }; const member = await membership(userId, serverId);
    if (!member) return reply.status(403).send({ error: "Not a member" }); if (!hasPermission(member.role as MemberRole, "TASK_CREATE")) return reply.status(403).send({ error: "Недостаточно прав" }); if (!(await ensureServerActive(serverId, reply))) return;
    const key = parseAutomationAuditIdempotencyKey(req.headers["idempotency-key"]); if (!key) return reply.status(400).send({ error: "Требуется корректный Idempotency-Key" }); const body = importBody.safeParse(req.body); if (!body.success) return reply.status(400).send({ error: "Некорректный import body" });
    let parsed: ReturnType<typeof parseAutomationAuditImport>; try { parsed = parseAutomationAuditImport(body.data.artifact); } catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "Некорректный audit" }); }
    const [byKey, bySource] = await Promise.all([
      db.automationAuditReview.findUnique({ where: { serverId_idempotencyKey: { serverId, idempotencyKey: key } }, include }),
      db.automationAuditReview.findUnique({ where: { serverId_sourceAuditId: { serverId, sourceAuditId: parsed.artifact.id } }, include }),
    ]);
    const existing = byKey ?? bySource;
    if (existing) {
      if ((byKey && bySource && byKey.id !== bySource.id) || existing.sourceAuditId !== parsed.artifact.id || existing.payloadHash !== parsed.payloadHash) {
        return reply.status(409).send({ error: "Source audit или idempotency key уже связан с другим содержимым" });
      }
      return { review: view(existing), idempotent: true };
    }
    let created;
    try {
      created = await db.$transaction(async (tx) => {
        const pending = await tx.automationAuditReview.count({ where: { serverId, importedByUserId: userId, reviewStatus: "PENDING" } });
        if (pending >= MAX_PENDING_AUTOMATION_AUDITS_PER_OPERATOR) throw new Error("AUTOMATION_AUDIT_PENDING_LIMIT");
        return tx.automationAuditReview.create({ data: { sourceAuditId: parsed.artifact.id, serverId, importedByUserId: userId, schemaVersion: parsed.artifact.schemaVersion, payload: parsed.payload, payloadHash: parsed.payloadHash, idempotencyKey: key }, include });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Error && error.message === "AUTOMATION_AUDIT_PENDING_LIMIT") return reply.status(429).send({ error: "Сначала разберите текущую очередь audit" });
      const code = (error as { code?: string } | null)?.code;
      if (code === "P2034") return reply.status(409).send({ error: "Очередь изменилась. Повторите импорт" });
      if (code !== "P2002") throw error;
      const raced = await db.automationAuditReview.findFirst({ where: { serverId, OR: [{ sourceAuditId: parsed.artifact.id }, { idempotencyKey: key }] }, include });
      if (!raced || raced.sourceAuditId !== parsed.artifact.id || raced.idempotencyKey !== key || raced.payloadHash !== parsed.payloadHash) return reply.status(409).send({ error: "Audit уже связан с другим содержимым" });
      return { review: view(raced), idempotent: true };
    }
    recordAudit("AUTOMATION_AUDIT_IMPORTED", { userId, req, metadata: { serverId, reviewId: created.id, sourceAuditId: created.sourceAuditId } }); return reply.status(201).send({ review: view(created), idempotent: false });
  });
  app.patch("/api/servers/:id/automation-audit-reviews/:reviewId", { onRequest: [requireJwt], config: { rateLimit: { max: 30, timeWindow: 300_000 } } }, async (req, reply) => {
    const userId = uid(req); if (!userId) return reply.status(401).send({ error: "Unauthorized" }); const { id: serverId, reviewId } = req.params as { id: string; reviewId: string }; const member = await membership(userId, serverId);
    if (!member) return reply.status(403).send({ error: "Not a member" }); if (!hasPermission(member.role as MemberRole, "TASK_APPROVE")) return reply.status(403).send({ error: "Недостаточно прав" }); if (!(await ensureServerActive(serverId, reply))) return;
    const body = reviewBody.safeParse(req.body); if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Некорректное решение" });
    const current = await db.automationAuditReview.findFirst({ where: automationAuditReviewSelector(serverId, reviewId) });
    if (!current) return reply.status(404).send({ error: "Audit не найден" });
    const artifact = parseStoredAutomationAudit(current.payload);
    if (artifact.status !== "ready_for_review") return reply.status(409).send({ error: "Automation Audit не готов к review" });
    const changed = await db.automationAuditReview.updateMany({ where: { ...automationAuditReviewSelector(serverId, reviewId), version: body.data.version, reviewStatus: "PENDING" }, data: { reviewStatus: body.data.decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewNote: body.data.note || null, reviewedAt: new Date(), reviewedByUserId: userId, version: { increment: 1 } } });
    if (changed.count !== 1) return reply.status(409).send({ error: "Решение уже изменилось. Обновите список" }); const updated = await db.automationAuditReview.findFirst({ where: automationAuditReviewSelector(serverId, reviewId), include }); if (!updated) return reply.status(404).send({ error: "Audit не найден" });
    recordAudit("AUTOMATION_AUDIT_DECIDED", { userId, req, metadata: { serverId, reviewId, decision: updated.reviewStatus, version: updated.version } }); return { review: view(updated) };
  });
}
