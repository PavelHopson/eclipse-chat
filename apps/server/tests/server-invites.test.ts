import { describe, expect, it } from "vitest";
import {
  inviteRejectReason,
  isInviteJoinable,
  resolveInviteExpiry,
  resolveInviteMaxUses,
  generateInviteCode,
  INVITE_MIN_AGE_SECONDS,
  INVITE_MAX_AGE_SECONDS,
  INVITE_MAX_USES_CAP,
  type InviteState,
} from "../src/lib/serverInvites.js";

const NOW = new Date("2026-06-28T12:00:00.000Z");
const base: InviteState = { maxUses: null, uses: 0, expiresAt: null, revokedAt: null };

describe("inviteRejectReason", () => {
  it("бессрочный неотозванный без лимита → валиден", () => {
    expect(inviteRejectReason(base, NOW)).toBeNull();
    expect(isInviteJoinable(base, NOW)).toBe(true);
  });

  it("отозванный → revoked (приоритет над прочим)", () => {
    expect(inviteRejectReason({ ...base, revokedAt: NOW }, NOW)).toBe("revoked");
  });

  it("expiresAt в прошлом/ровно сейчас → expired", () => {
    const past = new Date(NOW.getTime() - 1000);
    expect(inviteRejectReason({ ...base, expiresAt: past }, NOW)).toBe("expired");
    expect(inviteRejectReason({ ...base, expiresAt: NOW }, NOW)).toBe("expired");
  });

  it("expiresAt в будущем → валиден", () => {
    const future = new Date(NOW.getTime() + 1000);
    expect(inviteRejectReason({ ...base, expiresAt: future }, NOW)).toBeNull();
  });

  it("uses >= maxUses → exhausted", () => {
    expect(inviteRejectReason({ ...base, maxUses: 1, uses: 1 }, NOW)).toBe("exhausted");
    expect(inviteRejectReason({ ...base, maxUses: 5, uses: 4 }, NOW)).toBeNull();
  });
});

describe("resolveInviteExpiry", () => {
  it("null/undefined → бессрочный (null)", () => {
    expect(resolveInviteExpiry(null, NOW)).toBeNull();
    expect(resolveInviteExpiry(undefined, NOW)).toBeNull();
  });

  it("клампит ниже минимума к INVITE_MIN_AGE_SECONDS", () => {
    const got = resolveInviteExpiry(1, NOW);
    expect(got?.getTime()).toBe(NOW.getTime() + INVITE_MIN_AGE_SECONDS * 1000);
  });

  it("клампит выше максимума к INVITE_MAX_AGE_SECONDS", () => {
    const got = resolveInviteExpiry(INVITE_MAX_AGE_SECONDS * 10, NOW);
    expect(got?.getTime()).toBe(NOW.getTime() + INVITE_MAX_AGE_SECONDS * 1000);
  });

  it("значение в диапазоне сохраняется", () => {
    const got = resolveInviteExpiry(3600, NOW);
    expect(got?.getTime()).toBe(NOW.getTime() + 3600 * 1000);
  });
});

describe("resolveInviteMaxUses", () => {
  it("null/undefined → без лимита", () => {
    expect(resolveInviteMaxUses(null)).toBeNull();
    expect(resolveInviteMaxUses(undefined)).toBeNull();
  });

  it("клампит в [1, CAP]", () => {
    expect(resolveInviteMaxUses(0)).toBe(1);
    expect(resolveInviteMaxUses(-5)).toBe(1);
    expect(resolveInviteMaxUses(INVITE_MAX_USES_CAP + 999)).toBe(INVITE_MAX_USES_CAP);
    expect(resolveInviteMaxUses(10)).toBe(10);
  });
});

describe("generateInviteCode", () => {
  it("url-safe, непустой, уникальный между вызовами", () => {
    const a = generateInviteCode();
    const b = generateInviteCode();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a).not.toBe(b);
  });
});
