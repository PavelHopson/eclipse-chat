import { createHash, randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { officeEventInputSchema, type OfficeEventInput } from "./contracts.js";
import {
  appendOfficeEventBatch,
  DurableOfficeEventError,
  type OfficeBatchAppendResult,
} from "./durableEventStore.js";
import { stableCanonicalJson } from "./ingestAuth.js";

const OUTBOX_PRODUCER_SCHEMA = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);
const OUTBOX_REPLAY_KEY_ID = "internal-office-outbox";
const OUTBOX_BATCH_LIMIT = 50;
const OUTBOX_MAX_ATTEMPTS = 12;
const OUTBOX_SCAN_INTERVAL_MS = 15_000;
const OUTBOX_REPLAY_TTL_MS = 366 * 24 * 60 * 60 * 1000;
const OUTBOX_STALLED_AFTER_MS = 5 * 60 * 1000;
const OUTBOX_CLAIM_LEASE_MS = 60 * 1000;

type OfficeOutboxCreateArgs = {
  data: {
    serverId: string;
    producerId: string;
    payload: string;
    requestDigest: string;
  };
  select: { id: true };
};

type OfficeOutboxWriter = {
  officeEventOutbox: {
    create: (args: OfficeOutboxCreateArgs) => Promise<{ id: string }>;
  };
};

type OfficeOutboxRow = {
  id: string;
  serverId: string;
  producerId: string;
  payload: string;
  requestDigest: string;
  attempts: number;
  redriveCount?: number;
  discardedAt?: Date | null;
  lastErrorCode?: string | null;
};

type OfficeOutboxRedriveReceiptInput = {
  id: string;
  batchId: string;
  outboxId: string;
  serverId: string;
  actorUserId: string;
  reason: string;
  priorDiscardedAt: Date;
  priorErrorCode: string;
  priorAttempts: number;
  redriveNumber: number;
  redrivenAt: Date;
};

type OfficeOutboxStore = {
  findMany: (args: unknown) => Promise<OfficeOutboxRow[]>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
};

type OfficeEventAppender = (options: {
  workspaceId: string;
  producerId: string;
  inputs: OfficeEventInput[];
  replay: {
    keyId: string;
    nonce: string;
    requestDigest: string;
    expiresAt: Date;
  };
  now: Date;
}) => Promise<OfficeBatchAppendResult>;

export type OfficeOutboxDispatchReport = {
  scanned: number;
  delivered: number;
  deferred: number;
  discarded: number;
  unavailable: boolean;
};

export type OfficeJournalStatus = {
  schemaVersion: "office.status.v1";
  status: "ready" | "degraded";
  cursor: number;
  outbox: {
    state: "idle" | "draining" | "delayed" | "stalled";
    pending: number;
    hasDeadLetters: boolean;
  };
};

function digestPayload(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function retryDelayMs(attempt: number): number {
  return Math.min(5_000 * (2 ** Math.min(attempt, 8)), 15 * 60 * 1000);
}

function permanentFailureCode(error: unknown): string | null {
  if (!(error instanceof DurableOfficeEventError)) return null;
  if (error.code === "replay_conflict") return "journal_replay_conflict";
  if (error.code === "sequence_overflow") return "journal_sequence_overflow";
  if (error.code === "corrupt_event") return "journal_corrupt";
  if (error.code === "invalid_batch") return "invalid_payload";
  return null;
}

function parseStoredInput(row: OfficeOutboxRow): OfficeEventInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.payload);
  } catch {
    throw new Error("invalid_payload");
  }
  const event = officeEventInputSchema.safeParse(parsed);
  if (!event.success || event.data.workspaceId !== row.serverId) {
    throw new Error("invalid_payload");
  }
  if (digestPayload(row.payload) !== row.requestDigest) {
    throw new Error("digest_mismatch");
  }
  return event.data;
}

async function markDiscarded(
  store: OfficeOutboxStore,
  row: OfficeOutboxRow,
  claimToken: string,
  now: Date,
  code: string,
): Promise<number> {
  const result = await store.updateMany({
    where: { id: row.id, claimToken, deliveredAt: null, discardedAt: null },
    data: {
      discardedAt: now,
      claimToken: null,
      claimUntil: null,
      lastErrorCode: code,
    },
  });
  return result.count;
}

async function claimOutboxRow(
  store: OfficeOutboxStore,
  row: OfficeOutboxRow,
  now: Date,
): Promise<string | null> {
  const claimToken = randomUUID();
  const claimed = await store.updateMany({
    where: {
      id: row.id,
      attempts: row.attempts,
      deliveredAt: null,
      discardedAt: null,
      availableAt: { lte: now },
      OR: [{ claimUntil: null }, { claimUntil: { lt: now } }],
    },
    data: {
      claimToken,
      attempts: { increment: 1 },
      claimUntil: new Date(now.getTime() + OUTBOX_CLAIM_LEASE_MS),
    },
  });
  return claimed.count === 1 ? claimToken : null;
}

export async function enqueueOfficeEventOutboxWithClient(
  client: unknown,
  options: { producerId: string; input: OfficeEventInput },
): Promise<string> {
  const producer = OUTBOX_PRODUCER_SCHEMA.parse(options.producerId);
  const input = officeEventInputSchema.parse(options.input);
  const payload = stableCanonicalJson(input);
  const writer = client as OfficeOutboxWriter;
  const row = await writer.officeEventOutbox.create({
    data: {
      serverId: input.workspaceId,
      producerId: producer,
      payload,
      requestDigest: digestPayload(payload),
    },
    select: { id: true },
  });
  return row.id;
}

export async function enqueueOfficeEventOutbox(options: {
  producerId: string;
  input: OfficeEventInput;
}): Promise<string> {
  return db.$transaction((tx) => enqueueOfficeEventOutboxWithClient(tx, options));
}

export async function dispatchOfficeEventOutboxWithStore(
  store: OfficeOutboxStore,
  append: OfficeEventAppender,
  options: { ids?: string[]; limit?: number; now?: Date } = {},
): Promise<OfficeOutboxDispatchReport> {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 25, OUTBOX_BATCH_LIMIT));
  const ids = options.ids?.slice(0, OUTBOX_BATCH_LIMIT);
  const rows = await store.findMany({
    where: {
      deliveredAt: null,
      discardedAt: null,
      availableAt: { lte: now },
      OR: [{ claimUntil: null }, { claimUntil: { lt: now } }],
      ...(ids ? { id: { in: ids } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      serverId: true,
      producerId: true,
      payload: true,
      requestDigest: true,
      attempts: true,
    },
  });

  const report: OfficeOutboxDispatchReport = {
    scanned: rows.length,
    delivered: 0,
    deferred: 0,
    discarded: 0,
    unavailable: false,
  };

  for (const row of rows) {
    const operationNow = options.now ?? new Date();
    const claimToken = await claimOutboxRow(store, row, operationNow);
    if (!claimToken) continue;
    const claimAttempt = row.attempts + 1;
    if (claimAttempt > OUTBOX_MAX_ATTEMPTS) {
      report.discarded += await markDiscarded(store, row, claimToken, operationNow, "retry_exhausted");
      continue;
    }

    let input: OfficeEventInput;
    try {
      input = parseStoredInput(row);
    } catch (error) {
      const code = error instanceof Error && error.message === "digest_mismatch"
        ? "digest_mismatch"
        : "invalid_payload";
      report.discarded += await markDiscarded(store, row, claimToken, operationNow, code);
      continue;
    }

    try {
      await append({
        workspaceId: row.serverId,
        producerId: row.producerId,
        inputs: [input],
        replay: {
          keyId: OUTBOX_REPLAY_KEY_ID,
          nonce: row.id,
          requestDigest: row.requestDigest,
          expiresAt: new Date(operationNow.getTime() + OUTBOX_REPLAY_TTL_MS),
        },
        now: operationNow,
      });
      const updated = await store.updateMany({
        where: { id: row.id, claimToken, deliveredAt: null, discardedAt: null },
        data: {
          deliveredAt: operationNow,
          claimToken: null,
          claimUntil: null,
          lastErrorCode: null,
        },
      });
      report.delivered += updated.count;
    } catch (error) {
      const permanent = permanentFailureCode(error);
      if (permanent) {
        report.discarded += await markDiscarded(store, row, claimToken, operationNow, permanent);
        continue;
      }
      const nextAttempt = claimAttempt;
      if (nextAttempt >= OUTBOX_MAX_ATTEMPTS) {
        report.discarded += await markDiscarded(store, row, claimToken, operationNow, "retry_exhausted");
        continue;
      }
      const updated = await store.updateMany({
        where: { id: row.id, claimToken, deliveredAt: null, discardedAt: null },
        data: {
          availableAt: new Date(operationNow.getTime() + retryDelayMs(nextAttempt)),
          claimToken: null,
          claimUntil: null,
          lastErrorCode: "delivery_failed",
        },
      });
      report.deferred += updated.count;
    }
  }

  return report;
}

export async function dispatchOfficeEventOutbox(
  options: { ids?: string[]; limit?: number; now?: Date } = {},
): Promise<OfficeOutboxDispatchReport> {
  return dispatchOfficeEventOutboxWithStore(
    db.officeEventOutbox as unknown as OfficeOutboxStore,
    appendOfficeEventBatch,
    options,
  );
}

export async function dispatchOfficeEventOutboxBestEffort(
  options: { ids?: string[]; limit?: number; now?: Date } = {},
): Promise<OfficeOutboxDispatchReport> {
  try {
    return await dispatchOfficeEventOutbox(options);
  } catch {
    return { scanned: 0, delivered: 0, deferred: 0, discarded: 0, unavailable: true };
  }
}

export async function enqueueAndDispatchOfficeEvent(options: {
  producerId: string;
  input: OfficeEventInput;
}): Promise<boolean> {
  try {
    const id = await enqueueOfficeEventOutbox(options);
    const report = await dispatchOfficeEventOutboxBestEffort({ ids: [id] });
    return report.delivered === 1;
  } catch {
    return false;
  }
}

export async function redriveOfficeEventOutboxDeadLettersWithStore(
  store: OfficeOutboxStore,
  workspaceId: string,
  options: {
    actorUserId: string;
    reason: string;
    limit?: number;
    now?: Date;
    recordReceipt: (receipt: OfficeOutboxRedriveReceiptInput) => Promise<void>;
  },
): Promise<number> {
  const now = options.now ?? new Date();
  const batchId = randomUUID();
  const limit = Math.max(1, Math.min(options.limit ?? 50, OUTBOX_BATCH_LIMIT));
  const reason = options.reason.trim();
  if (
    !options.actorUserId
    || reason.length < 3
    || reason.length > 500
    || /[\u0000-\u001f\u007f]/.test(reason)
  ) {
    throw new Error("Office outbox redrive requires a bounded actor and reason");
  }
  const rows = await store.findMany({
    where: { serverId: workspaceId, deliveredAt: null, discardedAt: { not: null } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      attempts: true,
      redriveCount: true,
      discardedAt: true,
      lastErrorCode: true,
    },
  });
  let redriven = 0;
  for (const row of rows) {
    if (!row.discardedAt) continue;
    const reset = await store.updateMany({
      where: {
        serverId: workspaceId,
        id: row.id,
        deliveredAt: null,
        discardedAt: row.discardedAt,
      },
      data: {
        attempts: 0,
        availableAt: now,
        discardedAt: null,
        claimToken: null,
        claimUntil: null,
        lastErrorCode: null,
        redriveCount: { increment: 1 },
        lastRedrivenAt: now,
        lastRedrivenByUserId: options.actorUserId,
        lastRedriveReason: reason,
        lastDiscardedAt: row.discardedAt,
        lastDiscardErrorCode: row.lastErrorCode ?? "unknown",
        lastDiscardAttempts: row.attempts,
      },
    });
    if (reset.count === 1) {
      await options.recordReceipt({
        id: randomUUID(),
        batchId,
        outboxId: row.id,
        serverId: workspaceId,
        actorUserId: options.actorUserId,
        reason,
        priorDiscardedAt: row.discardedAt,
        priorErrorCode: row.lastErrorCode ?? "unknown",
        priorAttempts: row.attempts,
        redriveNumber: (row.redriveCount ?? 0) + 1,
        redrivenAt: now,
      });
    }
    redriven += reset.count;
  }
  return redriven;
}

export async function redriveOfficeEventOutboxDeadLetters(
  workspaceId: string,
  options: {
    actorUserId: string;
    reason: string;
    limit?: number;
    now?: Date;
  },
): Promise<number> {
  return db.$transaction(async (tx) => redriveOfficeEventOutboxDeadLettersWithStore(
    tx.officeEventOutbox as unknown as OfficeOutboxStore,
    workspaceId,
    {
      ...options,
      recordReceipt: async (receipt) => {
        await tx.officeEventOutboxRedriveReceipt.create({ data: receipt });
      },
    },
  ));
}
function outboxState(pending: number, oldest: Date | null, now: Date): OfficeJournalStatus["outbox"]["state"] {
  if (pending === 0) return "idle";
  if (!oldest) return "draining";
  const age = Math.max(0, now.getTime() - oldest.getTime());
  if (age >= OUTBOX_STALLED_AFTER_MS) return "stalled";
  if (age >= 60_000) return "delayed";
  return "draining";
}

export function buildOfficeJournalStatus(options: {
  cursor: bigint | null;
  pending: number;
  oldest: Date | null;
  deadLetters: number;
  now: Date;
}): OfficeJournalStatus {
  const cursorIsSafe = options.cursor === null
    || (options.cursor >= 0n && options.cursor <= BigInt(Number.MAX_SAFE_INTEGER));
  const state = outboxState(options.pending, options.oldest, options.now);
  return {
    schemaVersion: "office.status.v1",
    status: state === "stalled" || options.deadLetters > 0 || !cursorIsSafe ? "degraded" : "ready",
    cursor: cursorIsSafe && options.cursor !== null ? Number(options.cursor) : 0,
    outbox: {
      state,
      pending: Math.max(0, Math.min(options.pending, 999)),
      hasDeadLetters: options.deadLetters > 0,
    },
  };
}

export async function getOfficeJournalStatus(
  workspaceId: string,
  now = new Date(),
): Promise<OfficeJournalStatus> {
  const [cursor, pending, oldest, deadLetters] = await Promise.all([
    db.officeEventCursor.findUnique({
      where: { serverId: workspaceId },
      select: { lastSequence: true },
    }),
    db.officeEventOutbox.count({
      where: { serverId: workspaceId, deliveredAt: null, discardedAt: null },
    }),
    db.officeEventOutbox.findFirst({
      where: { serverId: workspaceId, deliveredAt: null, discardedAt: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.officeEventOutbox.count({
      where: { serverId: workspaceId, discardedAt: { not: null } },
    }),
  ]);
  return buildOfficeJournalStatus({
    cursor: cursor?.lastSequence ?? null,
    pending,
    oldest: oldest?.createdAt ?? null,
    deadLetters,
    now,
  });
}

export function normalizedDispatcherErrorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(code)
    ? code
    : "unknown";
}

let dispatcherTimer: NodeJS.Timeout | null = null;

export function startOfficeOutboxDispatcher(log: FastifyBaseLogger): void {
  if (dispatcherTimer) return;
  dispatcherTimer = setTimeout(function tick() {
    dispatchOfficeEventOutbox({ limit: 25 })
      .then((report) => {
        if (report.deferred || report.discarded) {
          log.warn({
            scanned: report.scanned,
            delivered: report.delivered,
            deferred: report.deferred,
            discarded: report.discarded,
          }, "Office outbox delivery incomplete");
        }
      })
      .catch((error) => {
        log.warn({ code: normalizedDispatcherErrorCode(error) }, "Office outbox scan unavailable");
      })
      .finally(() => {
        dispatcherTimer = setTimeout(tick, OUTBOX_SCAN_INTERVAL_MS);
        dispatcherTimer.unref();
      });
  }, OUTBOX_SCAN_INTERVAL_MS);
  dispatcherTimer.unref();
}

export function stopOfficeOutboxDispatcher(): void {
  if (dispatcherTimer) clearTimeout(dispatcherTimer);
  dispatcherTimer = null;
}