import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * Тесты для bot API key generation pattern (apps/server/src/routes/bots.ts).
 * Inline copy formula here — чтобы избежать import side-effects из routes/bots.ts
 * (он pulls в Prisma client, db setup, fastify deps).
 */

const URL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function generateApiKey(): string {
  const bytes = randomBytes(32);
  let out = "ecb_";
  for (let i = 0; i < 32; i++) {
    out += URL_SAFE[bytes[i] % URL_SAFE.length];
  }
  return out;
}

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
