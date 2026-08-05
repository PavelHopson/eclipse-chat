import { describe, expect, it } from "vitest";
import type { DeckJobPayload } from "./deckJobContract.js";
import { encodeRfc5987Filename, renderDeckPptx } from "./deckPptx.js";

function deck(): DeckJobPayload {
  const at = "2026-08-05T10:00:00.000Z";
  return {
    schemaVersion: "deck.job.v1",
    id: "deck:renderer-test",
    status: "ready_for_review",
    createdAt: at,
    updatedAt: at,
    input: {
      title: "Eclipse / Library: релиз",
      objective: "Показать проверяемый каталог инструментов простым языком",
      audience: "Команда Eclipse Forge",
      format: "project-recap",
      sourceText: "PRIVATE SOURCE TEXT MUST NOT ENTER THE PPTX PACKAGE",
      evidenceUrls: ["https://library.eclipse-forge.ru/"],
    },
    slides: [
      { id: "s1", kind: "cover", title: "Релиз Eclipse Library", bullets: ["Что изменилось"], speakerNotes: "Назвать цель.", sourceRefs: [] },
      { id: "s2", kind: "content", title: "Польза", bullets: ["Текст остаётся редактируемым", "XML escape: </a:t><script>alert('&')</script>"], speakerNotes: "Показать пример.", sourceRefs: ["S1"] },
      { id: "s3", kind: "summary", title: "Дальше", bullets: ["Открыть каталог"], speakerNotes: "", sourceRefs: [] },
    ],
    policy: { externalActions: false, toolsAllowed: false, sourceContentTrusted: false, autoPublishAllowed: false, pptxRendered: false },
    approval: null,
  };
}

function storedEntries(buffer: Buffer): Map<string, string> {
  const result = new Map<string, string>();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    expect(buffer.readUInt16LE(offset + 8)).toBe(0);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    result.set(name, buffer.subarray(dataStart, dataStart + size).toString("utf8"));
    offset = dataStart + size;
  }
  return result;
}

describe("editable deck PPTX renderer", () => {
  it("creates a deterministic bounded OOXML package with editable text and notes", () => {
    const first = renderDeckPptx(deck());
    const second = renderDeckPptx(deck());
    expect(first.buffer.equals(second.buffer)).toBe(true);
    expect(first.buffer.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(first.buffer.length).toBeLessThan(4 * 1024 * 1024);
    expect(first.filename).toBe("Eclipse Library релиз.pptx");

    const entries = storedEntries(first.buffer);
    expect(entries.get("ppt/presentation.xml")).toContain('<p:sldId id="258" r:id="rId5"/>');
    expect(entries.get("ppt/slides/slide2.xml")).toContain("Текст остаётся редактируемым");
    expect(entries.get("ppt/slides/slide2.xml")).toContain("&lt;/a:t&gt;&lt;script&gt;alert(&apos;&amp;&apos;)&lt;/script&gt;");
    expect(entries.get("ppt/notesSlides/notesSlide2.xml")).toContain("Показать пример.");
    expect(entries.get("ppt/notesSlides/notesSlide2.xml")).toContain("https://library.eclipse-forge.ru/");
    expect([...entries.values()].join("\n")).not.toContain("PRIVATE SOURCE TEXT MUST NOT ENTER");
  });

  it("fails closed when a slide cannot fit without hiding content", () => {
    const overloaded = deck();
    overloaded.slides[1]!.bullets = ["Очень длинный тезис ".repeat(100)];
    expect(() => renderDeckPptx(overloaded)).toThrow(/перегружен текстом/i);
  });

  it("encodes non-ASCII download names for Content-Disposition", () => {
    expect(encodeRfc5987Filename("Релиз (август).pptx")).toBe("%D0%A0%D0%B5%D0%BB%D0%B8%D0%B7%20%28%D0%B0%D0%B2%D0%B3%D1%83%D1%81%D1%82%29.pptx");
  });
});
