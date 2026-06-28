import { describe, expect, it } from "vitest";
import {
  normalizeMessageTtl,
  computeMessageExpiry,
  MESSAGE_TTL_MIN_SECONDS,
  MESSAGE_TTL_MAX_SECONDS,
} from "../src/lib/disappearingMessages.js";

const NOW = new Date("2026-06-28T12:00:00.000Z");

describe("normalizeMessageTtl", () => {
  it("null/undefined/≤0 → null (выкл)", () => {
    expect(normalizeMessageTtl(null)).toBeNull();
    expect(normalizeMessageTtl(undefined)).toBeNull();
    expect(normalizeMessageTtl(0)).toBeNull();
    expect(normalizeMessageTtl(-5)).toBeNull();
  });

  it("клампит в [MIN, MAX]", () => {
    expect(normalizeMessageTtl(1)).toBe(MESSAGE_TTL_MIN_SECONDS);
    expect(normalizeMessageTtl(MESSAGE_TTL_MAX_SECONDS * 5)).toBe(MESSAGE_TTL_MAX_SECONDS);
    expect(normalizeMessageTtl(3600)).toBe(3600);
  });
});

describe("computeMessageExpiry (гранулярность «Оба»)", () => {
  it("override undefined → дефолт канала", () => {
    const got = computeMessageExpiry(3600, undefined, NOW);
    expect(got?.getTime()).toBe(NOW.getTime() + 3600 * 1000);
  });

  it("override undefined + канал без TTL → null (постоянное)", () => {
    expect(computeMessageExpiry(null, undefined, NOW)).toBeNull();
  });

  it("override null → сообщение НЕ исчезает, даже если у канала есть TTL", () => {
    expect(computeMessageExpiry(3600, null, NOW)).toBeNull();
  });

  it("override >0 → перебивает дефолт канала", () => {
    const got = computeMessageExpiry(86400, 3600, NOW);
    expect(got?.getTime()).toBe(NOW.getTime() + 3600 * 1000);
  });

  it("override клампится так же, как канал", () => {
    const got = computeMessageExpiry(null, 1, NOW);
    expect(got?.getTime()).toBe(NOW.getTime() + MESSAGE_TTL_MIN_SECONDS * 1000);
  });
});
