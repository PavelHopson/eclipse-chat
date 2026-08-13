import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_SPEC_GATE_IMPORT_BYTES = 96 * 1024;
export const MAX_PENDING_SPEC_GATE_REVIEWS_PER_OPERATOR = 20;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SECRET = /(?:AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const REVIEW_NOTE_SECRET = /(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S{8,})/i;

export function isSafeSpecGateReviewNote(value: string): boolean {
  return !CONTROL.test(value) && !REVIEW_NOTE_SECRET.test(value);
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max).refine((value) => !CONTROL.test(value), "Управляющие символы запрещены").refine((value) => !SECRET.test(value), "Удалите секрет или API-ключ");
const iso = z.string().datetime({ offset: true });
const safeFalse = z.literal(false);
const stageIds = ["constitution", "specify", "clarify", "plan", "tasks", "implement"] as const;
const evidencePath = z.string().trim().min(1).max(240).superRefine((value, context) => {
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized) || normalized.split("/").some((part) => !part || part === "." || part === "..") || normalized.split("/").includes(".git")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence path должен оставаться внутри workspace" });
  }
});
const policySchema = z.object({
  externalActions: safeFalse, toolsAllowed: safeFalse, sourceContentTrusted: safeFalse,
  generatedCodeExecuted: safeFalse, githubConnected: safeFalse, deployAllowed: safeFalse,
  paymentsAllowed: safeFalse, implementationAllowed: safeFalse,
}).strict();
const checklistSchema = z.object({ scopeConfirmed: z.literal(true), risksConfirmed: z.literal(true), rollbackConfirmed: z.literal(true), approvedAt: iso }).strict();

export const specGateSchema = z.object({
  schemaVersion: z.literal("eclipse.spec-gate.v1"),
  id: text(1, 96).refine((value) => /^[A-Za-z0-9_-]+$/.test(value), "Некорректный ID"),
  status: z.enum(["draft", "ready_for_review", "approved"]),
  createdAt: iso,
  updatedAt: iso,
  input: z.object({
    projectName: text(3, 80), repository: text(3, 200).refine((value) => /^(?:https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.test(value), "Некорректный GitHub repository"),
    problem: text(20, 800), userOutcome: text(10, 320),
    inScope: z.array(text(3, 320)).min(1).max(10), outOfScope: z.array(text(3, 320)).min(1).max(10),
    constraints: z.array(text(3, 320)).min(1).max(10), acceptanceCriteria: z.array(text(3, 320)).min(2).max(12),
    clarifications: z.array(z.object({ question: text(5, 240), answer: text(2, 400) }).strict()).max(10),
    rollbackPlan: text(10, 600), evidencePaths: z.array(evidencePath).min(1).max(20),
  }).strict(),
  stages: z.array(z.object({ id: z.enum(stageIds), command: z.enum(stageIds.map((id) => `/${id}`) as [`/${typeof stageIds[number]}`, ...`/${typeof stageIds[number]}`[]]), status: z.enum(["complete", "blocked"]), summary: text(3, 400) }).strict()).length(6),
  tasks: z.array(z.object({ id: text(1, 40).refine((value) => /^task-[0-9]{2}$/.test(value), "Некорректный task ID"), title: text(3, 120), acceptanceCriterion: text(3, 320), status: z.literal("pending") }).strict()).min(2).max(12),
  verification: z.object({
    evidencePaths: z.array(evidencePath).min(1).max(20),
    requiredChecks: z.tuple([z.literal("typecheck"), z.literal("tests"), z.literal("build"), z.literal("desktop-qa"), z.literal("mobile-qa"), z.literal("security-review")]),
  }).strict(),
  policy: policySchema,
  approval: checklistSchema.nullable(),
}).strict().superRefine((artifact, context) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(artifact.input.inScope) || !unique(artifact.input.outOfScope) || !unique(artifact.input.acceptanceCriteria) || !unique(artifact.input.evidencePaths)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Списки должны содержать уникальные значения" });
  if (artifact.stages.map((item) => item.id).join(",") !== stageIds.join(",") || artifact.stages.some((item) => item.command !== `/${item.id}`)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["stages"], message: "Нарушен порядок Spec Gate stages" });
  if (artifact.stages.slice(0, 5).some((item) => item.status !== "complete") || artifact.stages[5]?.status !== "blocked") context.addIssue({ code: z.ZodIssueCode.custom, path: ["stages"], message: "Implementation обязан оставаться заблокированным" });
  if (artifact.tasks.length !== artifact.input.acceptanceCriteria.length || artifact.tasks.some((item, index) => item.id !== `task-${String(index + 1).padStart(2, "0")}` || item.acceptanceCriterion !== artifact.input.acceptanceCriteria[index])) context.addIssue({ code: z.ZodIssueCode.custom, path: ["tasks"], message: "Tasks не соответствуют критериям приёмки" });
  if (artifact.verification.evidencePaths.join("\n") !== artifact.input.evidencePaths.join("\n")) context.addIssue({ code: z.ZodIssueCode.custom, path: ["verification", "evidencePaths"], message: "Evidence paths не соответствуют input" });
  if (artifact.status === "approved" && !artifact.approval) context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval"], message: "Approved artifact требует approval" });
  if (artifact.status !== "approved" && artifact.approval) context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval"], message: "Неутверждённый artifact не может содержать approval" });
});

export type SpecGatePayload = z.infer<typeof specGateSchema>;

export function parseSpecGateImport(raw: unknown) {
  const rawJson = JSON.stringify(raw);
  if (Buffer.byteLength(rawJson, "utf8") > MAX_SPEC_GATE_IMPORT_BYTES) throw new Error("Spec Gate export превышает лимит 96 КБ");
  const parsed = specGateSchema.safeParse(raw);
  if (!parsed.success) { const issue = parsed.error.issues[0]; throw new Error(`${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Некорректный eclipse.spec-gate.v1"}`); }
  if (parsed.data.status !== "approved" || !parsed.data.approval) throw new Error("Импортировать можно только утверждённый eclipse.spec-gate.v1");
  const artifact: SpecGatePayload = { ...parsed.data, status: "ready_for_review", approval: null };
  const payload = JSON.stringify(artifact);
  return { artifact, payload, payloadHash: createHash("sha256").update(payload).digest("hex"), sourceApprovalClaimed: true as const };
}

export function parseStoredSpecGate(payload: string): SpecGatePayload {
  let raw: unknown;
  try { raw = JSON.parse(payload) as unknown; } catch { throw new Error("Stored eclipse.spec-gate.v1 is not valid JSON"); }
  const parsed = specGateSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Stored eclipse.spec-gate.v1 failed validation");
  return parsed.data;
}

export function parseSpecGateIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value) ? value : null;
}
