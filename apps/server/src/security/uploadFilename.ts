import { randomUUID } from "node:crypto";

/** Storage names must never contain request IDs or user-provided filenames. */
export function createUploadFilename(extension: string): string {
  if (!/^[a-z0-9]{1,10}$/.test(extension)) throw new Error("Invalid storage extension");
  return randomUUID() + "." + extension;
}
