import { describe, expect, it } from "vitest";
import { resolveBotSystemPrompt, botRolePrompt } from "../src/ai/botRoles.js";

describe("resolveBotSystemPrompt", () => {
  it("uses override when set", () => {
    const out = resolveBotSystemPrompt("PM", "  Custom prompt  ");
    expect(out).toBe("Custom prompt");
  });

  it("truncates override to 8000 chars", () => {
    const long = "x".repeat(9000);
    expect(resolveBotSystemPrompt("PM", long).length).toBe(8000);
  });

  it("falls back to role template", () => {
    expect(resolveBotSystemPrompt("SALES", null)).toBe(botRolePrompt("SALES"));
  });

  it("uses generic assistant system when provided", () => {
    const assistant = "Channel operator assistant";
    expect(resolveBotSystemPrompt("GENERIC", null, assistant)).toBe(assistant);
  });

  it("override wins over generic assistant fallback", () => {
    expect(resolveBotSystemPrompt("GENERIC", "override", "assistant")).toBe("override");
  });
});
