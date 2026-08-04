import { describe, expect, it } from "vitest";
import { parseDeckIdempotencyKey, parseDeckJobImport, parseStoredDeckJob } from "./deckJobContract.js";

function validDeck() {
  const at = "2026-08-04T10:00:00.000Z";
  return {
    schemaVersion: "deck.job.v1",
    id: "deck:release-1",
    status: "approved",
    createdAt: at,
    updatedAt: at,
    input: {
      title: "Eclipse Library release",
      objective: "Показать проверяемый каталог инструментов",
      audience: "Команда Eclipse Forge",
      format: "project-recap",
      sourceText: "Каталог содержит структурированные записи с лицензиями, ограничениями и официальными источниками.",
      evidenceUrls: ["https://library.eclipse-forge.ru/#release", "https://library.eclipse-forge.ru/#release"],
    },
    slides: [
      { id: "s1", kind: "cover", title: "Релиз", bullets: ["Что изменилось"], speakerNotes: "Назвать цель.", sourceRefs: [] },
      { id: "s2", kind: "content", title: "Польза", bullets: ["Быстрее проверить инструмент"], speakerNotes: "Показать пример.", sourceRefs: ["S1"] },
      { id: "s3", kind: "summary", title: "Дальше", bullets: ["Открыть каталог"], speakerNotes: "", sourceRefs: [] },
    ],
    policy: {
      externalActions: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
      autoPublishAllowed: false,
      pptxRendered: false,
    },
    approval: { claimsVerified: true, rightsConfirmed: true, finalReviewComplete: true, approvedAt: at },
  };
}

describe("deck.job.v1 server contract", () => {
  it("normalizes links and removes the source approval claim", () => {
    const parsed = parseDeckJobImport(validDeck());
    expect(parsed.sourceApprovalClaimed).toBe(true);
    expect(parsed.job.status).toBe("ready_for_review");
    expect(parsed.job.approval).toBeNull();
    expect(parsed.job.input.evidenceUrls).toEqual(["https://library.eclipse-forge.ru/"]);
    expect(parseStoredDeckJob(parsed.payload).slides).toHaveLength(3);
    expect(parsed.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects credentials, unknown fields, unsafe policy and duplicate slide ids", () => {
    const credential = validDeck();
    credential.input.evidenceUrls = ["https://user:pass@example.com/"];
    expect(() => parseDeckJobImport(credential)).toThrow(/HTTPS|credentials/i);
    expect(() => parseDeckJobImport({ ...validDeck(), apiKey: "secret" })).toThrow(/Unrecognized key/i);
    const unsafe = validDeck();
    unsafe.policy.toolsAllowed = true;
    expect(() => parseDeckJobImport(unsafe)).toThrow(/toolsAllowed/i);
    const duplicate = validDeck();
    duplicate.slides[1].id = duplicate.slides[0].id;
    expect(() => parseDeckJobImport(duplicate)).toThrow(/уникальными/i);
  });

  it("accepts only stable idempotency keys", () => {
    expect(parseDeckIdempotencyKey("deck:release:1")).toBe("deck:release:1");
    expect(parseDeckIdempotencyKey("short")).toBeNull();
    expect(parseDeckIdempotencyKey("deck key")).toBeNull();
  });
});
