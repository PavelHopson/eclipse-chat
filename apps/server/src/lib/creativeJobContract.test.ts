import { describe, expect, it } from "vitest";
import {
  creativeJobInputSchema,
  creativeJobPackage,
  createCreativeJob,
  decideCreativeJob,
  executeCreativePreview,
  parseStoredCreativeJob,
  serializeCreativeJob,
} from "./creativeJobContract.js";

const validInput = () => ({
  title: "Вертикальный ролик о продукте",
  objective: "Показать продукт в реальной ситуации и завершить понятным призывом к действию.",
  mediaType: "video" as const,
  aspectRatio: "9:16" as const,
  durationSeconds: 10,
  outputCount: 2,
  styleNotes: "Натуральный свет, спокойная камера, читаемая композиция.",
  avoid: "Без текста в кадре и резких монтажных склеек.",
  sourceUrls: ["https://example.com/product"],
  providerMode: "preview" as const,
});

describe("creative.job.v1", () => {
  it("requires a video duration and rejects credentials in source URLs", () => {
    expect(creativeJobInputSchema.safeParse({ ...validInput(), durationSeconds: null }).success).toBe(false);
    expect(creativeJobInputSchema.safeParse({ ...validInput(), sourceUrls: ["https://user:pass@example.com/file"] }).success).toBe(false);
    expect(creativeJobInputSchema.safeParse({ ...validInput(), sourceUrls: ["http://example.com/file"] }).success).toBe(false);
  });

  it("creates a zero-credit preview quote and requires all approval confirmations", () => {
    const job = createCreativeJob(validInput(), new Date("2026-08-24T10:00:00.000Z"));
    expect(job.status).toBe("awaiting_approval");
    expect(job.quote).toMatchObject({ state: "quoted", credits: 0, source: "eclipse-preview" });
    expect(() => decideCreativeJob(job, { decision: "APPROVE", humanConfirmed: true })).toThrow(/права/i);
    const approved = decideCreativeJob(job, {
      decision: "APPROVE",
      humanConfirmed: true,
      rightsConfirmed: true,
      costConfirmed: true,
    });
    expect(approved.status).toBe("approved");
  });

  it("fails closed for Higgsfield until a provider quote exists", () => {
    const job = createCreativeJob({ ...validInput(), providerMode: "higgsfield" });
    expect(job.status).toBe("awaiting_quote");
    expect(job.quote.state).toBe("required");
    expect(() => decideCreativeJob(job, {
      decision: "APPROVE",
      humanConfirmed: true,
      rightsConfirmed: true,
      costConfirmed: true,
    })).toThrow(/не ожидает подтверждения/i);
  });

  it("produces a bounded downloadable brief package without secrets or remote actions", () => {
    const created = createCreativeJob(validInput(), new Date("2026-08-24T10:00:00.000Z"));
    const approved = decideCreativeJob(created, {
      decision: "APPROVE",
      humanConfirmed: true,
      rightsConfirmed: true,
      costConfirmed: true,
      note: "Проверено",
    }, new Date("2026-08-24T10:01:00.000Z"));
    const completed = executeCreativePreview(
      approved,
      "11111111-1111-4111-8111-111111111111",
      new Date("2026-08-24T10:02:00.000Z"),
    );
    const payload = creativeJobPackage(completed);
    expect(completed.status).toBe("ready");
    expect(completed.execution).toMatchObject({ provider: "eclipse-preview", chargedCredits: 0 });
    expect(payload).toContain('"schemaVersion": "creative.brief-package.v1"');
    expect(payload).not.toMatch(/authorization|cookie|password|private.?key|api.?key/i);
  });

  it("round-trips only the strict stored contract", () => {
    const job = createCreativeJob(validInput());
    const stored = serializeCreativeJob(job);
    expect(stored.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(parseStoredCreativeJob(stored.payload)).toEqual(job);
    expect(() => parseStoredCreativeJob(JSON.stringify({ ...job, unexpected: true }))).toThrow();
  });
});
