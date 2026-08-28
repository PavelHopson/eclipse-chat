import { constants } from "node:fs";
import { open } from "node:fs/promises";

// Production provisioner: unsupported platforms fail closed.
export async function readManagedEnvironment(target, maxBytes, fail) {
  if (!constants.O_NOFOLLOW || !constants.O_NONBLOCK) fail("ENV_NOFOLLOW_UNSUPPORTED");
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    .catch(() => fail("ENV_FILE_UNAVAILABLE"));
  const buffer = Buffer.alloc(maxBytes + 1);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes || stat.nlink !== 1) fail("ENV_FILE_UNSAFE");
    if (stat.uid !== process.getuid()) fail("ENV_FILE_OWNER_UNSAFE");
    if ((stat.mode & 0o027) !== 0) fail("ENV_FILE_PERMISSIONS_UNSAFE");
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > maxBytes) fail("ENV_FILE_UNSAFE");
    const after = await handle.stat();
    if (size !== stat.size || after.size !== stat.size ||
      after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) fail("ENV_FILE_CHANGED");
    return { stat, original: buffer.toString("utf8", 0, size) };
  } finally {
    buffer.fill(0);
    await handle.close();
  }
}
