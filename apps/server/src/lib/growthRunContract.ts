import { createHash } from "node:crypto";
import { z } from "zod";

export const GROWTH_STEP_DEFINITIONS = [
  { step: "research", role: "Researcher" },
  { step: "strategy", role: "Strategist" },
  { step: "draft", role: "Writer" },
  { step: "claims", role: "Claim Auditor" },
  { step: "final", role: "Editor" },
] as const;

export const MAX_GROWTH_IMPORT_BYTES = 96 * 1024;
export const MAX_PENDING_GROWTH_RUNS_PER_OPERATOR = 20;

const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const identifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

const evidenceCardIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

function boundedText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !controlCharacters.test(value), "Управляющие символы запрещены");
}

const httpsUrlSchema = z.string().max(2048).transform((raw, context) => {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Разрешены только HTTPS-ссылки без логина и пароля",
      });
      return z.NEVER;
    }
    url.hash = "";
    return url.toString();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная ссылка" });
    return z.NEVER;
  }
});

const growthArtifactSchema = z
  .object({
    step: z.enum(["research", "strategy", "draft", "claims", "final"]),
    role: boundedText(1, 80),
    content: boundedText(40, 16_000),
    createdAt: z.string().datetime(),
  })
  .strict();

const sourceApprovalSchema = z
  .object({
    approvedAt: z.string().datetime(),
    humanConfirmed: z.literal(true),
  })
  .strict();

const evidenceCardSchema = z
  .object({
    id: evidenceCardIdSchema,
    claim: boundedText(5, 500),
    state: z.enum(["verified", "hypothesis", "planned", "unknown", "rejected"]),
    sourceUrl: httpsUrlSchema.nullable(),
    evidenceBoundary: boundedText(5, 1_000),
  })
  .strict();

export const growthInputSchema = z
  .object({
    releaseName: boundedText(3, 120),
    releaseSummary: boundedText(20, 2_000),
    audience: boundedText(3, 240),
    channel: z.enum(["telegram", "linkedin", "blog"]),
    sourceUrls: z.array(httpsUrlSchema).min(1).max(8).transform((urls) => [...new Set(urls)]),
    evidenceNotes: boundedText(20, 12_000),
    evidenceCards: z.array(evidenceCardSchema).min(1).max(20).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (!input.evidenceCards) return;
    const sourceUrls = new Set(input.sourceUrls);
    const ids = new Set<string>();
    input.evidenceCards.forEach((card, index) => {
      if (ids.has(card.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidenceCards", index, "id"],
          message: "Evidence Card id должен быть уникальным",
        });
      }
      ids.add(card.id);
      if (card.sourceUrl && !sourceUrls.has(card.sourceUrl)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidenceCards", index, "sourceUrl"],
          message: "Источник Evidence Card должен входить в sourceUrls",
        });
      }
      if (card.state === "verified" && !card.sourceUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidenceCards", index, "sourceUrl"],
          message: "Verified Evidence Card требует sourceUrl",
        });
      }
    });
  });

function validateExecutedArtifactContent(
  content: string,
  step: typeof GROWTH_STEP_DEFINITIONS[number]["step"],
  usesEvidenceCards: boolean,
): string {
  const normalized = boundedText(40, 16_000).parse(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("AI Hub вернул Growth artifact вне typed JSON contract");
  }
  const expected = `growth.${step}.${usesEvidenceCards && ["research", "claims"].includes(step) ? "v2" : "v1"}`;
  const schemaVersion = z.object({ schemaVersion: z.literal(expected) }).passthrough().safeParse(parsed);
  if (!schemaVersion.success) {
    throw new Error(`AI Hub вернул artifact вне ожидаемой schema ${expected}`);
  }
  return normalized;
}

const growthRunSchema = z
  .object({
    schemaVersion: z.literal("growth.run.v1"),
    id: identifierSchema,
    status: z.enum(["draft", "in_progress", "ready_for_approval", "approved"]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    input: growthInputSchema,
    execution: z
      .object({
        provider: boundedText(2, 80),
        model: boundedText(1, 160),
        maxRequests: z.literal(5),
        completedRequests: z.number().int().min(0).max(5),
        cost: z.literal("provider-dependent"),
      })
      .strict(),
    policy: z
      .object({
        externalActions: z.literal(false),
        publishAllowed: z.literal(false),
        toolsAllowed: z.literal(false),
        sourceContentTrusted: z.literal(false),
      })
      .strict(),
    artifacts: z.array(growthArtifactSchema).max(GROWTH_STEP_DEFINITIONS.length),
    approval: sourceApprovalSchema.nullable(),
  })
  .strict()
  .superRefine((run, context) => {
    run.artifacts.forEach((artifact, index) => {
      const expected = GROWTH_STEP_DEFINITIONS[index];
      if (artifact?.step !== expected.step || artifact.role !== expected.role) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["artifacts", index],
          message: `Ожидается шаг ${expected.step} роли ${expected.role}`,
        });
      }
    });
    if (run.execution.completedRequests !== run.artifacts.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["execution", "completedRequests"],
        message: "completedRequests должен совпадать с количеством артефактов",
      });
    }
    const expectedStatus = run.artifacts.length === 0
      ? "draft"
      : run.artifacts.length < GROWTH_STEP_DEFINITIONS.length
        ? "in_progress"
        : null;
    if (expectedStatus && run.status !== expectedStatus) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: `Для ${run.artifacts.length} выполненных шагов ожидается статус ${expectedStatus}`,
      });
    }
    if (!expectedStatus && !["ready_for_approval", "approved"].includes(run.status)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "После пяти шагов материал должен ожидать approval или быть approved",
      });
    }
    if (run.status === "approved" && !run.approval) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approval"],
        message: "Approved export должен содержать исходное подтверждение",
      });
    }
    if (run.status === "ready_for_approval" && run.approval !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approval"],
        message: "Непроверенный export не может содержать approval",
      });
    }
    if (new Date(run.updatedAt).getTime() < new Date(run.createdAt).getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["updatedAt"],
        message: "updatedAt не может быть раньше createdAt",
      });
    }
  });

export type GrowthRunPayload = z.infer<typeof growthRunSchema>;
export type GrowthRunInput = z.infer<typeof growthInputSchema>;

export type ParsedGrowthRunImport = {
  run: GrowthRunPayload;
  payload: string;
  payloadHash: string;
  sourceApprovalClaimed: boolean;
};

export function parseGrowthRunImport(raw: unknown): ParsedGrowthRunImport {
  const rawJson = JSON.stringify(raw);
  if (Buffer.byteLength(rawJson, "utf8") > MAX_GROWTH_IMPORT_BYTES) {
    throw new Error("Growth export превышает лимит 96 КБ");
  }

  const parsed = growthRunSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.length ? `${first.path.join(".")}: ` : "";
    throw new Error(`${path}${first?.message ?? "Некорректный growth.run.v1"}`);
  }
  if (parsed.data.artifacts.length !== GROWTH_STEP_DEFINITIONS.length
    || !["ready_for_approval", "approved"].includes(parsed.data.status)) {
    throw new Error("Импортировать можно только завершённый growth.run.v1");
  }

  const sourceApprovalClaimed = parsed.data.status === "approved";
  const run: GrowthRunPayload = {
    ...parsed.data,
    // Chat owns its own review gate and never trusts an imported approval claim.
    status: "ready_for_approval",
    approval: null,
    input: {
      ...parsed.data.input,
      sourceUrls: [...new Set(parsed.data.input.sourceUrls)],
    },
  };
  const payload = JSON.stringify(run);
  return {
    run,
    payload,
    payloadHash: createHash("sha256").update(payload).digest("hex"),
    sourceApprovalClaimed,
  };
}

export function createGrowthRunPayload(
  input: GrowthRunInput,
  id: string,
  options: { provider: string; model: string; now?: Date },
): GrowthRunPayload {
  const parsedInput = growthInputSchema.parse(input);
  const timestamp = (options.now ?? new Date()).toISOString();
  return growthRunSchema.parse({
    schemaVersion: "growth.run.v1",
    id,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    input: parsedInput,
    execution: {
      provider: options.provider,
      model: options.model,
      maxRequests: 5,
      completedRequests: 0,
      cost: "provider-dependent",
    },
    policy: {
      externalActions: false,
      publishAllowed: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
    },
    artifacts: [],
    approval: null,
  });
}

export function appendGrowthArtifact(
  run: GrowthRunPayload,
  result: { step: string; role: string; content: string; provider: string; model: string },
  now = new Date(),
): GrowthRunPayload {
  const expected = GROWTH_STEP_DEFINITIONS[run.artifacts.length];
  if (!expected || result.step !== expected.step || result.role !== expected.role) {
    throw new Error("AI Hub вернул шаг вне очереди Growth OS");
  }
  const timestamp = now.toISOString();
  const content = validateExecutedArtifactContent(
    result.content,
    expected.step,
    Boolean(run.input.evidenceCards?.length),
  );
  const artifacts = [...run.artifacts, {
    step: expected.step,
    role: expected.role,
    content,
    createdAt: timestamp,
  }];
  return growthRunSchema.parse({
    ...run,
    status: artifacts.length === GROWTH_STEP_DEFINITIONS.length ? "ready_for_approval" : "in_progress",
    updatedAt: timestamp,
    execution: {
      ...run.execution,
      provider: result.provider,
      model: result.model,
      completedRequests: artifacts.length,
    },
    artifacts,
    approval: null,
  });
}

export function parseStoredGrowthRun(payload: string): GrowthRunPayload {
  const parsed = growthRunSchema.safeParse(JSON.parse(payload) as unknown);
  if (!parsed.success) {
    throw new Error("Stored growth.run.v1 failed validation");
  }
  return parsed.data;
}

export function parseGrowthIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(value) ? value : null;
}
