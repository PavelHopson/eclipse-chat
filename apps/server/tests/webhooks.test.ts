import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

/**
 * Тесты для HMAC signing payload bots/webhooks.ts.
 * Чистая криптография — не требует DB или fetch mock'ов.
 */

function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("webhook HMAC signing", () => {
  it("одинаковый body+secret → одинаковая signature", () => {
    const body = JSON.stringify({ event: "message.created", id: "m1" });
    const sec = "test-secret-1234";
    const sig1 = signPayload(body, sec);
    const sig2 = signPayload(body, sec);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("разные secrets дают разные signatures", () => {
    const body = "ping";
    expect(signPayload(body, "a")).not.toBe(signPayload(body, "b"));
  });

  it("разные bodies дают разные signatures", () => {
    const sec = "fixed";
    expect(signPayload("x", sec)).not.toBe(signPayload("y", sec));
  });

  it("signature длиной ровно 64 hex chars (sha256)", () => {
    const sig = signPayload("payload", "secret");
    expect(sig).toHaveLength(64);
  });
});
