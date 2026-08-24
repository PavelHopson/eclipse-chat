import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { db } from "../db.js";
import {
  appendOfficeEventBatch,
  DurableOfficeEventError,
} from "../office/durableEventStore.js";
import { stableCanonicalJson } from "../office/ingestAuth.js";
import { consumeGrowthBudgetOnce } from "../lib/growthBudget.js";
import { redriveOfficeEventOutboxDeadLetters } from "../office/outbox.js";

const phaseSchema = z.enum(["write", "replay", "conflict", "budget", "redrive"]);
const workspaceSchema = z.string().regex(/^office-qa-[a-z0-9-]{8,64}$/);
const nonceSchema = z.string().uuid();
const keyIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);

export function assertOfficePersistenceQaEnvironment(environment: NodeJS.ProcessEnv): void {
  if (environment.OFFICE_QA_ACK !== "isolated-database") {
    throw new Error("Office persistence QA requires OFFICE_QA_ACK=isolated-database");
  }
  const raw = environment.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (!loopback || !/^eclipse_chat_office_qa_[a-z0-9_]+$/.test(database)) {
    throw new Error("Office persistence QA refuses non-isolated databases");
  }
}

async function eventCount(workspaceId: string): Promise<number> {
  return db.officeEvent.count({ where: { serverId: workspaceId } });
}

async function main(): Promise<void> {
  assertOfficePersistenceQaEnvironment(process.env);
  const phase = phaseSchema.parse(process.argv[2]);
  const workspaceId = workspaceSchema.parse(process.env.OFFICE_QA_WORKSPACE_ID);
  const nonce = nonceSchema.parse(process.env.OFFICE_QA_NONCE);
  const keyId = keyIdSchema.parse(process.env.OFFICE_QA_KEY_ID ?? "office-persistence-qa");
  const ownerId = `${workspaceId}-owner`;
  const input = {
    workspaceId,
    type: "task.created" as const,
    subject: { kind: "task" as const, id: `${workspaceId}-task` },
    summary: "Office persistence QA event",
    metadata: { departmentId: "qa", attempt: 1 },
  };
  const requestDigest = createHash("sha256")
    .update(stableCanonicalJson({ producerId: "office-persistence-qa", input }), "utf8")
    .digest("hex");
  const replay = {
    keyId,
    nonce,
    requestDigest,
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
  };

  if (phase === "write") {
    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: ownerId,
          email: `${workspaceId}@qa.invalid`,
          passwordHash: "not-a-login-credential",
          displayName: "Office QA",
        },
      });
      await tx.server.create({
        data: {
          id: workspaceId,
          name: "Office persistence QA",
          inviteCode: `${workspaceId}-invite`,
          ownerId,
        },
      });
    });
    const result = await appendOfficeEventBatch({
      workspaceId,
      producerId: "office-persistence-qa",
      inputs: [input],
      replay,
    });
    assert.equal(result.replayed, false);
    assert.equal(result.events.length, 1);
    assert.equal(await eventCount(workspaceId), 1);
    process.stdout.write("office persistence QA write: ok\n");
    return;
  }

  if (phase === "replay") {
    const result = await appendOfficeEventBatch({
      workspaceId,
      producerId: "office-persistence-qa",
      inputs: [input],
      replay,
    });
    assert.equal(result.replayed, true);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0]?.sequence, 1);
    assert.equal(await eventCount(workspaceId), 1);
    process.stdout.write("office persistence QA replay: ok\n");
    return;
  }

  if (phase === "redrive") {
    const payload = stableCanonicalJson(input);
    const outboxId = "11111111-1111-4111-8111-111111111111";
    const discardedAt = new Date();
    await db.officeEventOutbox.create({
      data: {
        id: outboxId,
        serverId: workspaceId,
        producerId: "office-persistence-qa",
        payload,
        requestDigest: createHash("sha256").update(payload).digest("hex"),
        attempts: 12,
        discardedAt,
        lastErrorCode: "retry_exhausted",
      },
    });
    const redriven = await redriveOfficeEventOutboxDeadLetters(workspaceId, {
      actorUserId: ownerId,
      reason: "Local PostgreSQL redrive QA",
      now: new Date(discardedAt.getTime() + 1_000),
    });
    assert.equal(redriven, 1);
    const [outbox, receipt] = await Promise.all([
      db.officeEventOutbox.findUniqueOrThrow({ where: { id: outboxId } }),
      db.officeEventOutboxRedriveReceipt.findFirstOrThrow({ where: { outboxId } }),
    ]);
    assert.equal(outbox.discardedAt, null);
    assert.equal(outbox.attempts, 0);
    assert.equal(outbox.redriveCount, 1);
    assert.equal(receipt.actorUserId, ownerId);
    assert.equal(receipt.priorAttempts, 12);
    assert.equal(receipt.priorErrorCode, "retry_exhausted");
    assert.equal(receipt.redriveNumber, 1);
    process.stdout.write("office outbox redrive persistence QA: ok\n");
    return;
  }

  if (phase === "budget") {
    const budgetUserId = workspaceId + "-budget";
    await db.user.upsert({
      where: { id: budgetUserId },
      create: {
        id: budgetUserId,
        email: workspaceId + "-budget@qa.invalid",
        passwordHash: "not-a-login-credential",
        displayName: "Growth budget QA",
      },
      update: {},
    });
    const executionId = createHash("sha256")
      .update(JSON.stringify([workspaceId, "research", 1]))
      .digest("hex");
    const receipts = await Promise.all(
      Array.from(
        { length: 10 },
        () => consumeGrowthBudgetOnce(budgetUserId, 5, executionId),
      ),
    );
    assert.equal(receipts.filter((receipt) => receipt?.charged).length, 1);
    assert.equal(receipts.filter((receipt) => receipt?.idempotent).length, 9);
    assert.equal(await db.growthAiUsage.count({ where: { userId: budgetUserId, requests: 1 } }), 1);
    assert.equal(await db.growthAiUsageCharge.count({ where: { executionId, userId: budgetUserId } }), 1);
    process.stdout.write("growth budget persistence QA: ok\n");
    return;
  }
  let conflictObserved = false;
  try {
    await appendOfficeEventBatch({
      workspaceId,
      producerId: "office-persistence-qa",
      inputs: [input],
      replay: { ...replay, requestDigest: "f".repeat(64) },
    });
  } catch (error) {
    conflictObserved = error instanceof DurableOfficeEventError && error.code === "replay_conflict";
    if (!conflictObserved) throw error;
  }
  assert.equal(conflictObserved, true);
  assert.equal(await eventCount(workspaceId), 1);
  process.stdout.write("office persistence QA conflict: ok\n");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main()
    .catch(() => {
      process.stderr.write("office persistence QA failed\n");
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
