import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadServerManifest, serverManifest } from "../src/version.js";

describe("server version manifest", () => {
  it("matches the package manifest used by the release pipeline", () => {
    const packageManifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { name: string; version: string };

    const expectedManifest = {
      name: "@eclipse-chat/server",
      version: packageManifest.version,
    };

    expect(loadServerManifest()).toEqual(expectedManifest);
    expect(serverManifest).toEqual(expectedManifest);
  });
});
