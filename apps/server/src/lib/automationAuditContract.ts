import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_AUTOMATION_AUDIT_IMPORT_BYTES = 128 * 1024;
export const MAX_PENDING_AUTOMATION_AUDITS_PER_OPERATOR = 20;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SECRET = /(?:AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S{8,})/i;
const text = (min: number, max: number) => z.string().trim().min(min).max(max).refine((value) => !CONTROL.test(value) && !SECRET.test(value), "Управляющие символы и секреты запрещены");
const safeId = (min: number, max: number) => text(min, max).refine((value) => /^[A-Za-z0-9_-]+$/.test(value), "Некорректный ID");
const evidence = z.object({ id: safeId(2, 40), description: text(5, 320), source: text(3, 240) }).strict();
const claim = z.object({ claim: text(5, 400), evidenceIds: z.array(text(2, 40)).max(20) }).strict();
const approval = z.object({ scopeConfirmed: z.literal(true), claimsConfirmed: z.literal(true), noExternalActionsConfirmed: z.literal(true), approvedAt: z.string().datetime({ offset: true }) }).strict();
const receipt = z.object({ receiptId: text(3, 120), decision: z.literal("approved"), issuedAt: z.string().datetime({ offset: true }), statement: text(20, 500) }).strict();

export const automationAuditSchema = z.object({
  schemaVersion: z.literal("eclipse.automation-audit.v1"), id: safeId(1, 96),
  status: z.enum(["draft", "ready_for_review", "approved"]), createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }),
  input: z.object({
    businessName: text(2, 100), contactRole: text(2, 100), objective: text(10, 500), processName: text(3, 120),
    processSteps: z.array(text(2, 320)).min(2).max(12), systems: z.array(text(2, 320)).min(1).max(12), constraints: z.array(text(2, 320)).min(1).max(10),
    evidence: z.array(evidence).min(1).max(20),
    proposal: z.object({ outcome: text(10, 400), scope: z.array(text(2, 320)).min(1).max(10), exclusions: z.array(text(2, 320)).min(1).max(10), pilotMetric: text(5, 240) }).strict(),
    validation: z.object({ problem: text(10, 500), audience: text(5, 320), offer: text(5, 320), interviews: z.number().int().min(0).max(10_000), waitlist: z.number().int().min(0).max(1_000_000), pilotEvidence: text(5, 500) }).strict(),
    claims: z.array(claim).min(1).max(12),
  }).strict(),
  processMap: z.array(z.object({ order: z.number().int().positive(), step: text(2, 320), system: text(2, 320).nullable(), access: z.literal("read_only") }).strict()).min(2).max(12),
  claimAudit: z.array(z.object({ claim: text(5, 400), status: z.enum(["verified", "qualified", "remove"]), evidenceIds: z.array(text(2, 40)).max(20), reason: text(5, 500) }).strict()).min(1).max(12),
  policy: z.object({ externalActions: z.literal(false), oauthConnected: z.literal(false), productionChanges: z.literal(false), paymentsAllowed: z.literal(false), readOnly: z.literal(true) }).strict(),
  approval: approval.nullable(), receipt: receipt.nullable(),
}).strict().superRefine((artifact, context) => {
  const ids = new Set(artifact.input.evidence.map((item) => item.id));
  if (ids.size !== artifact.input.evidence.length || artifact.input.claims.some((item) => item.evidenceIds.some((id) => !ids.has(id))) || artifact.claimAudit.some((item) => item.evidenceIds.some((id) => !ids.has(id)))) context.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence binding нарушен" });
  if (artifact.processMap.length !== artifact.input.processSteps.length || artifact.processMap.some((item, index) => item.order !== index + 1 || item.step !== artifact.input.processSteps[index])) context.addIssue({ code: z.ZodIssueCode.custom, message: "Process map не соответствует intake" });
  if (artifact.status === "approved" && (!artifact.approval || !artifact.receipt)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Approved audit требует approval и receipt" });
  if (artifact.status !== "approved" && (artifact.approval || artifact.receipt)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Неутверждённый audit не может содержать approval или receipt" });
});
export type AutomationAuditPayload = z.infer<typeof automationAuditSchema>;

export function parseAutomationAuditImport(raw: unknown) {
  const rawJson = JSON.stringify(raw);
  if (Buffer.byteLength(rawJson, "utf8") > MAX_AUTOMATION_AUDIT_IMPORT_BYTES) throw new Error("Automation Audit export превышает лимит 128 КБ");
  const parsed = automationAuditSchema.safeParse(raw);
  if (!parsed.success) { const issue = parsed.error.issues[0]; throw new Error(`${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Некорректный eclipse.automation-audit.v1"}`); }
  if (parsed.data.status !== "approved" || !parsed.data.approval || !parsed.data.receipt) throw new Error("Импортировать можно только утверждённый eclipse.automation-audit.v1");
  const artifact: AutomationAuditPayload = { ...parsed.data, status: "ready_for_review", approval: null, receipt: null };
  const payload = JSON.stringify(artifact);
  return { artifact, payload, payloadHash: createHash("sha256").update(payload).digest("hex") };
}
export function parseStoredAutomationAudit(payload: string): AutomationAuditPayload {
  const parsed = automationAuditSchema.safeParse(JSON.parse(payload) as unknown);
  if (!parsed.success) throw new Error("Stored eclipse.automation-audit.v1 failed validation");
  return parsed.data;
}
export function parseAutomationAuditIdempotencyKey(raw: unknown) { return typeof raw === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(raw.trim()) ? raw.trim() : null; }
export function isSafeAutomationAuditNote(value: string) { return !CONTROL.test(value) && !SECRET.test(value); }
