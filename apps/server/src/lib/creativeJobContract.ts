import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const CREATIVE_JOB_SCHEMA_VERSION = "creative.job.v1" as const;
export const CREATIVE_PACKAGE_SCHEMA_VERSION = "creative.brief-package.v1" as const;
export const MAX_PENDING_CREATIVE_JOBS_PER_OPERATOR = 20;

const safeText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum).refine(
  (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value),
  "Управляющие символы запрещены",
);

const httpsUrlSchema = z.string().trim().url().max(2_048).superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Используйте HTTPS-ссылку без логина и пароля" });
  }
});

export const creativeJobInputSchema = z.object({
  title: safeText(3, 120),
  objective: safeText(20, 2_000),
  mediaType: z.enum(["image", "video"]),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]),
  durationSeconds: z.number().int().min(5).max(30).nullable(),
  outputCount: z.number().int().min(1).max(4),
  styleNotes: safeText(3, 2_000),
  avoid: safeText(3, 1_000).optional(),
  sourceUrls: z.array(httpsUrlSchema).max(8).default([]),
  providerMode: z.enum(["preview", "higgsfield"]),
}).strict().superRefine((input, context) => {
  if (input.mediaType === "image" && input.durationSeconds !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["durationSeconds"], message: "Для изображения длительность не задаётся" });
  }
  if (input.mediaType === "video" && input.durationSeconds === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["durationSeconds"], message: "Для видео укажите длительность" });
  }
});

const quoteSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("quoted"),
    credits: z.number().nonnegative().finite(),
    source: z.enum(["eclipse-preview", "higgsfield"]),
    statement: safeText(3, 320),
  }).strict(),
  z.object({
    state: z.literal("required"),
    credits: z.null(),
    source: z.literal("higgsfield"),
    statement: safeText(3, 320),
  }).strict(),
]);

const approvalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  decidedAt: z.string().datetime(),
  note: z.string().max(1_000).nullable(),
  rightsConfirmed: z.boolean(),
  briefConfirmed: z.boolean(),
  costConfirmed: z.boolean(),
}).strict();

const executionSchema = z.object({
  provider: z.enum(["eclipse-preview", "higgsfield"]),
  requestId: z.string().uuid(),
  chargedCredits: z.number().nonnegative().finite(),
  outputCount: z.number().int().positive().max(4),
  completedAt: z.string().datetime(),
}).strict();

const artifactSchema = z.object({
  kind: z.literal("brief-package"),
  filename: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}\.json$/),
  contentType: z.literal("application/json"),
}).strict();

export const creativeJobSchema = z.object({
  schemaVersion: z.literal(CREATIVE_JOB_SCHEMA_VERSION),
  id: z.string().uuid(),
  status: z.enum(["awaiting_quote", "awaiting_approval", "approved", "ready", "rejected", "failed"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  input: creativeJobInputSchema,
  quote: quoteSchema,
  approval: approvalSchema.nullable(),
  execution: executionSchema.nullable(),
  artifact: artifactSchema.nullable(),
  policy: z.object({
    externalActions: z.literal(false),
    autoPublish: z.literal(false),
    requiresHumanApproval: z.literal(true),
    sourceContentTrusted: z.literal(false),
  }).strict(),
}).strict().superRefine((job, context) => {
  if (job.status === "awaiting_quote" && job.quote.state !== "required") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["quote"], message: "Ожидающая расчёта задача не может содержать готовую цену" });
  }
  if (["awaiting_approval", "approved", "ready"].includes(job.status) && job.quote.state !== "quoted") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["quote"], message: "Для продолжения требуется точная оценка стоимости" });
  }
  if (["approved", "ready"].includes(job.status) && job.approval?.decision !== "approved") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval"], message: "Выполнение требует подтверждённого approval" });
  }
  if (job.status === "rejected" && job.approval?.decision !== "rejected") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval"], message: "Отклонённая задача должна содержать решение" });
  }
  if (job.status === "ready" && (!job.execution || !job.artifact)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["execution"], message: "Готовая задача должна содержать квитанцию и артефакт" });
  }
});

export type CreativeJobInput = z.infer<typeof creativeJobInputSchema>;
export type CreativeJob = z.infer<typeof creativeJobSchema>;

function safeFilename(title: string): string {
  const slug = title.toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${slug || "creative-brief"}.json`;
}

export function createCreativeJob(input: CreativeJobInput, now = new Date()): CreativeJob {
  const parsed = creativeJobInputSchema.parse(input);
  const timestamp = now.toISOString();
  const preview = parsed.providerMode === "preview";
  return creativeJobSchema.parse({
    schemaVersion: CREATIVE_JOB_SCHEMA_VERSION,
    id: randomUUID(),
    status: preview ? "awaiting_approval" : "awaiting_quote",
    createdAt: timestamp,
    updatedAt: timestamp,
    input: parsed,
    quote: preview
      ? { state: "quoted", credits: 0, source: "eclipse-preview", statement: "Проверочный пакет не вызывает внешнюю модель и не расходует кредиты." }
      : { state: "required", credits: null, source: "higgsfield", statement: "Стоимость должна быть получена из Higgsfield перед подтверждением и запуском." },
    approval: null,
    execution: null,
    artifact: null,
    policy: {
      externalActions: false,
      autoPublish: false,
      requiresHumanApproval: true,
      sourceContentTrusted: false,
    },
  });
}

export type CreativeDecision = {
  decision: "APPROVE" | "REJECT";
  note?: string;
  humanConfirmed?: boolean;
  rightsConfirmed?: boolean;
  costConfirmed?: boolean;
};

export function decideCreativeJob(job: CreativeJob, decision: CreativeDecision, now = new Date()): CreativeJob {
  const current = creativeJobSchema.parse(job);
  if (current.status !== "awaiting_approval") throw new Error("Задача не ожидает подтверждения");
  if (decision.decision === "APPROVE") {
    if (current.quote.state !== "quoted") throw new Error("Сначала получите точную оценку стоимости");
    if (!decision.humanConfirmed || !decision.rightsConfirmed || !decision.costConfirmed) {
      throw new Error("Подтвердите задание, права на материалы и стоимость");
    }
  } else if ((decision.note?.trim().length ?? 0) < 3) {
    throw new Error("Для отклонения укажите причину");
  }
  const timestamp = now.toISOString();
  return creativeJobSchema.parse({
    ...current,
    status: decision.decision === "APPROVE" ? "approved" : "rejected",
    updatedAt: timestamp,
    approval: {
      decision: decision.decision === "APPROVE" ? "approved" : "rejected",
      decidedAt: timestamp,
      note: decision.note?.trim() || null,
      rightsConfirmed: decision.decision === "APPROVE" && decision.rightsConfirmed === true,
      briefConfirmed: decision.decision === "APPROVE" && decision.humanConfirmed === true,
      costConfirmed: decision.decision === "APPROVE" && decision.costConfirmed === true,
    },
  });
}

export function executeCreativePreview(job: CreativeJob, requestId: string, now = new Date()): CreativeJob {
  const current = creativeJobSchema.parse(job);
  if (current.status !== "approved") throw new Error("Сначала подтвердите задачу");
  if (current.input.providerMode !== "preview") throw new Error("Higgsfield выполняется только через проверенный внешний адаптер");
  const timestamp = now.toISOString();
  return creativeJobSchema.parse({
    ...current,
    status: "ready",
    updatedAt: timestamp,
    execution: {
      provider: "eclipse-preview",
      requestId,
      chargedCredits: 0,
      outputCount: 1,
      completedAt: timestamp,
    },
    artifact: {
      kind: "brief-package",
      filename: safeFilename(current.input.title),
      contentType: "application/json",
    },
  });
}

export function creativeJobPackage(job: CreativeJob): string {
  const current = creativeJobSchema.parse(job);
  if (current.status !== "ready" || !current.execution || !current.artifact) {
    throw new Error("Проверочный пакет ещё не готов");
  }
  return JSON.stringify({
    schemaVersion: CREATIVE_PACKAGE_SCHEMA_VERSION,
    sourceJobId: current.id,
    title: current.input.title,
    input: current.input,
    quote: current.quote,
    approval: current.approval,
    execution: current.execution,
    generatedAt: current.execution.completedAt,
  }, null, 2);
}

export function serializeCreativeJob(job: CreativeJob): { payload: string; payloadHash: string } {
  const payload = JSON.stringify(creativeJobSchema.parse(job));
  return { payload, payloadHash: createHash("sha256").update(payload, "utf8").digest("hex") };
}

export function parseStoredCreativeJob(payload: string): CreativeJob {
  if (Buffer.byteLength(payload, "utf8") > 64 * 1024) throw new Error("Creative job payload превышает лимит");
  return creativeJobSchema.parse(JSON.parse(payload) as unknown);
}
