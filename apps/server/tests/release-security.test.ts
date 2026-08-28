import { describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUploadFilename } from "../src/security/uploadFilename.js";
import { decodeEntities } from "../src/lib/linkPreview.js";
import { processTrainingVideoFile, processStandaloneFile } from "../src/attachments.js";

describe("release security boundaries", () => {
  it("decodes HTML entities exactly once", () => {
    expect(decodeEntities("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
    expect(decodeEntities("&amp;#39;&amp;quot;")).toBe("&#39;&quot;");
    expect(decodeEntities("&lt;b&gt;A&amp;B&lt;/b&gt;")).toBe("<b>A&B</b>");
    expect(decodeEntities("&unknown;&#x27;&nbsp;")).toBe("&unknown;' ");
  });

  it("generates independent storage basenames and rejects unsafe extensions", () => {
    const names = new Set(Array.from({ length: 100 }, () => createUploadFilename("webp")));
    expect(names.size).toBe(100);
    for (const name of names) expect(name).toMatch(/^[a-f0-9-]{36}\.webp$/);
    for (const extension of ["../png", "a/b", "a\\b", ".png", "png:ads", "png%2f", ""]) {
      expect(() => createUploadFilename(extension)).toThrow("Invalid storage extension");
    }
  });

  it("keeps malicious owner IDs and filenames out of training/table storage paths", async () => {
    const previous = process.env.UPLOADS_DIR;
    const directory = await mkdtemp(path.join(tmpdir(), "ec-storage-security-"));
    process.env.UPLOADS_DIR = directory;
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(20)]);
    try {
      for (const owner of ["../../escape", "..\\escape", "/absolute", "C:\\escape", "%2e%2e%2f"]) {
        const video = await processTrainingVideoFile({
          filename: "../../original.mp4", mimeType: "video/mp4", dataBase64: mp4.toString("base64"),
        }, owner);
        expect(video.url).toMatch(/^\/uploads\/training-videos\/[a-f0-9-]{36}\.mp4$/);
        expect(video.filename).toBe("../../original.mp4");
        const file = await processStandaloneFile({
          filename: "../original.txt", mimeType: "text/plain", dataBase64: Buffer.from("text").toString("base64"),
        }, owner, 0);
        expect(file.url).toMatch(/^\/uploads\/tables\/[a-f0-9-]{36}\.txt$/);
      }
      expect((await readdir(directory)).sort()).toEqual(["tables", "training-videos"]);
      expect(await readdir(path.join(directory, "training-videos"))).toHaveLength(5);
      expect(await readdir(path.join(directory, "tables"))).toHaveLength(5);
    } finally {
      if (previous === undefined) delete process.env.UPLOADS_DIR;
      else process.env.UPLOADS_DIR = previous;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
