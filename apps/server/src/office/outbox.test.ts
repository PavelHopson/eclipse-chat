import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DurableOfficeEventError } from "./durableEventStore.js";
import { stableCanonicalJson } from "./ingestAuth.js";
import {
  buildOfficeJournalStatus,
  dispatchOfficeEventOutboxWithStore,
  enqueueOfficeEventOutboxWithClient,
  normalizedDispatcherErrorCode,
  redriveOfficeEventOutboxDeadLettersWithStore,
} from "./outbox.js";

const input = {
  workspaceId: "workspace-1",
  type: "task.created" as const,
  subject: { kind: "task" as const, id: "task-1" },
  summary: "Task created",
  metadata: { departmentId: "growth" },
};

function row(overrides: Partial<{
  id: string;
  serverId: string;
  producerId: string;
  payload: string;
  requestDigest: string;
  attempts: number;
  redriveCount: number;
  discardedAt: Date | null;
  lastErrorCode: string | null;
}> = {}) {
  const payload = JSON.stringify({
    metadata: input.metadata,
    subject: input.subject,
    summary: input.summary,
    type: input.type,
    workspaceId: input.workspaceId,
  });
  return {
    id: "11111111-1111-4111-8111-111111111111",
    serverId: input.workspaceId,
    producerId: "growth-command-room",
    payload,
    requestDigest: createHash("sha256").update(payload).digest("hex"),
    attempts: 0,
    redriveCount: 0,
    ...overrides,
  };
}

function storeWith(rows: ReturnType<typeof row>[]) {
  return {
    findMany: vi.fn(async () => rows),
    updateMany: vi.fn(async (_args: unknown) => ({ count: 1 })),
  };
}

describe("Office journal status projection", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  it("is ready when the outbox is empty", () => {
    expect(buildOfficeJournalStatus({ cursor: 12n, pending: 0, oldest: null, deadLetters: 0, now })).toEqual({
      schemaVersion: "office.status.v1",
      status: "ready",
      cursor: 12,
      outbox: { state: "idle", pending: 0, hasDeadLetters: false },
    });
  });

  it("degrades on stalled work, dead letters, or an unsafe cursor", () => {
    expect(buildOfficeJournalStatus({
      cursor: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      pending: 2,
      oldest: new Date(now.getTime() - 10 * 60_000),
      deadLetters: 1,
      now,
    })).toEqual({
      schemaVersion: "office.status.v1",
      status: "degraded",
      cursor: 0,
      outbox: { state: "stalled", pending: 2, hasDeadLetters: true },
    });
  });
});

describe("Office transactional outbox", () => {
  it("canonicalizes and validates an event before enqueue", async () => {
    const create = vi.fn(async (_args: unknown) => ({ id: "outbox-1" }));
    const client = { officeEventOutbox: { create } } as never;

    await expect(enqueueOfficeEventOutboxWithClient(client, {
      producerId: "growth-command-room",
      input,
    })).resolves.toBe("outbox-1");

    const data = (create.mock.calls[0]?.[0] as { data: Record<string, string> }).data;
    expect(data).toMatchObject({
      serverId: input.workspaceId,
      producerId: "growth-command-room",
    });
    expect(data.payload).toBe(stableCanonicalJson(input));
    expect(data.requestDigest).toBe(createHash("sha256").update(data.payload).digest("hex"));
  });

  it("delivers with a stable replay tuple and marks the row delivered", async () => {
    const queued = row();
    const store = storeWith([queued]);
    const append = vi.fn(async () => ({ events: [], replayed: false }));
    const now = new Date("2026-08-23T12:00:00.000Z");

    await expect(dispatchOfficeEventOutboxWithStore(store, append, { now })).resolves.toEqual({
      scanned: 1,
      delivered: 1,
      deferred: 0,
      discarded: 0,
      unavailable: false,
    });

    expect(store.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ attempts: 0 }),
      data: expect.objectContaining({
        claimToken: expect.any(String),
        attempts: { increment: 1 },
        claimUntil: expect.any(Date),
      }),
    }));
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: queued.serverId,
      producerId: queued.producerId,
      replay: expect.objectContaining({
        keyId: "internal-office-outbox",
        nonce: queued.id,
        requestDigest: queued.requestDigest,
      }),
      now,
    }));
    expect(store.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deliveredAt: now, lastErrorCode: null }),
    }));
  });

  it("allows only one dispatcher to claim a row at a time", async () => {
    const queued = row();
    let activeClaim: string | null = null;
    let releaseAppend!: () => void;
    const appendGate = new Promise<void>((resolve) => { releaseAppend = resolve; });
    const store = {
      findMany: vi.fn(async () => [queued]),
      updateMany: vi.fn(async (args: {
        where: { claimToken?: string };
        data: { claimToken?: string | null; claimUntil?: Date | null; deliveredAt?: Date };
      }) => {
        if (typeof args.data.claimToken === "string" && args.data.claimUntil instanceof Date) {
          if (activeClaim) return { count: 0 };
          activeClaim = args.data.claimToken;
          return { count: 1 };
        }
        if (args.where.claimToken === activeClaim && args.data.deliveredAt) {
          activeClaim = null;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    };
    const append = vi.fn(async () => { await appendGate; return { events: [], replayed: false }; });
    const first = dispatchOfficeEventOutboxWithStore(store as never, append);
    await vi.waitFor(() => expect(append).toHaveBeenCalledTimes(1));

    const second = await dispatchOfficeEventOutboxWithStore(store as never, append);
    expect(second.delivered).toBe(0);
    expect(append).toHaveBeenCalledTimes(1);

    releaseAppend();
    await expect(first).resolves.toMatchObject({ delivered: 1 });
  });
  it("defers transient delivery failures without persisting exception text", async () => {
    const store = storeWith([row()]);
    const append = vi.fn(async () => { throw new Error("postgres://user:password@internal/db"); });
    const now = new Date("2026-08-23T12:00:00.000Z");

    const report = await dispatchOfficeEventOutboxWithStore(store, append, { now });
    expect(report).toMatchObject({ deferred: 1, discarded: 0 });
    const updateCall = store.updateMany.mock.calls.find((call) =>
      (call[0] as { data?: { lastErrorCode?: string } }).data?.lastErrorCode === "delivery_failed");
    const update = (updateCall?.[0] as { data: Record<string, unknown> }).data;
    expect(update.lastErrorCode).toBe("delivery_failed");
    expect(JSON.stringify(update)).not.toContain("password");
    expect((update.availableAt as Date).getTime()).toBeGreaterThan(now.getTime());
  });

  it("does not claim a stale snapshot after another dispatcher advanced attempts", async () => {
    const stale = row({ attempts: 11 });
    const store = {
      findMany: vi.fn(async () => [stale]),
      updateMany: vi.fn(async (args: { where?: { attempts?: number } }) => ({
        count: args.where?.attempts === 12 ? 1 : 0,
      })),
    };
    const append = vi.fn();

    const report = await dispatchOfficeEventOutboxWithStore(store as never, append);

    expect(report).toMatchObject({ scanned: 1, delivered: 0, deferred: 0, discarded: 0 });
    expect(store.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ attempts: 11 }),
    }));
    expect(append).not.toHaveBeenCalled();
  });

  it("dead-letters tampered payloads before they reach the journal", async () => {
    const store = storeWith([row({ requestDigest: "0".repeat(64) })]);
    const append = vi.fn();

    const report = await dispatchOfficeEventOutboxWithStore(store as never, append);
    expect(report).toMatchObject({ delivered: 0, discarded: 1 });
    expect(append).not.toHaveBeenCalled();
    expect(store.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastErrorCode: "digest_mismatch" }),
    }));
  });

  it("dead-letters a reclaimed crash-exhausted row before journal append", async () => {
    const store = storeWith([row({ attempts: 12 })]);
    const append = vi.fn();

    const report = await dispatchOfficeEventOutboxWithStore(store, append);

    expect(report).toMatchObject({ delivered: 0, deferred: 0, discarded: 1 });
    expect(append).not.toHaveBeenCalled();
    expect(store.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attempts: { increment: 1 } }),
    }));
    expect(store.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastErrorCode: "retry_exhausted" }),
    }));
  });
  it("dead-letters permanent replay conflicts and exhausted retries", async () => {
    const conflictStore = storeWith([row()]);
    const conflict = vi.fn(async () => {
      throw new DurableOfficeEventError("replay_conflict", "secret internal conflict detail");
    });
    const conflictReport = await dispatchOfficeEventOutboxWithStore(conflictStore, conflict);
    expect(conflictReport.discarded).toBe(1);
    expect(conflictStore.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastErrorCode: "journal_replay_conflict" }),
    }));

    const exhaustedStore = storeWith([row({ attempts: 11 })]);
    const transient = vi.fn(async () => { throw new Error("offline"); });
    const exhaustedReport = await dispatchOfficeEventOutboxWithStore(exhaustedStore, transient);
    expect(exhaustedReport.discarded).toBe(1);
    expect(exhaustedStore.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastErrorCode: "retry_exhausted" }),
    }));
    const exhaustedUpdates = exhaustedStore.updateMany.mock.calls.map((call) =>
      (call[0] as { data: Record<string, unknown> }).data);
    expect(exhaustedUpdates.filter((data) => data.attempts !== undefined)).toEqual([
      expect.objectContaining({ attempts: { increment: 1 } }),
    ]);
    expect(exhaustedUpdates.find((data) => data.lastErrorCode === "retry_exhausted")?.attempts).toBeUndefined();
  });
});

describe("Office outbox redrive", () => {
  it("redrives only scoped dead letters and clears retry state", async () => {
    const discardedAt = new Date("2026-08-23T12:00:00.000Z");
    const store = storeWith([row({ attempts: 12, discardedAt, lastErrorCode: "retry_exhausted" })]);
    const now = new Date("2026-08-23T12:05:00.000Z");
    const recordReceipt = vi.fn(async () => undefined);

    await expect(redriveOfficeEventOutboxDeadLettersWithStore(
      store,
      "workspace-1",
      {
        actorUserId: "operator-1",
        reason: "Database outage resolved and payload verified",
        limit: 10,
        now,
        recordReceipt,
      },
    )).resolves.toBe(1);

    expect(store.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { serverId: "workspace-1", deliveredAt: null, discardedAt: { not: null } },
      take: 10,
    }));
    expect(recordReceipt).toHaveBeenCalledWith({
      id: expect.any(String),
      batchId: expect.any(String),
      outboxId: "11111111-1111-4111-8111-111111111111",
      serverId: "workspace-1",
      actorUserId: "operator-1",
      reason: "Database outage resolved and payload verified",
      priorDiscardedAt: discardedAt,
      priorErrorCode: "retry_exhausted",
      priorAttempts: 12,
      redriveNumber: 1,
      redrivenAt: now,
    });
    expect(store.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ serverId: "workspace-1", deliveredAt: null }),
      data: {
        attempts: 0,
        availableAt: now,
        discardedAt: null,
        claimToken: null,
        claimUntil: null,
        lastErrorCode: null,
        redriveCount: { increment: 1 },
        lastRedrivenAt: now,
        lastRedrivenByUserId: "operator-1",
        lastRedriveReason: "Database outage resolved and payload verified",
        lastDiscardedAt: discardedAt,
        lastDiscardErrorCode: "retry_exhausted",
        lastDiscardAttempts: 12,
      },
    }));
  });

  it("does not write a forensic receipt when another operator already won the redrive race", async () => {
    const discardedAt = new Date("2026-08-23T12:00:00.000Z");
    const store = {
      findMany: vi.fn(async () => [
        row({ attempts: 12, redriveCount: 1, discardedAt, lastErrorCode: "retry_exhausted" }),
      ]),
      updateMany: vi.fn(async () => ({ count: 0 })),
    };
    const recordReceipt = vi.fn(async () => undefined);

    await expect(redriveOfficeEventOutboxDeadLettersWithStore(
      store,
      "workspace-1",
      {
        actorUserId: "operator-2",
        reason: "Second operator retry",
        now: new Date("2026-08-23T12:06:00.000Z"),
        recordReceipt,
      },
    )).resolves.toBe(0);

    expect(recordReceipt).not.toHaveBeenCalled();
  });

  it("rejects control characters in the forensic reason", async () => {
    const recordReceipt = vi.fn(async () => undefined);
    await expect(redriveOfficeEventOutboxDeadLettersWithStore(
      storeWith([]),
      "workspace-1",
      {
        actorUserId: "operator-1",
        reason: ["verified", "forged"].join(String.fromCharCode(10)),
        recordReceipt,
      },
    )).rejects.toThrow("bounded actor and reason");
    expect(recordReceipt).not.toHaveBeenCalled();
  });
});

describe("Office outbox log safety", () => {
  it("allows only bounded non-sensitive error codes", () => {
    expect(normalizedDispatcherErrorCode({ code: "P1001" })).toBe("P1001");
    expect(normalizedDispatcherErrorCode({ code: "secret\r\ninjected" })).toBe("unknown");
    expect(normalizedDispatcherErrorCode({ code: "x".repeat(33) })).toBe("unknown");
    expect(normalizedDispatcherErrorCode(new Error("postgres://user:password@internal/db"))).toBe("unknown");
  });
});
