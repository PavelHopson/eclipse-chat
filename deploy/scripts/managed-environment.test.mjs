import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("./managed-environment.mjs", import.meta.url), "utf8");
const functionSource = source.slice(source.indexOf("export async function")).replace("export ", "");
const flags = { O_RDONLY: 0, O_NOFOLLOW: 256, O_NONBLOCK: 512 };
function fixture({ data = "A=1\n", metadata = {}, after = {}, constants = flags, readError = false } = {}) {
  const bytes = Buffer.from(data);
  const initial = { isFile: () => true, size: bytes.length, nlink: 1, uid: 7, mode: 0o640, mtimeMs: 1, ctimeMs: 1, ...metadata };
  let statCalls = 0;
  const calls = { open: 0, read: 0, close: 0, flags: 0, buffer: null };
  const handle = {
    stat: async () => ++statCalls === 1 ? initial : { ...initial, ...after },
    read: async (buffer, offset, length, position) => {
      calls.read++;
      calls.buffer = buffer;
      if (readError) throw new Error("read failed");
      return { bytesRead: bytes.copy(buffer, offset, position, position + length) };
    },
    close: async () => { calls.close++; },
  };
  const open = async (_path, openFlags) => { calls.open++; calls.flags = openFlags; return handle; };
  const reader = vm.runInNewContext(functionSource + "\nreadManagedEnvironment;", { constants, open, Buffer, process: { getuid: () => 7 } });
  const run = (limit = 64) => reader("/managed/.env", limit, (code) => { throw new Error(code); });
  return { calls, run };
}

test("reads only the checked descriptor, with no-follow and nonblocking flags", async () => {
  const f = fixture();
  assert.equal((await f.run()).original, "A=1\n");
  assert.equal(f.calls.open, 1);
  assert.equal(f.calls.flags, 768);
  assert.equal(f.calls.close, 1);
  assert.ok(f.calls.buffer.every((byte) => byte === 0));
});
test("fails closed when the platform lacks no-follow support", async () => {
  const f = fixture({ constants: { O_RDONLY: 0 } });
  await assert.rejects(f.run(), /ENV_NOFOLLOW_UNSUPPORTED/);
  assert.equal(f.calls.open, 0);
});
test("rejects non-files, hardlinks and unsafe permissions before reading bytes", async () => {
  for (const metadata of [{ isFile: () => false }, { nlink: 2 }, { uid: 8 }, { mode: 0o644 }, { mode: 0o660 }]) {
    const f = fixture({ metadata });
    await assert.rejects(f.run(), /ENV_FILE_/);
    assert.equal(f.calls.read, 0);
    assert.equal(f.calls.close, 1);
  }
});
test("enforces the byte limit both at stat and after a growing file", async () => {
  for (const metadata of [{}, { size: 1 }]) {
    const f = fixture({ data: "too long", metadata });
    await assert.rejects(f.run(2), /ENV_FILE_UNSAFE/);
    assert.equal(f.calls.close, 1);
  }
});
test("rejects in-place changes during the read", async () => {
  const f = fixture({ after: { mtimeMs: 2 } });
  await assert.rejects(f.run(), /ENV_FILE_CHANGED/);
  assert.equal(f.calls.close, 1);
});
test("closes the handle and clears captured bytes on a read failure", async () => {
  const f = fixture({ readError: true });
  await assert.rejects(f.run(), /read failed/);
  assert.equal(f.calls.close, 1);
  assert.ok(f.calls.buffer.every((byte) => byte === 0));
});

test("production deploy binds both checkouts to the validated SHA and verifies env parents", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/deploy-prod.yml", import.meta.url), "utf8");
  const deploy = await readFile(new URL("./deploy.sh", import.meta.url), "utf8");
  assert.ok(workflow.includes("ECLIPSE_RELEASE_SHA: ${{ github.sha }}"));
  for (const text of [workflow, deploy]) {
    assert.ok(text.includes('git reset --hard "$ECLIPSE_RELEASE_SHA"'));
    assert.ok(text.includes('git rev-parse origin/master'));
  }
  assert.ok(workflow.includes('stat -c %u "$env_parent"'));
  assert.ok(workflow.includes('8#$parent_mode & 0022'));
});
