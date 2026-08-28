import { describe, expect, it } from "vitest";
import { generateApiKey } from "../src/security/botApiKey.js";

describe("bot API key", () => {
  it("format: ecb_ + 32 URL-safe chars (total 36)", () => {
    const k = generateApiKey();
    expect(k).toMatch(/^ecb_[A-Za-z0-9_-]{32}$/);
    expect(k).toHaveLength(36);
  });

  it("uniqueness: 1000 keys без коллизий", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateApiKey());
    expect(set.size).toBe(1000);
  });

  it("prefix ровно 'ecb_'", () => {
    expect(generateApiKey().startsWith("ecb_")).toBe(true);
  });
});
