import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomInt } from "node:crypto";

vi.mock("node:crypto", async (original) => ({
  ...await original<typeof import("node:crypto")>(),
  randomInt: vi.fn((max: number) => max - 1),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async (code: string) => "hash:" + code) } }));

import { generateTemporaryPassword } from "../src/security/temporaryPassword.js";
import { generateRecoveryCodes } from "../src/security/twoFactor.js";

describe("unbiased credential sampling", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses crypto.randomInt for every temporary-password symbol", () => {
    expect(generateTemporaryPassword()).toBe("9".repeat(16));
    expect(randomInt).toHaveBeenCalledTimes(16);
    for (const call of vi.mocked(randomInt).mock.calls) expect(call[0]).toBe(56);
  });
  it("uses crypto.randomInt for every recovery-code symbol without changing format", async () => {
    const result = await generateRecoveryCodes();
    expect(result.plain).toEqual(Array(10).fill("99999-99999"));
    expect(randomInt).toHaveBeenCalledTimes(100);
    expect(JSON.parse(result.hashedJson)).toHaveLength(10);
  });
});
