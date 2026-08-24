import { randomUUID } from "node:crypto";
import type { OfficeEvent as OfficeEventRow, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db.js";
import {
  OFFICE_EVENT_SCHEMA_VERSION,
  officeEventInputSchema,
  officeEventSchema,
  type OfficeEvent,
  type OfficeEventInput,
} from "./contracts.js";
import { stableCanonicalJson } from "./ingestAuth.js";

const producerIdSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);
const batchSchema = z.array(officeEventInputSchema).min(1).max(50);
const MAX_SAFE_SEQUENCE = BigInt(Number.MAX_SAFE_INTEGER);

type OfficeStoreClient = Pick<
  Prisma.TransactionClient,
  "officeEventCursor" | "officeEvent" | "officeIngestNonce"
>;

export type OfficeReplayRecord = {
  keyId: string;
  nonce: string;
  requestDigest: string;
  expiresAt: Date;
};

export type OfficeBatchAppendResult = {
  events: OfficeEvent[];
  replayed: boolean;
};

export class DurableOfficeEventError extends Error {
  constructor(
    public readonly code: "invalid_batch" | "replay_conflict" | "sequence_overflow" | "corrupt_event",
    message: string,
  ) {
    super(message);
    this.name = "DurableOfficeEventError";
  }
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function parseMetadata(metadata: string): Record<string, string | number | boolean | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    throw new DurableOfficeEventError("corrupt_event", "Stored Office event metadata is invalid");
  }
  const result = z.record(z.union([z.string(), z.number().finite(), z.boolean(), z.null()])).safeParse(parsed);
  if (!result.success) throw new DurableOfficeEventError("corrupt_event", "Stored Office event metadata is invalid");
  return result.data;
}

function mapStoredOfficeEvent(row: OfficeEventRow): OfficeEvent {
  if (row.sequence > MAX_SAFE_SEQUENCE) {
    throw new DurableOfficeEventError("corrupt_event", "Stored Office event sequence is not wire-safe");
  }
  return officeEventSchema.parse({
    schemaVersion: row.schemaVersion,
    id: row.id,
    workspaceId: row.serverId,
    sequence: Number(row.sequence),
    occurredAt: row.occurredAt.toISOString(),
    type: row.type,
    subject: { kind: row.subjectKind, id: row.subjectId },
    summary: row.summary,
    metadata: parseMetadata(row.metadata),
  });
}

type StoredIngestNonce = {
  producerId: string;
  serverId: string;
  requestDigest: string;
  firstSequence: bigint | null;
  lastSequence: bigint | null;
  acceptedCount: number | null;
};

async function resolveStoredReplay(
  client: OfficeStoreClient,
  options: { workspaceId: string; producerId: string; replay: OfficeReplayRecord },
  stored: StoredIngestNonce,
): Promise<OfficeBatchAppendResult> {
  if (
    stored.producerId !== options.producerId
    || stored.serverId !== options.workspaceId
    || stored.requestDigest !== options.replay.requestDigest
  ) {
    throw new DurableOfficeEventError("replay_conflict", "Office ingest nonce was reused with a different request");
  }
  if (stored.firstSequence === null || stored.lastSequence === null || stored.acceptedCount === null) {
    throw new DurableOfficeEventError("corrupt_event", "Stored Office ingest receipt is incomplete");
  }
  const expectedCount = stored.lastSequence - stored.firstSequence + 1n;
  if (expectedCount !== BigInt(stored.acceptedCount)) {
    throw new DurableOfficeEventError("corrupt_event", "Stored Office ingest receipt is inconsistent");
  }
  const rows = await client.officeEvent.findMany({
    where: {
      serverId: options.workspaceId,
      sequence: { gte: stored.firstSequence, lte: stored.lastSequence },
    },
    orderBy: { sequence: "asc" },
  });
  if (rows.length !== stored.acceptedCount) {
    throw new DurableOfficeEventError("corrupt_event", "Stored Office ingest events are incomplete");
  }
  return { events: rows.map(mapStoredOfficeEvent), replayed: true };
}

export async function appendOfficeEventBatchWithClient(
  client: OfficeStoreClient,
  options: {
    workspaceId: string;
    producerId: string;
    inputs: OfficeEventInput[];
    replay?: OfficeReplayRecord;
    now?: Date;
  },
): Promise<OfficeBatchAppendResult> {
  const parsedBatch = batchSchema.safeParse(options.inputs);
  const parsedProducer = producerIdSchema.safeParse(options.producerId);
  if (!parsedBatch.success || !parsedProducer.success) {
    throw new DurableOfficeEventError("invalid_batch", "Office event batch is invalid");
  }
  if (parsedBatch.data.some((event) => event.workspaceId !== options.workspaceId)) {
    throw new DurableOfficeEventError("invalid_batch", "Every Office event must match the authenticated workspace");
  }

  const now = options.now ?? new Date();
  const replay = options.replay;
  if (replay) {
    await client.officeIngestNonce.deleteMany({ where: { expiresAt: { lt: now } } });
    const existing = await client.officeIngestNonce.findUnique({
      where: { producerId_nonce: { producerId: parsedProducer.data, nonce: replay.nonce } },
    });
    if (existing) {
      return resolveStoredReplay(
        client,
        { workspaceId: options.workspaceId, producerId: parsedProducer.data, replay },
        existing,
      );
    }
    await client.officeIngestNonce.create({
      data: {
        keyId: replay.keyId,
        producerId: parsedProducer.data,
        nonce: replay.nonce,
        serverId: options.workspaceId,
        requestDigest: replay.requestDigest,
        expiresAt: replay.expiresAt,
      },
    });
  }

  const count = BigInt(parsedBatch.data.length);
  const cursor = await client.officeEventCursor.upsert({
    where: { serverId: options.workspaceId },
    create: { serverId: options.workspaceId, lastSequence: count },
    update: { lastSequence: { increment: count } },
    select: { lastSequence: true },
  });
  if (cursor.lastSequence > MAX_SAFE_SEQUENCE) {
    throw new DurableOfficeEventError("sequence_overflow", "Office event sequence exceeded the wire-safe range");
  }

  const firstSequence = cursor.lastSequence - count + 1n;
  const occurredAt = now.toISOString();
  const events = parsedBatch.data.map((input, index) =>
    officeEventSchema.parse({
      ...input,
      schemaVersion: OFFICE_EVENT_SCHEMA_VERSION,
      id: randomUUID(),
      sequence: Number(firstSequence + BigInt(index)),
      occurredAt,
    }),
  );

  await client.officeEvent.createMany({
    data: events.map((event) => ({
      id: event.id,
      serverId: event.workspaceId,
      sequence: BigInt(event.sequence),
      schemaVersion: event.schemaVersion,
      type: event.type,
      subjectKind: event.subject.kind,
      subjectId: event.subject.id,
      summary: event.summary,
      metadata: stableCanonicalJson(event.metadata),
      producerId: parsedProducer.data,
      occurredAt: new Date(event.occurredAt),
    })),
  });

  if (replay) {
    await client.officeIngestNonce.update({
      where: { producerId_nonce: { producerId: parsedProducer.data, nonce: replay.nonce } },
      data: {
        firstSequence,
        lastSequence: cursor.lastSequence,
        acceptedCount: events.length,
      },
    });
  }
  return { events, replayed: false };
}

export async function appendOfficeEventBatch(options: {
  workspaceId: string;
  producerId: string;
  inputs: OfficeEventInput[];
  replay?: OfficeReplayRecord;
  now?: Date;
}): Promise<OfficeBatchAppendResult> {
  try {
    return await db.$transaction((tx) => appendOfficeEventBatchWithClient(tx as unknown as OfficeStoreClient, options));
  } catch (error) {
    if (!options.replay || !isPrismaUniqueViolation(error)) throw error;
    const existing = await db.officeIngestNonce.findUnique({
      where: { producerId_nonce: { producerId: options.producerId, nonce: options.replay.nonce } },
    });
    if (!existing) throw error;
    return resolveStoredReplay(
      db as unknown as OfficeStoreClient,
      {
        workspaceId: options.workspaceId,
        producerId: options.producerId,
        replay: options.replay,
      },
      existing,
    );
  }
}

export async function readOfficeEvents(
  workspaceId: string,
  options: { after: number; limit: number },
): Promise<OfficeEvent[]> {
  const rows = await db.officeEvent.findMany({
    where: { serverId: workspaceId, sequence: { gt: BigInt(options.after) } },
    orderBy: { sequence: "asc" },
    take: options.limit,
  });
  return rows.map(mapStoredOfficeEvent);
}

export async function readOfficeEventCursor(workspaceId: string): Promise<number> {
  const row = await db.officeEventCursor.findUnique({
    where: { serverId: workspaceId },
    select: { lastSequence: true },
  });
  const sequence = row?.lastSequence ?? 0n;
  if (sequence < 0n || sequence > MAX_SAFE_SEQUENCE) {
    throw new DurableOfficeEventError("sequence_overflow", "Office event cursor exceeded the wire-safe range");
  }
  return Number(sequence);
}

export const durableOfficeEventRepository = {
  appendBatch: appendOfficeEventBatch,
  list: readOfficeEvents,
  currentCursor: readOfficeEventCursor,
};

export type DurableOfficeEventRepository = typeof durableOfficeEventRepository;
