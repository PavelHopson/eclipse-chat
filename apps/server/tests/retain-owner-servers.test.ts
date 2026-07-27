import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLocalUploadPath } from "../src/scripts/retainOwnerServers.js";

describe("resolveLocalUploadPath", () => {
  const root = path.resolve("/srv/eclipse-chat/uploads");

  it("resolves only files below the uploads root", () => {
    expect(resolveLocalUploadPath("/uploads/attachments/file.webp", root)).toBe(
      path.join(root, "attachments", "file.webp"),
    );
  });

  it("rejects traversal and non-upload URLs", () => {
    expect(resolveLocalUploadPath("/uploads/../apps/server/.env", root)).toBeNull();
    expect(resolveLocalUploadPath("/uploads/%2e%2e/apps/server/.env", root)).toBeNull();
    expect(resolveLocalUploadPath("https://example.test/file.webp", root)).toBeNull();
  });
});
