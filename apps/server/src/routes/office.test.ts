import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  OFFICE_EVENT_SCHEMA_VERSION,
  type OfficeEventInput,
} from "../office/contracts.js";
import {
  OFFICE_INGEST_SCHEMA_VERSION,
  createOfficeIngestSignature,
  type OfficeIngestRegistry,
} from "../office/ingestAuth.js";
import { registerOfficeRoutes } from "./office.js";

const NOW = Date.parse("2026-08-23T12:00:00.000Z");
const SECRET = Buffer.alloc(32, 7);
const KEY_ID = "sentinel-local";
const NONCE = "4e77edb2-f409-42a5-8ef1-ea10f9cb646c";

const eventInput: OfficeEventInput = {
  workspaceId: "server-a",
  type: "task.started",
  subject: { kind: "run", id: "run-a" },
  summary: "Sentinel начал безопасную задачу",
  metadata: { departmentId: "operations" },
};

function registry(workspaceIds = ["server-a"]): OfficeIngestRegistry {
  return new Map([
    [
      KEY_ID,
      {
        keyId: KEY_ID,
        producerId: "eclipse-hopson-sentinel",
        secret: SECRET,
        workspaceIds: new Set(workspaceIds),
        notBefore: null,
        notAfter: null,
      },
    ],
  ]);
}

function signedHeaders(workspaceId: string, body: unknown) {
  const timestamp = NOW;
  return {
    "x-office-key-id": KEY_ID,
    "x-office-timestamp": String(timestamp),
    "x-office-nonce": NONCE,
    "x-office-signature": createOfficeIngestSignature({
      secret: SECRET,
      keyId: KEY_ID,
      workspaceId,
      timestamp,
      nonce: NONCE,
      body,
    }),
  };
}

function createHarness(ingestRegistry: OfficeIngestRegistry = registry()) {
  const appendBatch = vi.fn(async (options: {
    inputs: OfficeEventInput[];
    replay?: { requestDigest: string };
  }) => ({
    events: options.inputs.map((event, index) => ({
      ...event,
      metadata: event.metadata ?? {},
      schemaVersion: OFFICE_EVENT_SCHEMA_VERSION,
      id: "872da7d6-8b7f-4904-a86b-3f59806d20ab",
      sequence: index + 1,
      occurredAt: new Date(NOW).toISOString(),
    })),
    replayed: false,
  }));
  const app = Fastify({ logger: false });
  registerOfficeRoutes(app, {
    registry: ingestRegistry,
    now: () => NOW,
    repository: {
      appendBatch: appendBatch as never,
      list: vi.fn(async () => []),
      currentCursor: vi.fn(async () => 0),
    },
  });
  return { app, appendBatch };
}

describe("Office ingest route security", () => {
  it("accepts a valid tenant-bound signed batch and passes its request digest to the store", async () => {
    const { app, appendBatch } = createHarness();
    const body = { schemaVersion: OFFICE_INGEST_SCHEMA_VERSION, events: [eventInput] };

    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/events/ingest",
      headers: signedHeaders("server-a", body),
      payload: body,
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: OFFICE_EVENT_SCHEMA_VERSION,
      source: "office-core-runtime",
      cursor: 1,
    });
    expect(Object.keys(response.json()).sort()).toEqual(["cursor", "events", "schemaVersion", "source"]);
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(appendBatch.mock.calls[0]?.[0]).toMatchObject({
      workspaceId: "server-a",
      producerId: "eclipse-hopson-sentinel",
      replay: { keyId: KEY_ID, nonce: NONCE },
    });
    expect(appendBatch.mock.calls[0]?.[0].replay?.requestDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed when service authentication is not configured", async () => {
    const { app, appendBatch } = createHarness(new Map());
    const body = { schemaVersion: OFFICE_INGEST_SCHEMA_VERSION, events: [eventInput] };

    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/events/ingest",
      payload: body,
    });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "office_ingest_unavailable" });
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it("rejects missing authentication without leaking validation details", async () => {
    const { app, appendBatch } = createHarness();
    const body = { schemaVersion: OFFICE_INGEST_SCHEMA_VERSION, events: [eventInput] };

    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/events/ingest",
      payload: body,
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Office ingest authentication failed",
      code: "office_ingest_unauthorized",
    });
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it("rejects a producer that is not bound to the requested workspace", async () => {
    const { app, appendBatch } = createHarness(registry(["server-a"]));
    const body = {
      schemaVersion: OFFICE_INGEST_SCHEMA_VERSION,
      events: [{ ...eventInput, workspaceId: "server-b" }],
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-b/office/events/ingest",
      headers: signedHeaders("server-b", body),
      payload: body,
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Office ingest authentication failed",
      code: "office_ingest_unauthorized",
    });
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it("rejects a signed cross-workspace event and server-assigned fields", async () => {
    const { app, appendBatch } = createHarness();

    const mismatchBody = {
      schemaVersion: OFFICE_INGEST_SCHEMA_VERSION,
      events: [{ ...eventInput, workspaceId: "server-b" }],
    };
    const mismatch = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/events/ingest",
      headers: signedHeaders("server-a", mismatchBody),
      payload: mismatchBody,
    });

    const massAssignmentBody = {
      schemaVersion: OFFICE_INGEST_SCHEMA_VERSION,
      events: [{ ...eventInput, id: "872da7d6-8b7f-4904-a86b-3f59806d20ab", sequence: 999 }],
    };
    const massAssignment = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/events/ingest",
      headers: signedHeaders("server-a", massAssignmentBody),
      payload: massAssignmentBody,
    });
    await app.close();

    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json()).toMatchObject({ code: "workspace_mismatch" });
    expect(massAssignment.statusCode).toBe(400);
    expect(massAssignment.json()).toMatchObject({ code: "invalid_envelope" });
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it("rejects secret-shaped metadata before the durable repository boundary", async () => {
    const { app, appendBatch } = createHarness();
    const body = {
      schemaVersion: OFFICE_INGEST_SCHEMA_VERSION,
      events: [{ ...eventInput, metadata: { apiToken: "must-not-enter-the-journal" } }],
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/events/ingest",
      headers: signedHeaders("server-a", body),
      payload: body,
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "invalid_envelope" });
    expect(appendBatch).not.toHaveBeenCalled();
    expect(response.body).not.toContain("must-not-enter-the-journal");
  });

  it("enforces the 64 KiB route body limit before ingest", async () => {
    const { app, appendBatch } = createHarness();
    const body = {
      schemaVersion: OFFICE_INGEST_SCHEMA_VERSION,
      events: [eventInput],
      padding: "x".repeat(70 * 1024),
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/office/events/ingest",
      headers: signedHeaders("server-a", body),
      payload: body,
    });
    await app.close();

    expect(response.statusCode).toBe(413);
    expect(appendBatch).not.toHaveBeenCalled();
  });
});
