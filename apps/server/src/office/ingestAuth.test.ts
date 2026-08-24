import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createOfficeIngestSignature,
  loadOfficeIngestRegistry,
  officeIngestRequestDigest,
  OfficeIngestAuthError,
  stableCanonicalJson,
  verifyOfficeIngestAuthentication,
} from "./ingestAuth.js";

const secret = randomBytes(32);
const keyId = "sentinel-local";
const workspaceId = "server-a";
const now = 1_787_481_000_000;

function registry() {
  return loadOfficeIngestRegistry(JSON.stringify({
    [keyId]: {
      producerId: "eclipse-hopson-sentinel",
      secret: secret.toString("base64url"),
      workspaceIds: [workspaceId],
    },
  }));
}

function signed(body: unknown, overrides: Partial<{ timestamp: number; nonce: string; target: string }> = {}) {
  const timestamp = overrides.timestamp ?? now;
  const nonce = overrides.nonce ?? randomUUID();
  const target = overrides.target ?? workspaceId;
  return {
    timestamp,
    nonce,
    headers: {
      "x-office-key-id": keyId,
      "x-office-timestamp": String(timestamp),
      "x-office-nonce": nonce,
      "x-office-signature": createOfficeIngestSignature({ secret, keyId, workspaceId: target, timestamp, nonce, body }),
    },
  };
}

describe("Office ingest authentication", () => {
  it("canonicalizes object keys without changing array order", () => {
    expect(stableCanonicalJson({ z: 1, a: { y: true, x: [2, 1] } }))
      .toBe('{"a":{"x":[2,1],"y":true},"z":1}');
  });

  it("keeps replay identity stable across signing-key and timestamp rotation", () => {
    const body = { schemaVersion: "office.ingest.v1", events: [{ id: "event-a" }] };
    const oldDigest = officeIngestRequestDigest({
      producerId: "eclipse-hopson-sentinel",
      workspaceId,
      nonce: "d803045a-1420-49be-9793-1d58f24f6e4c",
      body,
    });
    const newDigest = officeIngestRequestDigest({
      producerId: "eclipse-hopson-sentinel",
      workspaceId,
      nonce: "d803045a-1420-49be-9793-1d58f24f6e4c",
      body,
    });

    expect(newDigest).toBe(oldDigest);
  });
  it("accepts a valid workspace-bound HMAC request", () => {
    const body = { schemaVersion: "office.ingest.v1", events: [] };
    const auth = signed(body);
    const authentication = verifyOfficeIngestAuthentication({
      headers: auth.headers,
      workspaceId,
      body,
      registry: registry(),
      now,
    });
    expect(authentication).toMatchObject({
      keyId,
      producerId: "eclipse-hopson-sentinel",
      nonce: auth.nonce,
      timestamp: now,
      requestDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(authentication.expiresAt.getTime()).toBe(now + 30 * 24 * 60 * 60 * 1_000);
  });

  it("rejects signature tampering and workspace substitution", () => {
    const body = { schemaVersion: "office.ingest.v1", events: [] };
    const auth = signed(body);
    expect(() => verifyOfficeIngestAuthentication({
      headers: { ...auth.headers, "x-office-signature": "v1=" + "0".repeat(64) },
      workspaceId,
      body,
      registry: registry(),
      now,
    })).toThrowError(OfficeIngestAuthError);
    expect(() => verifyOfficeIngestAuthentication({
      headers: auth.headers,
      workspaceId: "server-b",
      body,
      registry: registry(),
      now,
    })).toThrowError(/signature is invalid/i);
  });

  it("rejects stale timestamps before persistence", () => {
    const body = { schemaVersion: "office.ingest.v1", events: [] };
    const auth = signed(body, { timestamp: now - 600_000 });
    expect(() => verifyOfficeIngestAuthentication({ headers: auth.headers, workspaceId, body, registry: registry(), now }))
      .toThrowError(/clock window/i);
  });

  it("rejects control characters in configured workspace identifiers", () => {
    expect(() => loadOfficeIngestRegistry(JSON.stringify({
      [keyId]: {
        producerId: "eclipse-hopson-sentinel",
        secret: secret.toString("base64url"),
        workspaceIds: ["server-a\ninjected"],
      },
    }))).toThrowError(OfficeIngestAuthError);
  });

  it("fails closed for missing or short producer secrets", () => {
    expect(loadOfficeIngestRegistry()).toEqual(new Map());
    expect(() => loadOfficeIngestRegistry(JSON.stringify({
      bad: { producerId: "sentinel", secret: randomBytes(8).toString("base64url"), workspaceIds: [workspaceId] },
    }))).toThrowError(OfficeIngestAuthError);
  });
});


describe("Office ingest key rotation", () => {
  const oldKeyId = "sentinel-2026-08";
  const newKeyId = "sentinel-2026-09";
  const oldSecret = randomBytes(32);
  const newSecret = randomBytes(32);
  const body = { schemaVersion: "office.ingest.v1", events: [] };

  function rotatingRegistry() {
    return loadOfficeIngestRegistry(JSON.stringify({
      [oldKeyId]: {
        producerId: "eclipse-hopson-sentinel",
        secret: oldSecret.toString("base64url"),
        workspaceIds: [workspaceId],
        notAfter: new Date(now + 60_000).toISOString(),
      },
      [newKeyId]: {
        producerId: "eclipse-hopson-sentinel",
        secret: newSecret.toString("base64url"),
        workspaceIds: [workspaceId],
        notBefore: new Date(now - 60_000).toISOString(),
      },
    }));
  }

  function rotatingHeaders(key: string, value: Uint8Array, timestamp: number) {
    const nonce = randomUUID();
    return {
      "x-office-key-id": key,
      "x-office-timestamp": String(timestamp),
      "x-office-nonce": nonce,
      "x-office-signature": createOfficeIngestSignature({
        secret: value,
        keyId: key,
        workspaceId,
        timestamp,
        nonce,
        body,
      }),
    };
  }

  it("accepts both keys during the overlap window", () => {
    for (const [key, value] of [[oldKeyId, oldSecret], [newKeyId, newSecret]] as const) {
      expect(verifyOfficeIngestAuthentication({
        headers: rotatingHeaders(key, value, now),
        workspaceId,
        body,
        registry: rotatingRegistry(),
        now,
      }).keyId).toBe(key);
    }
  });

  it("fails closed before activation and at expiration without disclosing key state", () => {
    const beforeActivation = now - 60_001;
    expect(() => verifyOfficeIngestAuthentication({
      headers: rotatingHeaders(newKeyId, newSecret, beforeActivation),
      workspaceId,
      body,
      registry: rotatingRegistry(),
      now: beforeActivation,
    })).toThrowError(/signature is invalid/i);

    const atExpiration = now + 60_000;
    expect(() => verifyOfficeIngestAuthentication({
      headers: rotatingHeaders(oldKeyId, oldSecret, atExpiration),
      workspaceId,
      body,
      registry: rotatingRegistry(),
      now: atExpiration,
    })).toThrowError(/signature is invalid/i);
  });

  it("rejects inverted activation windows at configuration load", () => {
    expect(() => loadOfficeIngestRegistry(JSON.stringify({
      invalid: {
        producerId: "eclipse-hopson-sentinel",
        secret: oldSecret.toString("base64url"),
        workspaceIds: [workspaceId],
        notBefore: new Date(now + 1_000).toISOString(),
        notAfter: new Date(now).toISOString(),
      },
    }))).toThrowError(OfficeIngestAuthError);
  });
});
