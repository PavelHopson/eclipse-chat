import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_DECK_IMPORT_BYTES = 128 * 1024;
export const MAX_PENDING_DECK_REVIEWS_PER_OPERATOR = 20;
const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function boundedText(min: number, max: number) {
  return z.string().trim().min(min).max(max).refine(
    (value) => !controlCharacters.test(value),
    "Управляющие символы запрещены",
  );
}

const identifierSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const httpsUrlSchema = z.string().max(480).transform((raw, context) => {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Разрешён только HTTPS без credentials" });
      return z.NEVER;
    }
    url.hash = "";
    return url.toString();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная ссылка" });
    return z.NEVER;
  }
});

const deckSlideSchema = z.object({
  id: boundedText(1, 256),
  kind: z.enum(["cover", "content", "evidence", "summary"]),
  title: boundedText(2, 120),
  bullets: z.array(boundedText(2, 500)).min(1).max(8),
  speakerNotes: boundedText(0, 2_000),
  sourceRefs: z.array(boundedText(1, 32)).max(12).transform((refs) => [...new Set(refs)]),
}).strict();

const deckInputSchema = z.object({
  title: boundedText(3, 120),
  objective: boundedText(10, 500),
  audience: boundedText(3, 240),
  format: z.enum(["project-recap", "lesson", "pitch"]),
  sourceText: boundedText(40, 60_000),
  evidenceUrls: z.array(httpsUrlSchema).max(12).transform((urls) => [...new Set(urls)]),
}).strict();

const deckPolicySchema = z.object({
  externalActions: z.literal(false),
  toolsAllowed: z.literal(false),
  sourceContentTrusted: z.literal(false),
  autoPublishAllowed: z.literal(false),
  pptxRendered: z.literal(false),
}).strict();

const deckApprovalSchema = z.object({
  claimsVerified: z.literal(true),
  rightsConfirmed: z.literal(true),
  finalReviewComplete: z.literal(true),
  approvedAt: z.string().datetime(),
}).strict();

const deckJobSchema = z.object({
  schemaVersion: z.literal("deck.job.v1"),
  id: identifierSchema,
  status: z.enum(["draft", "ready_for_review", "approved"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  input: deckInputSchema,
  slides: z.array(deckSlideSchema).min(3).max(20),
  policy: deckPolicySchema,
  approval: deckApprovalSchema.nullable(),
}).strict().superRefine((job, context) => {
  if (new Set(job.slides.map((slide) => slide.id)).size !== job.slides.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["slides"], message: "ID слайдов должны быть уникальными" });
  }
  if (job.status === "approved" && !job.approval) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval"], message: "Approved deck должен содержать approval" });
  }
  if (job.status !== "approved" && job.approval !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["approval"], message: "Неутверждённый deck не может содержать approval" });
  }
  if (new Date(job.updatedAt).getTime() < new Date(job.createdAt).getTime()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["updatedAt"], message: "updatedAt раньше createdAt" });
  }
});

export type DeckJobPayload = z.infer<typeof deckJobSchema>;

export type ParsedDeckJobImport = {
  job: DeckJobPayload;
  payload: string;
  payloadHash: string;
  sourceApprovalClaimed: true;
};

export function parseDeckJobImport(raw: unknown): ParsedDeckJobImport {
  const rawJson = JSON.stringify(raw);
  if (Buffer.byteLength(rawJson, "utf8") > MAX_DECK_IMPORT_BYTES) throw new Error("Deck export превышает лимит 128 КБ");
  const parsed = deckJobSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.length ? `${first.path.join(".")}: ` : "";
    throw new Error(`${path}${first?.message ?? "Некорректный deck.job.v1"}`);
  }
  if (parsed.data.status !== "approved" || !parsed.data.approval) {
    throw new Error("Импортировать можно только утверждённый deck.job.v1");
  }
  const job: DeckJobPayload = { ...parsed.data, status: "ready_for_review", approval: null };
  const payload = JSON.stringify(job);
  return {
    job,
    payload,
    payloadHash: createHash("sha256").update(payload).digest("hex"),
    sourceApprovalClaimed: true,
  };
}

export function parseStoredDeckJob(payload: string): DeckJobPayload {
  const parsed = deckJobSchema.safeParse(JSON.parse(payload) as unknown);
  if (!parsed.success) throw new Error("Stored deck.job.v1 failed validation");
  return parsed.data;
}

export function parseDeckIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(value) ? value : null;
}
