import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  PASSWORD_HASH_COST,
} from "../src/security/temporaryPassword.js";

const SAFE_TEMP_PASSWORD =
  /^[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/;

describe("temporary password", () => {
  it("uses the project bcrypt cost", () => {
    expect(PASSWORD_HASH_COST).toBe(12);
  });

  it("generates 16 safe, unambiguous characters", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateTemporaryPassword()).toMatch(SAFE_TEMP_PASSWORD);
    }
  });

  it("does not repeat values in a small operational sample", () => {
    const values = new Set(
      Array.from({ length: 50 }, () => generateTemporaryPassword()),
    );
    expect(values.size).toBe(50);
  });
});
