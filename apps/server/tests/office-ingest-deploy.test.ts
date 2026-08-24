import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../../../deploy/scripts/configure-office-ingest.mjs", import.meta.url));
const workflowPath = fileURLToPath(new URL("../../../.github/workflows/deploy-prod.yml", import.meta.url));
const deployPath = fileURLToPath(new URL("../../../deploy/scripts/deploy.sh", import.meta.url));
const directories: string[] = [];
const keyId = "sentinel-prod-test-01";
const producerId = "eclipse-hopson-sentinel";
const workspaceId = "workspace-test";
const secret = Buffer.alloc(32, 17).toString("base64url");

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "eclipse-office-deploy-"));
  directories.push(directory);
  const envPath = join(directory, ".env");
  await writeFile(envPath, 'JWT_SECRET="test-only"\n', { mode: 0o640 });
  return envPath;
}

async function configure(envPath: string, secretValue = secret) {
  return execFileAsync(process.execPath, [scriptPath, envPath], {
    env: {
      ...process.env,
      OFFICE_INGEST_SENTINEL_ENABLED: "1",
      OFFICE_INGEST_SENTINEL_SECRET: secretValue,
      OFFICE_INGEST_SENTINEL_KEY_ID: keyId,
      OFFICE_INGEST_SENTINEL_PRODUCER_ID: producerId,
      OFFICE_INGEST_SENTINEL_WORKSPACE_ID: workspaceId,
    },
  });
}

async function disable(envPath: string) {
  return execFileAsync(process.execPath, [scriptPath, envPath], {
    env: {
      ...process.env,
      OFFICE_INGEST_SENTINEL_ENABLED: "0",
      OFFICE_INGEST_SENTINEL_KEY_ID: keyId,
    },
  });
}

function registryFrom(contents: string) {
  const line = contents.split(/\r?\n/u).find((entry) => entry.startsWith("OFFICE_INGEST_KEYS_JSON="));
  expect(line).toBeDefined();
  const raw = line!.slice("OFFICE_INGEST_KEYS_JSON=".length);
  expect(raw.startsWith("'") && raw.endsWith("'")).toBe(true);
  return JSON.parse(raw.slice(1, -1)) as Record<string, unknown>;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("production Office ingest provisioning", () => {
  it("atomically adds one scoped producer without printing its secret", async () => {
    const envPath = await fixture();
    const result = await configure(envPath);
    const contents = await readFile(envPath, "utf8");
    expect(registryFrom(contents)[keyId]).toEqual({ producerId, secret, workspaceIds: [workspaceId] });
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    if (process.platform !== "win32") expect((await stat(envPath)).mode & 0o777).toBe(0o640);

    await configure(envPath);
    expect((await readFile(envPath, "utf8")).match(/OFFICE_INGEST_KEYS_JSON=/gu)).toHaveLength(1);
  });

  it("fails closed rather than overwriting an existing key", async () => {
    const envPath = await fixture();
    await configure(envPath);
    const before = await readFile(envPath, "utf8");
    const conflictingSecret = Buffer.alloc(32, 34).toString("base64url");

    await expect(configure(envPath, conflictingSecret)).rejects.toMatchObject({
      stderr: expect.stringContaining("EXISTING_KEY_CONFLICT"),
    });
    expect(await readFile(envPath, "utf8")).toBe(before);
  });

  it("rejects an environment file readable outside its owner group", async () => {
    if (process.platform === "win32") return;
    const envPath = await fixture();
    await chmod(envPath, 0o644);

    await expect(configure(envPath)).rejects.toMatchObject({
      stderr: expect.stringContaining("ENV_FILE_PERMISSIONS_UNSAFE"),
    });
    expect(await readFile(envPath, "utf8")).toBe('JWT_SECRET="test-only"\n');
  });

  it("removes only the selected producer key when disabled", async () => {
    const envPath = await fixture();
    await configure(envPath);
    const result = await disable(envPath);
    const contents = await readFile(envPath, "utf8");
    expect(contents).toContain('JWT_SECRET="test-only"');
    expect(contents).not.toContain("OFFICE_INGEST_KEYS_JSON=");
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  });

  it("keeps the GitHub secret out of argv and binds only environment-scoped values", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const deploy = await readFile(deployPath, "utf8");
    expect(workflow).toContain("secrets.OFFICE_INGEST_SENTINEL_20260824_SECRET");
    expect(workflow).toContain("vars.OFFICE_INGEST_SENTINEL_WORKSPACE_ID");
    expect(workflow).toContain("vars.OFFICE_INGEST_SENTINEL_ENABLED");
    expect(deploy).toContain('node "$SCRIPT_DIR/configure-office-ingest.mjs" "$CHAT_ENV"');
    expect(deploy.indexOf('cp -p -- "$CHAT_ENV" "$CHAT_ENV_PREVIOUS"')).toBeLessThan(
      deploy.indexOf('node "$SCRIPT_DIR/configure-office-ingest.mjs" "$CHAT_ENV"'),
    );
    expect(`${workflow}\n${deploy}`).not.toMatch(/configure-office-ingest\.mjs[^\n]*OFFICE_INGEST_SENTINEL_SECRET/u);
  });
});
