import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_BUILDER_IMPORT_BYTES = 128 * 1024;
export const MAX_PENDING_BUILDER_REVIEWS_PER_OPERATOR = 20;
const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const highConfidenceSecret = /(?:AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const queueIds = ["brief", "interface", "data", "security", "quality", "publish"] as const;

function boundedText(min: number, max: number) {
  return z.string().trim().min(min).max(max).refine(
    (value) => !controlCharacters.test(value),
    "Управляющие символы запрещены",
  ).refine((value) => !highConfidenceSecret.test(value), "Удалите секрет или API-ключ перед импортом");
}

const identifierSchema = z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
const routeSchema = z.object({
  path: z.string().min(1).max(120).regex(/^\/(?!\/)[A-Za-z0-9_/:.-]*$/, "Некорректный route path"),
  label: boundedText(1, 80),
  purpose: boundedText(1, 240),
}).strict();
const sectionSchema = z.object({
  id: boundedText(1, 64),
  label: boundedText(1, 80),
  purpose: boundedText(1, 240),
}).strict();
const queueItemSchema = z.object({
  id: z.enum(queueIds),
  title: boundedText(1, 120),
  outcome: boundedText(1, 240),
  status: z.enum(["ready", "blocked"]),
  gate: boundedText(1, 240).nullable(),
}).strict();
const inputSchema = z.object({
  name: boundedText(3, 80),
  audience: boundedText(5, 160),
  problem: boundedText(20, 600),
  primaryAction: boundedText(3, 80),
  template: z.enum(["landing", "dashboard", "catalog"]),
  requirements: z.array(boundedText(3, 240)).max(8),
}).strict();
const policySchema = z.object({
  externalActions: z.literal(false),
  toolsAllowed: z.literal(false),
  sourceContentTrusted: z.literal(false),
  generatedCodeExecuted: z.literal(false),
  githubConnected: z.literal(false),
  deployAllowed: z.literal(false),
  paymentsAllowed: z.literal(false),
}).strict();
const approvalSchema = z.object({
  requirementsConfirmed: z.literal(true),
  securityBoundaryConfirmed: z.literal(true),
  previewReviewed: z.literal(true),
  approvedAt: z.string().datetime(),
}).strict();

const builderProjectSchema = z.object({
  schemaVersion: z.literal("builder.project.v1"),
  id: identifierSchema,
  status: z.enum(["draft", "ready_for_review", "approved"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  input: inputSchema,
  blueprint: z.object({
    routes: z.array(routeSchema).min(1).max(8),
    sections: z.array(sectionSchema).min(3).max(8),
    states: z.tuple([
      z.literal("loading"), z.literal("empty"), z.literal("error"),
      z.literal("success"), z.literal("disabled"), z.literal("no-access"),
    ]),
    entities: z.array(boundedText(1, 80)).min(1).max(8),
    design: z.object({
      density: z.literal("balanced"),
      accent: z.literal("#6BA3FF"),
      radius: z.literal("medium"),
      fontStack: z.literal("system"),
    }).strict(),
  }).strict(),
  preview: z.object({
    eyebrow: boundedText(1, 80),
    headline: boundedText(3, 80),
    supportingText: boundedText(20, 600),
    actionLabel: boundedText(3, 80),
    proofPoints: z.array(boundedText(1, 80)).length(3),
  }).strict(),
  buildQueue: z.array(queueItemSchema).length(6),
  policy: policySchema,
  approval: approvalSchema.nullable(),
}).strict().superRefine((project, context) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(project.input.requirements)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["input", "requirements"], message: "Требования должны быть уникальными" });
  if (!unique(project.blueprint.routes.map((route) => route.path))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["blueprint", "routes"], message: "Routes должны быть уникальными" });
  if (!unique(project.blueprint.sections.map((section) => section.id))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["blueprint", "sections"], message: "ID секций должны быть уникальными" });
  if (!unique(project.blueprint.entities)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["blueprint", "entities"], message: "Entities должны быть уникальными" });
  if (!unique(project.preview.proofPoints)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["preview", "proofPoints"], message: "Proof points должны быть уникальными" });
  if (project.buildQueue.map((item) => item.id).join(",") !== queueIds.join(",")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["buildQueue"], message: "Build queue имеет неподдерживаемую структуру" });
  }
  if (project.status === "approved" && !project.approval) context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval"], message: "Approved project должен содержать approval" });
  if (project.status !== "approved" && project.approval !== null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval"], message: "Неутверждённый project не может содержать approval" });
  if (project.approval) {
    const approvedAt = new Date(project.approval.approvedAt).getTime();
    if (approvedAt < new Date(project.createdAt).getTime() || approvedAt > new Date(project.updatedAt).getTime()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval", "approvedAt"], message: "approvedAt вне версии проекта" });
    }
  }
  if (new Date(project.updatedAt).getTime() < new Date(project.createdAt).getTime()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["updatedAt"], message: "updatedAt раньше createdAt" });
});

export type BuilderProjectPayload = z.infer<typeof builderProjectSchema>;

export function parseBuilderProjectImport(raw: unknown) {
  const rawJson = JSON.stringify(raw);
  if (Buffer.byteLength(rawJson, "utf8") > MAX_BUILDER_IMPORT_BYTES) throw new Error("Builder export превышает лимит 128 КБ");
  const parsed = builderProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new Error(`${path}${issue?.message ?? "Некорректный builder.project.v1"}`);
  }
  if (parsed.data.status !== "approved" || !parsed.data.approval) throw new Error("Импортировать можно только утверждённый builder.project.v1");
  const project: BuilderProjectPayload = {
    ...parsed.data,
    status: "ready_for_review",
    approval: null,
    buildQueue: parsed.data.buildQueue.map((item) => item.id === "brief"
      ? { ...item, status: "ready", gate: null }
      : { ...item, status: "blocked", gate: "Требуется независимый review в Eclipse Chat" }),
  };
  const payload = JSON.stringify(project);
  return {
    project,
    payload,
    payloadHash: createHash("sha256").update(payload).digest("hex"),
    sourceApprovalClaimed: true as const,
  };
}

export function parseStoredBuilderProject(payload: string): BuilderProjectPayload {
  let raw: unknown;
  try { raw = JSON.parse(payload) as unknown; }
  catch { throw new Error("Stored builder.project.v1 is not valid JSON"); }
  const parsed = builderProjectSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Stored builder.project.v1 failed validation");
  return parsed.data;
}

export function parseBuilderIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value) ? value : null;
}
