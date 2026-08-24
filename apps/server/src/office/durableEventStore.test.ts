import { describe, expect, it, vi } from "vitest";
import { appendOfficeEventBatchWithClient, DurableOfficeEventError } from "./durableEventStore.js";

function fakeClient() {
  let lastSequence = 0n;
  const nonces = new Map<string, Record<string, unknown>>();
  const created: Array<Record<string, unknown>> = [];

  return {
    created,
    client: {
      officeEventCursor: {
        upsert: vi.fn(async (args: { create: { lastSequence: bigint }; update: { lastSequence: { increment: bigint } } }) => {
          lastSequence = lastSequence === 0n ? args.create.lastSequence : lastSequence + args.update.lastSequence.increment;
          return { lastSequence };
        }),
      },
      officeEvent: {
        createMany: vi.fn(async (args: { data: Array<Record<string, unknown>> }) => {
          created.push(...args.data.map((row) => ({ ...row, createdAt: new Date() })));
          return { count: args.data.length };
        }),
        findMany: vi.fn(async (args: {
          where: { serverId: string; sequence: { gte: bigint; lte: bigint } };
        }) => created
          .filter((row) =>
            row.serverId === args.where.serverId
            && (row.sequence as bigint) >= args.where.sequence.gte
            && (row.sequence as bigint) <= args.where.sequence.lte)
          .sort((left, right) => Number((left.sequence as bigint) - (right.sequence as bigint)))),
      },
      officeIngestNonce: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findUnique: vi.fn(async (args: { where: { producerId_nonce: { producerId: string; nonce: string } } }) =>
          nonces.get(args.where.producerId_nonce.producerId + ":" + args.where.producerId_nonce.nonce) ?? null),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          const key = String(args.data.producerId) + ":" + String(args.data.nonce);
          if (nonces.has(key)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
          const row = {
            id: "nonce-row",
            createdAt: new Date(),
            firstSequence: null,
            lastSequence: null,
            acceptedCount: null,
            ...args.data,
          };
          nonces.set(key, row);
          return row;
        }),
        update: vi.fn(async (args: {
          where: { producerId_nonce: { producerId: string; nonce: string } };
          data: Record<string, unknown>;
        }) => {
          const key = args.where.producerId_nonce.producerId + ":" + args.where.producerId_nonce.nonce;
          const current = nonces.get(key);
          if (!current) throw new Error("missing nonce");
          const updated = { ...current, ...args.data };
          nonces.set(key, updated);
          return updated;
        }),
      },
    },
  };
}

const baseEvent = {
  workspaceId: "server-a",
  type: "task.started" as const,
  subject: { kind: "run" as const, id: "run-a" },
  summary: "Sentinel начал безопасную задачу",
  metadata: { departmentId: "operations" },
};

describe("durable Office event batch", () => {
  it("allocates contiguous monotonic sequences and stores canonical rows", async () => {
    const fake = fakeClient();
    const first = await appendOfficeEventBatchWithClient(fake.client as never, {
      workspaceId: "server-a",
      producerId: "office-core",
      inputs: [baseEvent, { ...baseEvent, type: "task.progressed", summary: "Шаг завершён" }],
      now: new Date("2026-08-23T12:00:00.000Z"),
    });
    const second = await appendOfficeEventBatchWithClient(fake.client as never, {
      workspaceId: "server-a",
      producerId: "office-core",
      inputs: [{ ...baseEvent, type: "task.completed", summary: "Задача завершена" }],
    });

    expect(first.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(second.events[0]?.sequence).toBe(3);
    expect(first.replayed).toBe(false);
    expect(fake.created).toHaveLength(3);
    expect(fake.created[0]).toMatchObject({ serverId: "server-a", sequence: 1n, producerId: "office-core" });
  });

  it("rejects cross-workspace mass assignment", async () => {
    const fake = fakeClient();
    await expect(appendOfficeEventBatchWithClient(fake.client as never, {
      workspaceId: "server-a",
      producerId: "office-core",
      inputs: [{ ...baseEvent, workspaceId: "server-b" }],
    })).rejects.toMatchObject({ code: "invalid_batch" });
  });

  it("rejects secret-shaped metadata at the durable write boundary", async () => {
    const fake = fakeClient();
    await expect(appendOfficeEventBatchWithClient(fake.client as never, {
      workspaceId: "server-a",
      producerId: "office-core",
      inputs: [{ ...baseEvent, metadata: { privateKey: "must-not-be-stored" } }],
    })).rejects.toMatchObject({ code: "invalid_batch" });
    expect(fake.created).toHaveLength(0);
  });

  it("returns the original receipt for an exact nonce and request replay", async () => {
    const fake = fakeClient();
    const options = {
      workspaceId: "server-a",
      producerId: "eclipse-hopson-sentinel",
      inputs: [baseEvent],
      replay: {
        keyId: "sentinel-local",
        nonce: "4e77edb2-f409-42a5-8ef1-ea10f9cb646c",
        requestDigest: "a".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    };

    const first = await appendOfficeEventBatchWithClient(fake.client as never, options);
    const replay = await appendOfficeEventBatchWithClient(fake.client as never, options);

    expect(replay.replayed).toBe(true);
    expect(replay.events).toEqual(first.events);
    expect(fake.created).toHaveLength(1);
  });

  it("deduplicates the same producer nonce across an overlapping key rotation", async () => {
    const fake = fakeClient();
    const first = await appendOfficeEventBatchWithClient(fake.client as never, {
      workspaceId: "server-a",
      producerId: "eclipse-hopson-sentinel",
      inputs: [baseEvent],
      replay: {
        keyId: "sentinel-old",
        nonce: "e3fb0bc4-3a0b-4d5f-8f0d-80ec32f30b38",
        requestDigest: "c".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const replay = await appendOfficeEventBatchWithClient(fake.client as never, {
      workspaceId: "server-a",
      producerId: "eclipse-hopson-sentinel",
      inputs: [baseEvent],
      replay: {
        keyId: "sentinel-new",
        nonce: "e3fb0bc4-3a0b-4d5f-8f0d-80ec32f30b38",
        requestDigest: "c".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.events).toEqual(first.events);
    expect(fake.created).toHaveLength(1);
  });
  it("rejects nonce reuse when the signed request digest changes", async () => {
    const fake = fakeClient();
    const options = {
      workspaceId: "server-a",
      producerId: "eclipse-hopson-sentinel",
      inputs: [baseEvent],
      replay: {
        keyId: "sentinel-local",
        nonce: "4e77edb2-f409-42a5-8ef1-ea10f9cb646c",
        requestDigest: "a".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    };

    await appendOfficeEventBatchWithClient(fake.client as never, options);
    await expect(appendOfficeEventBatchWithClient(fake.client as never, {
      ...options,
      replay: { ...options.replay, requestDigest: "b".repeat(64) },
    })).rejects.toEqual(expect.objectContaining<Partial<DurableOfficeEventError>>({ code: "replay_conflict" }));
  });
});
