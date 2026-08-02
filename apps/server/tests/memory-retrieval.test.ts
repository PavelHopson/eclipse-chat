import { describe, expect, it } from "vitest";
import {
  combineRetrievalScores,
  parseMemoryTags,
  rankMemoryLexical,
  scoreMemoryLexical,
  tokenizeRetrievalQuery,
} from "../src/ai/memoryRetrieval.js";

describe("memory retrieval", () => {
  it("normalizes and bounds query tokens", () => {
    expect(tokenizeRetrievalQuery("  Auth, AUTH и архитектура API  ")).toEqual([
      "auth",
      "архитектура",
      "api",
    ]);
  });

  it("prefers title and tag matches over body-only matches", () => {
    const title = scoreMemoryLexical("auth architecture", {
      id: "title",
      title: "Auth architecture",
      content: null,
      tags: ["backend"],
    });
    const body = scoreMemoryLexical("auth architecture", {
      id: "body",
      title: "Notes",
      content: "We discussed auth architecture yesterday.",
      tags: [],
    });
    expect(title).toBeGreaterThan(body);
  });

  it("ignores malformed persisted tags", () => {
    expect(parseMemoryTags("not-json")).toEqual([]);
    expect(parseMemoryTags('["api", 12, " security "]')).toEqual([
      "api",
      "security",
    ]);
  });

  it("returns only matching candidates in relevance order", () => {
    const ranked = rankMemoryLexical(
      "release risk",
      [
        { id: "a", title: "Release risk", content: null, tags: [] },
        { id: "b", title: "Release notes", content: "Possible risk", tags: [] },
        { id: "c", title: "Lunch", content: null, tags: [] },
      ],
      10,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("labels combined semantic and lexical evidence as hybrid", () => {
    expect(combineRetrievalScores(0.6, 0.8)).toEqual({
      score: 0.744,
      matchMode: "hybrid",
    });
    expect(combineRetrievalScores(0.4, null)).toEqual({
      score: 0.4,
      matchMode: "lexical",
    });
  });
});
