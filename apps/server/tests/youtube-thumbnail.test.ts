import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  loadYouTubeThumbnail,
  parseYouTubeVideoId,
  YouTubeThumbnailProviderUnavailableError,
} from "../src/lib/youtubeThumbnail.js";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("YouTube training thumbnails", () => {
  it("accepts supported YouTube forms and rejects lookalike hosts or malformed ids", () => {
    expect(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(parseYouTubeVideoId(`https://youtu.be/${VIDEO_ID}?t=12`)).toBe(VIDEO_ID);
    expect(parseYouTubeVideoId(`https://music.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(parseYouTubeVideoId(`https://youtube.com.evil.example/watch?v=${VIDEO_ID}`)).toBeNull();
    expect(parseYouTubeVideoId("file:///etc/passwd")).toBeNull();
    expect(parseYouTubeVideoId("https://youtube.com/watch?v=short")).toBeNull();
  });

  it("validates, normalizes and caches a bounded thumbnail", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "ec-youtube-thumbnail-"));
    const source = await sharp({
      create: { width: 80, height: 45, channels: 3, background: "#d4af37" },
    }).jpeg().toBuffer();
    const fetchImpl = vi.fn(async () => new Response(source, {
      status: 200,
      headers: { "content-type": "image/jpeg", "content-length": String(source.length) },
    })) as unknown as typeof fetch;
    try {
      const first = await loadYouTubeThumbnail(VIDEO_ID, { cacheDir, fetchImpl });
      const second = await loadYouTubeThumbnail(VIDEO_ID, { cacheDir, fetchImpl });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(second.equals(first)).toBe(true);
      expect((await sharp(first).metadata()).format).toBe("webp");
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it("rejects oversized or non-image upstream responses", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "ec-youtube-thumbnail-"));
    try {
      const oversized = vi.fn(async () => new Response("x", {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(4 * 1024 * 1024) },
      })) as unknown as typeof fetch;
      await expect(loadYouTubeThumbnail(VIDEO_ID, { cacheDir, fetchImpl: oversized }))
        .rejects.toThrow("allowed size");

      const html = vi.fn(async () => new Response("<html></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;
      await expect(loadYouTubeThumbnail(VIDEO_ID, { cacheDir, fetchImpl: html }))
        .rejects.toThrow("unsupported content type");
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it("rejects an invalid id before making an outbound request", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(loadYouTubeThumbnail("../../escape", { fetchImpl })).rejects.toThrow("Invalid YouTube video id");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("opens a short circuit after an upstream network failure", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "ec-youtube-thumbnail-"));
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network timeout");
    }) as unknown as typeof fetch;
    try {
      await expect(loadYouTubeThumbnail(VIDEO_ID, { cacheDir, fetchImpl }))
        .rejects.toBeInstanceOf(YouTubeThumbnailProviderUnavailableError);
      await expect(loadYouTubeThumbnail("M7lc1UVf-VE", { cacheDir, fetchImpl }))
        .rejects.toBeInstanceOf(YouTubeThumbnailProviderUnavailableError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});
