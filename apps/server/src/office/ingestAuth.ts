import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const OFFICE_INGEST_SCHEMA_VERSION = "office.ingest.v1" as const;
export const OFFICE_INGEST_MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
export const OFFICE_INGEST_REPLAY_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

const keyIdSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);
const producerIdSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);
const workspaceIdSchema = z.string().trim().min(1).max(160).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));
const encodedSecretSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{43,172}$/);
const activationInstantSchema = z.string().datetime({ offset: true });

const producerConfigSchema = z.object({
  producerId: producerIdSchema,
  secret: encodedSecretSchema,
  workspaceIds: z.array(workspaceIdSchema).min(1).max(100),
  notBefore: activationInstantSchema.optional(),
  notAfter: activationInstantSchema.optional(),
}).strict().superRefine((config, context) => {
  if (config.notBefore && config.notAfter && Date.parse(config.notBefore) >= Date.parse(config.notAfter)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Office ingest key activation window is invalid",
      path: ["notAfter"],
    });
  }
});

const registrySchema = z.record(keyIdSchema, producerConfigSchema);

export type OfficeIngestProducer = {
  keyId: string;
  producerId: string;
  secret: Buffer;
  workspaceIds: ReadonlySet<string>;
  notBefore: number | null;
  notAfter: number | null;
};

export type OfficeIngestRegistry = ReadonlyMap<string, OfficeIngestProducer>;

export type OfficeIngestHeaders = {
  "x-office-key-id"?: string | string[];
  "x-office-timestamp"?: string | string[];
  "x-office-nonce"?: string | string[];
  "x-office-signature"?: string | string[];
};

export type VerifiedOfficeIngest = {
  keyId: string;
  producerId: string;
  nonce: string;
  timestamp: number;
  requestDigest: string;
  expiresAt: Date;
};

export class OfficeIngestAuthError extends Error {
  constructor(
    public readonly code:
      | "config_unavailable"
      | "invalid_headers"
      | "invalid_payload"
      | "invalid_signature"
      | "stale_timestamp"
      | "workspace_denied",
    message: string,
  ) {
    super(message);
    this.name = "OfficeIngestAuthError";
  }
}

function decodeSecret(encoded: string): Buffer {
  const secret = Buffer.from(encoded, "base64url");
  if (secret.length < 32 || secret.length > 128) {
    throw new OfficeIngestAuthError("config_unavailable", "Office ingest secret must contain 32-128 bytes");
  }
  return secret;
}

export function loadOfficeIngestRegistry(raw = process.env.OFFICE_INGEST_KEYS_JSON): OfficeIngestRegistry {
  if (!raw?.trim()) return new Map();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new OfficeIngestAuthError("config_unavailable", "Office ingest registry is not valid JSON");
  }
  const parsed = registrySchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new OfficeIngestAuthError("config_unavailable", "Office ingest registry is invalid");
  }
  return new Map(Object.entries(parsed.data).map(([keyId, config]) => [
    keyId,
    {
      keyId,
      producerId: config.producerId,
      secret: decodeSecret(config.secret),
      workspaceIds: new Set(config.workspaceIds),
      notBefore: config.notBefore ? Date.parse(config.notBefore) : null,
      notAfter: config.notAfter ? Date.parse(config.notAfter) : null,
    },
  ]));
}

type CanonicalState = { nodes: number };

function canonicalJsonValue(value: unknown, depth: number, state: CanonicalState): string {
  state.nodes += 1;
  if (state.nodes > 5_000 || depth > 12) {
    throw new OfficeIngestAuthError("invalid_payload", "Office ingest payload is too complex");
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new OfficeIngestAuthError("invalid_payload", "Non-finite numbers are forbidden");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonValue(item, depth + 1, state)).join(",")}]`;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new OfficeIngestAuthError("invalid_payload", "Only JSON objects are accepted");
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonValue(record[key], depth + 1, state)}`).join(",")}}`;
  }
  throw new OfficeIngestAuthError("invalid_payload", "Only JSON-compatible values are accepted");
}

export function stableCanonicalJson(value: unknown): string {
  return canonicalJsonValue(value, 0, { nodes: 0 });
}

export function officeIngestCanonicalString(input: {
  keyId: string;
  workspaceId: string;
  timestamp: number;
  nonce: string;
  body: unknown;
}): string {
  const bodyHash = createHash("sha256").update(stableCanonicalJson(input.body), "utf8").digest("hex");
  return [
    OFFICE_INGEST_SCHEMA_VERSION,
    input.keyId,
    input.workspaceId,
    String(input.timestamp),
    input.nonce,
    bodyHash,
  ].join("\n");
}

export function officeIngestRequestDigest(input: {
  producerId: string;
  workspaceId: string;
  nonce: string;
  body: unknown;
}): string {
  const bodyHash = createHash("sha256").update(stableCanonicalJson(input.body), "utf8").digest("hex");
  return createHash("sha256").update([
    OFFICE_INGEST_SCHEMA_VERSION,
    input.producerId,
    input.workspaceId,
    input.nonce,
    bodyHash,
  ].join("\n"), "utf8").digest("hex");
}

export function createOfficeIngestSignature(input: {
  secret: Uint8Array;
  keyId: string;
  workspaceId: string;
  timestamp: number;
  nonce: string;
  body: unknown;
}): string {
  const digest = createHmac("sha256", input.secret)
    .update(officeIngestCanonicalString(input), "utf8")
    .digest("hex");
  return `v1=${digest}`;
}

function singleHeader(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function secureSignatureMatch(expected: string, provided: string): boolean {
  if (!/^v1=[a-f0-9]{64}$/.test(provided)) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export function verifyOfficeIngestAuthentication(input: {
  headers: OfficeIngestHeaders;
  workspaceId: string;
  body: unknown;
  registry: OfficeIngestRegistry;
  now?: number;
}): VerifiedOfficeIngest {
  const keyId = singleHeader(input.headers["x-office-key-id"]);
  const timestampText = singleHeader(input.headers["x-office-timestamp"]);
  const nonce = singleHeader(input.headers["x-office-nonce"]);
  const signature = singleHeader(input.headers["x-office-signature"]);
  if (!keyId || !timestampText || !nonce || !signature || !keyIdSchema.safeParse(keyId).success) {
    throw new OfficeIngestAuthError("invalid_headers", "Office ingest authentication headers are invalid");
  }
  if (!/^\d{13}$/.test(timestampText) || !z.string().uuid().safeParse(nonce).success) {
    throw new OfficeIngestAuthError("invalid_headers", "Office ingest timestamp or nonce is invalid");
  }
  const timestamp = Number(timestampText);
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > OFFICE_INGEST_MAX_CLOCK_SKEW_MS) {
    throw new OfficeIngestAuthError("stale_timestamp", "Office ingest request is outside the allowed clock window");
  }
  const producer = input.registry.get(keyId);
  if (!producer) throw new OfficeIngestAuthError("invalid_signature", "Office ingest signature is invalid");
  if ((producer.notBefore !== null && now < producer.notBefore)
    || (producer.notAfter !== null && now >= producer.notAfter)) {
    throw new OfficeIngestAuthError("invalid_signature", "Office ingest signature is invalid");
  }
  const expected = createOfficeIngestSignature({
    secret: producer.secret,
    keyId,
    workspaceId: input.workspaceId,
    timestamp,
    nonce,
    body: input.body,
  });
  if (!secureSignatureMatch(expected, signature)) {
    throw new OfficeIngestAuthError("invalid_signature", "Office ingest signature is invalid");
  }
  if (!producer.workspaceIds.has(input.workspaceId)) {
    throw new OfficeIngestAuthError("workspace_denied", "Office ingest producer is not bound to this workspace");
  }
  const requestDigest = officeIngestRequestDigest({
    producerId: producer.producerId,
    workspaceId: input.workspaceId,
    nonce,
    body: input.body,
  });
  return {
    keyId,
    producerId: producer.producerId,
    nonce,
    timestamp,
    requestDigest,
    expiresAt: new Date(now + OFFICE_INGEST_REPLAY_RETENTION_MS),
  };
}
