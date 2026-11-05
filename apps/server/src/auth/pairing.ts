import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const PAIRING_TTL_MS = 90_000;
export const PAIRING_CODE_ATTEMPT_LIMIT = 5;
export const PAIRING_EXCHANGE_ATTEMPT_LIMIT = 5;
export const PAIRING_CREATE_LIMIT = 5;
export const PAIRING_RATE_WINDOW_MS = 60_000;
export const PAIRING_MAX_CHALLENGES = 2_048;
export const PAIRING_MAX_RATE_WINDOWS = 4_096;

type PairingStatus = "pending" | "approved" | "consumed" | "revoked";

type PairingChallenge = {
  handle: string;
  targetKeyDigest: string;
  codeDigest: string;
  expiresAt: number;
  createdAt: number;
  status: PairingStatus;
  approvedByUserId: string | null;
  codeAttempts: number;
  exchangeAttempts: number;
};

type RateWindow = { startedAt: number; count: number };

export type PairingErrorCode =
  | "not_found"
  | "expired"
  | "revoked"
  | "consumed"
  | "invalid_code"
  | "rate_limited"
  | "not_approved"
  | "target_mismatch"
  | "not_approver";

export class PairingError extends Error {
  constructor(public readonly code: PairingErrorCode) {
    super(code);
    this.name = "PairingError";
  }
}

export type PairingChallengeView = {
  handle: string;
  code: string;
  expiresAt: string;
};

export type PairingExchangeResult = {
  status: "exchanged";
  consumedAt: string;
  targetKeyBound: true;
  sessionTransfer: "not_issued";
};

/** Keep the opaque handle useful for correlation without exposing its value. */
export function maskPairingHandle(handle: string): string {
  return `pairing:${createHash("sha256").update(handle, "utf8").digest("hex").slice(0, 12)}`;
}

/**
 * Ephemeral QR-pairing state. This is intentionally an in-memory contract
 * until the auth/session owner defines durable storage and token issuance.
 * The handle and target key are never logged or returned after creation.
 */
export class InMemoryPairingStore {
  private readonly challenges = new Map<string, PairingChallenge>();
  private readonly createWindows = new Map<string, RateWindow>();
  private readonly now: () => number;
  private readonly maxChallenges: number;

  constructor(now: () => number = () => Date.now(), options: { maxChallenges?: number } = {}) {
    this.now = now;
    const requestedMax = options.maxChallenges;
    this.maxChallenges = Number.isFinite(requestedMax)
      ? Math.max(1, Math.floor(requestedMax as number))
      : PAIRING_MAX_CHALLENGES;
  }

  get challengeCount(): number {
    return this.challenges.size;
  }

  create(targetKey: string, sourceKey: string): PairingChallengeView {
    const now = this.now();
    this.prune(now);
    this.assertRate(sourceKey);
    this.evictOldestUntilCapacity();

    const handle = randomBytes(24).toString("base64url");
    const code = String(randomInt(100000, 1000000));
    this.challenges.set(handle, {
      handle,
      targetKeyDigest: digest(targetKey),
      codeDigest: digest(code),
      expiresAt: now + PAIRING_TTL_MS,
      createdAt: now,
      status: "pending",
      approvedByUserId: null,
      codeAttempts: 0,
      exchangeAttempts: 0,
    });

    return { handle, code, expiresAt: new Date(now + PAIRING_TTL_MS).toISOString() };
  }

  approve(handle: string, code: string, userId: string): void {
    const challenge = this.lookup(handle);
    this.ensureUsable(challenge);
    if (challenge.status !== "pending") {
      throw new PairingError(challenge.status === "consumed" ? "consumed" : "revoked");
    }
    if (challenge.codeAttempts >= PAIRING_CODE_ATTEMPT_LIMIT) {
      challenge.status = "revoked";
      throw new PairingError("rate_limited");
    }
    challenge.codeAttempts += 1;
    if (!digestEquals(code, challenge.codeDigest)) {
      if (challenge.codeAttempts >= PAIRING_CODE_ATTEMPT_LIMIT) challenge.status = "revoked";
      throw new PairingError(challenge.codeAttempts >= PAIRING_CODE_ATTEMPT_LIMIT ? "rate_limited" : "invalid_code");
    }
    challenge.status = "approved";
    challenge.approvedByUserId = userId;
  }

  exchange(handle: string, targetKey: string): PairingExchangeResult {
    const challenge = this.lookup(handle);
    this.ensureUsable(challenge);
    if (challenge.status === "consumed") throw new PairingError("consumed");
    if (challenge.status === "revoked") throw new PairingError("revoked");
    if (challenge.status !== "approved") throw new PairingError("not_approved");
    if (challenge.exchangeAttempts >= PAIRING_EXCHANGE_ATTEMPT_LIMIT) {
      challenge.status = "revoked";
      throw new PairingError("rate_limited");
    }
    challenge.exchangeAttempts += 1;
    if (!digestEquals(targetKey, challenge.targetKeyDigest)) {
      if (challenge.exchangeAttempts >= PAIRING_EXCHANGE_ATTEMPT_LIMIT) challenge.status = "revoked";
      throw new PairingError(challenge.exchangeAttempts >= PAIRING_EXCHANGE_ATTEMPT_LIMIT ? "rate_limited" : "target_mismatch");
    }
    challenge.status = "consumed";
    return { status: "exchanged", consumedAt: new Date(this.now()).toISOString(), targetKeyBound: true, sessionTransfer: "not_issued" };
  }

  revoke(handle: string, userId: string): void {
    const challenge = this.lookup(handle);
    this.ensureUsable(challenge);
    if (challenge.approvedByUserId !== userId) throw new PairingError("not_approver");
    if (challenge.status === "consumed") throw new PairingError("consumed");
    challenge.status = "revoked";
  }

  private lookup(handle: string): PairingChallenge {
    const challenge = this.challenges.get(handle);
    if (!challenge) throw new PairingError("not_found");
    // Map insertion order is our bounded LRU order. Touching a challenge keeps
    // an active flow from being evicted before an idle one at the cap.
    this.challenges.delete(handle);
    this.challenges.set(handle, challenge);
    return challenge;
  }

  private ensureUsable(challenge: PairingChallenge): void {
    if (this.now() >= challenge.expiresAt) {
      challenge.status = "revoked";
      throw new PairingError("expired");
    }
  }

  private assertRate(sourceKey: string): void {
    const now = this.now();
    const current = this.createWindows.get(sourceKey);
    if (!current || now - current.startedAt >= PAIRING_RATE_WINDOW_MS) {
      while (this.createWindows.size >= PAIRING_MAX_RATE_WINDOWS) {
        const oldest = this.createWindows.keys().next().value;
        if (typeof oldest !== "string") break;
        this.createWindows.delete(oldest);
      }
      this.createWindows.set(sourceKey, { startedAt: now, count: 1 });
      return;
    }
    if (current.count >= PAIRING_CREATE_LIMIT) throw new PairingError("rate_limited");
    current.count += 1;
  }

  private prune(now: number): void {
    for (const [handle, challenge] of this.challenges) {
      if (now - challenge.createdAt > PAIRING_TTL_MS * 2) this.challenges.delete(handle);
    }
    for (const [sourceKey, window] of this.createWindows) {
      if (now - window.startedAt >= PAIRING_RATE_WINDOW_MS) this.createWindows.delete(sourceKey);
    }
  }

  private evictOldestUntilCapacity(): void {
    while (this.challenges.size >= this.maxChallenges) {
      const oldest = this.challenges.keys().next().value;
      if (typeof oldest !== "string") return;
      this.challenges.delete(oldest);
    }
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function digestEquals(value: string, expectedHexDigest: string): boolean {
  const actual = Buffer.from(digest(value), "hex");
  const expected = Buffer.from(expectedHexDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
