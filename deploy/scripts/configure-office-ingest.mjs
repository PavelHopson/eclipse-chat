#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { chmod, chown, rename, unlink, writeFile } from "node:fs/promises";
import { readManagedEnvironment } from "./managed-environment.mjs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const PRODUCER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const WORKSPACE_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const REGISTRY_KEY = "OFFICE_INGEST_KEYS_JSON";
const MAX_ENV_BYTES = 256 * 1024;

export class OfficeIngestProvisionError extends Error {
  constructor(code) {
    super(code);
    this.name = "OfficeIngestProvisionError";
    this.code = code;
  }
}

function fail(code) {
  throw new OfficeIngestProvisionError(code);
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function validWorkspaceId(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 160
    && value.trim() === value && !WORKSPACE_CONTROL_PATTERN.test(value);
}

function validSecret(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43,172}$/.test(value)) return false;
  const bytes = Buffer.from(value, "base64url");
  try {
    return bytes.byteLength >= 32 && bytes.byteLength <= 128
      && bytes.toString("base64url") === value;
  } finally {
    bytes.fill(0);
  }
}

function validActivationInstant(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateRegistryEntry(value) {
  if (!isPlainRecord(value)) return false;
  const allowed = new Set(["producerId", "secret", "workspaceIds", "notBefore", "notAfter"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  if (typeof value.producerId !== "string" || !PRODUCER_ID_PATTERN.test(value.producerId)) return false;
  if (!validSecret(value.secret)) return false;
  if (!Array.isArray(value.workspaceIds) || value.workspaceIds.length < 1 || value.workspaceIds.length > 100
    || value.workspaceIds.some((workspaceId) => !validWorkspaceId(workspaceId))) return false;
  if (value.notBefore !== undefined && !validActivationInstant(value.notBefore)) return false;
  if (value.notAfter !== undefined && !validActivationInstant(value.notAfter)) return false;
  if (value.notBefore !== undefined && value.notAfter !== undefined
    && Date.parse(value.notBefore) >= Date.parse(value.notAfter)) return false;
  return true;
}

function parseDotenvValue(raw) {
  const value = raw.trim();
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const decoded = JSON.parse(value);
      if (typeof decoded === "string") return decoded;
    } catch {
      fail("REGISTRY_INVALID");
    }
  }
  return value;
}

function readRegistry(lines) {
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith(`${REGISTRY_KEY}=`)) matches.push(index);
  }
  if (matches.length > 1) fail("REGISTRY_DUPLICATED");
  if (matches.length === 0) return { index: null, registry: {} };
  let registry;
  try {
    registry = JSON.parse(parseDotenvValue(lines[matches[0]].slice(REGISTRY_KEY.length + 1)));
  } catch (error) {
    if (error instanceof OfficeIngestProvisionError) throw error;
    fail("REGISTRY_INVALID");
  }
  if (!isPlainRecord(registry)) fail("REGISTRY_INVALID");
  for (const [keyId, entry] of Object.entries(registry)) {
    if (!KEY_ID_PATTERN.test(keyId) || !validateRegistryEntry(entry)) fail("REGISTRY_INVALID");
  }
  return { index: matches[0], registry };
}

function validateInput({ keyId, producerId, workspaceId, secret }) {
  if (typeof keyId !== "string" || !KEY_ID_PATTERN.test(keyId)) fail("KEY_ID_INVALID");
  if (typeof producerId !== "string" || !PRODUCER_ID_PATTERN.test(producerId)) fail("PRODUCER_ID_INVALID");
  if (!validWorkspaceId(workspaceId)) fail("WORKSPACE_ID_INVALID");
  if (!validSecret(secret)) fail("SECRET_INVALID");
}

async function readEnvironmentState(envPath) {
  const target = resolve(envPath);
  const { stat, original } = await readManagedEnvironment(target, MAX_ENV_BYTES, fail);
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalNewline = original.endsWith("\n");
  const lines = original.split(/\r?\n/u);
  if (hadFinalNewline) lines.pop();
  return { target, stat, newline, lines };
}

async function writeEnvironmentState({ target, stat, newline, lines }) {
  const updated = `${lines.join(newline)}${newline}`;
  const tempPath = `${dirname(target)}/.${basename(target)}.office-${process.pid}-${randomUUID()}.tmp`;
  const existingMode = stat.mode & 0o777;
  if (process.platform !== "win32" && (existingMode & 0o027) !== 0) {
    fail("ENV_FILE_PERMISSIONS_UNSAFE");
  }
  try {
    await writeFile(tempPath, updated, { encoding: "utf8", flag: "wx", mode: existingMode });
    await chmod(tempPath, existingMode);
    if (process.platform !== "win32") await chown(tempPath, stat.uid, stat.gid);
    await rename(tempPath, target);
  } finally {
    await unlink(tempPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

export async function configureOfficeIngestEnvironment({
  envPath,
  keyId,
  producerId,
  workspaceId,
  secret,
}) {
  validateInput({ keyId, producerId, workspaceId, secret });
  const state = await readEnvironmentState(envPath);
  const { lines } = state;
  const { index, registry } = readRegistry(lines);
  const nextEntry = { producerId, secret, workspaceIds: [workspaceId] };
  if (registry[keyId] !== undefined && JSON.stringify(registry[keyId]) !== JSON.stringify(nextEntry)) {
    fail("EXISTING_KEY_CONFLICT");
  }
  registry[keyId] = nextEntry;
  const registryLine = `${REGISTRY_KEY}='${JSON.stringify(registry)}'`;
  if (index === null) lines.push(registryLine);
  else lines[index] = registryLine;
  await writeEnvironmentState(state);
}

export async function removeOfficeIngestEnvironment({ envPath, keyId }) {
  if (typeof keyId !== "string" || !KEY_ID_PATTERN.test(keyId)) fail("KEY_ID_INVALID");
  const state = await readEnvironmentState(envPath);
  const { lines } = state;
  const { index, registry } = readRegistry(lines);
  if (index === null || registry[keyId] === undefined) return;
  delete registry[keyId];
  if (Object.keys(registry).length === 0) lines.splice(index, 1);
  else lines[index] = `${REGISTRY_KEY}='${JSON.stringify(registry)}'`;
  await writeEnvironmentState(state);
}

async function main() {
  if (process.argv.length !== 3) fail("USAGE_INVALID");
  const enabled = process.env.OFFICE_INGEST_SENTINEL_ENABLED;
  let secret = process.env.OFFICE_INGEST_SENTINEL_SECRET;
  delete process.env.OFFICE_INGEST_SENTINEL_SECRET;
  try {
    if (enabled === "0") {
      await removeOfficeIngestEnvironment({
        envPath: process.argv[2],
        keyId: process.env.OFFICE_INGEST_SENTINEL_KEY_ID,
      });
      process.stdout.write("Office ingest producer disabled.\n");
      return;
    }
    if (enabled !== "1") fail("ENABLED_FLAG_INVALID");
    await configureOfficeIngestEnvironment({
      envPath: process.argv[2],
      keyId: process.env.OFFICE_INGEST_SENTINEL_KEY_ID,
      producerId: process.env.OFFICE_INGEST_SENTINEL_PRODUCER_ID,
      workspaceId: process.env.OFFICE_INGEST_SENTINEL_WORKSPACE_ID,
      secret,
    });
    process.stdout.write("Office ingest registry configured.\n");
  } finally {
    secret = undefined;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    const code = error instanceof OfficeIngestProvisionError ? error.code : "CONFIGURATION_FAILED";
    process.stderr.write(`Office ingest configuration failed: ${code}.\n`);
    process.exitCode = 1;
  });
}
