import { readFileSync } from "node:fs";

type ServerManifest = {
  name: string;
  version: string;
};

const manifestUrl = new URL("../package.json", import.meta.url);

export function loadServerManifest(): ServerManifest {
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8")) as {
    name?: unknown;
    version?: unknown;
  };

  if (
    manifest.name !== "@eclipse-chat/server"
    || typeof manifest.version !== "string"
    || !/^\d+\.\d+\.\d+$/.test(manifest.version)
  ) {
    throw new Error("Invalid Eclipse Chat server package manifest");
  }

  return {
    name: manifest.name,
    version: manifest.version,
  };
}

export const serverManifest = loadServerManifest();
